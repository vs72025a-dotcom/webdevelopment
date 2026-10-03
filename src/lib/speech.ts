/**
 * Voice I/O.
 *
 * Output uses the Web Speech `speechSynthesis` API; input uses
 * `SpeechRecognition` where the browser provides it. Both are optional and
 * feature-detected, so the app degrades to text-only without ever throwing.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export interface VoiceSettings {
  rate: number;
  pitch: number;
  voiceName: string;
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function recognitionSupported(): boolean {
  return typeof window !== 'undefined' && getRecognitionCtor() !== null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as RecognitionCtor | null;
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!speechSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/** Voices load asynchronously in Chrome; this resolves once they are present. */
export function whenVoicesReady(): Promise<SpeechSynthesisVoice[]> {
  if (!speechSupported()) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    window.setTimeout(done, 2200);
  });
}

export function useSpeech(settings: VoiceSettings, enabled: boolean): {
  speaking: boolean;
  speak: (text: string) => void;
  cancel: () => void;
  voices: SpeechSynthesisVoice[];
} {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utter = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    void whenVoicesReady().then(setVoices);
  }, []);

  useEffect(() => {
    if (!enabled && speaking) window.speechSynthesis?.cancel();
  }, [enabled, speaking]);

  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );

  const speak = useCallback(
    (text: string) => {
      if (!speechSupported() || !enabled) return;
      window.speechSynthesis.cancel();
      // Strip markdown so the voice does not read asterisks and backticks.
      const plain = text
        .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        .replace(/[*_~=|>#]/g, '')
        .replace(/\s*\[\d+\]\s*/g, ' ')
        .replace(/\n{2,}/g, '. ')
        .trim();
      if (!plain) return;
      const u = new SpeechSynthesisUtterance(plain.slice(0, 4000));
      u.rate = settings.rate;
      u.pitch = settings.pitch;
      const chosen = voices.find((v) => v.name === settings.voiceName) ?? voices.find((v) => v.default) ?? voices[0];
      if (chosen) {
        u.voice = chosen;
        u.lang = chosen.lang;
      }
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      utter.current = u;
      window.speechSynthesis.speak(u);
    },
    [enabled, settings.rate, settings.pitch, settings.voiceName, voices],
  );

  const cancel = useCallback(() => {
    if (speechSupported()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return { speaking, speak, cancel, voices };
}

export function useDictation(onResult: (text: string, final: boolean) => void): {
  listening: boolean;
  start: () => void;
  stop: () => void;
  supported: boolean;
  error: string | null;
} {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const handler = useRef(onResult);
  handler.current = onResult;

  const stop = useCallback(() => {
    rec.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError('This browser has no speech recognition. Chrome and Edge support it; Firefox and Safari do not.');
      return;
    }
    setError(null);
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';
    r.onresult = (e) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < e.results.length; i++) {
        const res = e.results[i];
        const chunk = res[0]?.transcript ?? '';
        // `isFinal` is not in our minimal type, so read it defensively.
        const isFinal = (res as unknown as { isFinal?: boolean }).isFinal === true;
        if (isFinal) final += chunk;
        else interim += chunk;
      }
      if (final) handler.current(final, true);
      if (interim) handler.current(interim, false);
    };
    r.onerror = (e) => {
      const map: Record<string, string> = {
        'not-allowed': 'Microphone permission was denied. Allow it in the browser address bar to dictate.',
        'no-speech': 'No speech detected.',
        network: 'Speech recognition needs a network connection in this browser.',
        aborted: '',
      };
      const msg = map[e.error] ?? `Recognition error: ${e.error}`;
      if (msg) setError(msg);
      setListening(false);
    };
    r.onend = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setError('Could not start the microphone.');
    }
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return { listening, start, stop, supported: recognitionSupported(), error };
}
