import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Citation } from '../ai/engine';
import { useStore } from '../store/appStore';
import { Icon } from '../components/Icons';
import { Composer, type ComposerHandle } from '../components/Composer';
import { MessageItem } from '../components/MessageItem';
import { Markdown } from '../components/Markdown';
import { useSpeech } from '../lib/speech';
import { emit, EVENTS, takePrompt } from '../lib/bus';

/**
 * Chat — the primary surface.
 *
 * Empty conversations get a launchpad instead of a blank screen; every card is a
 * prompt that exercises a genuinely different code path (tool call, retrieval,
 * generation, analysis) so the first click already proves the engine works.
 */

const STARTERS: Array<{ icon: string; title: string; body: string; prompt: string }> = [
  {
    icon: 'db',
    title: 'Retrieval over your corpus',
    body: 'Answers are grounded in indexed passages and cited inline.',
    prompt: 'How does retrieval-augmented generation reduce hallucination?',
  },
  {
    icon: 'calc',
    title: 'Exact computation',
    body: 'A real expression parser — 50+ functions, units, bases, dates.',
    prompt: 'What is 12% of 4860 plus sqrt(2025), and convert 100 km/h to mph?',
  },
  {
    icon: 'braces',
    title: 'Code analysis',
    body: 'Paste a file and get structure, complexity and smell counts.',
    prompt: 'Analyse this code:\n\nfunction fib(n) {\n  if (n < 2) return n;\n  return fib(n - 1) + fib(n - 2);\n}',
  },
  {
    icon: 'quote',
    title: 'Summarise & extract',
    body: 'MMR-ranked extractive summaries, TF-IDF keywords, sentiment.',
    prompt: 'Summarise the key ideas of transformer attention in five bullets.',
  },
  {
    icon: 'sparkles',
    title: 'Creative writing',
    body: 'Poetry, prose and copy with structural constraints honoured.',
    prompt: 'Write a haiku about a compiler at midnight.',
  },
  {
    icon: 'target',
    title: 'Plan a project',
    body: 'The agent view turns a goal into executed, evidenced steps.',
    prompt: 'Plan a two-week migration of a monolith to a modular service architecture.',
  },
];

function Hero({ onPick, docs, chunks }: { onPick: (p: string) => void; docs: number; chunks: number }): JSX.Element {
  return (
    <div className="hero">
      <div className="hero-orb" aria-hidden="true" />
      <h1>What should we work out?</h1>
      <p>
        A reasoning engine that runs entirely in this browser tab — retrieval, tools, mathematics and code analysis,
        with every claim traceable to the passage that produced it.
      </p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span className="badge" data-tone="ok">
          <span className="status-dot" /> on-device engine ready
        </span>
        <span className="badge" data-tone="info">
          <Icon name="doc" size={11} /> {docs} source{docs === 1 ? '' : 's'} · {chunks} chunk{chunks === 1 ? '' : 's'} indexed
        </span>
        <span className="badge" data-tone="accent">
          <Icon name="lock" size={11} /> nothing leaves your machine
        </span>
      </div>
      <div className="hero-grid">
        {STARTERS.map((s) => (
          <button key={s.title} type="button" className="hero-card" onClick={() => onPick(s.prompt)}>
            <span className="ico">
              <Icon name={s.icon} size={16} />
            </span>
            <strong>{s.title}</strong>
            <span>{s.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CitationSheet({ citation, onClose }: { citation: Citation; onClose: () => void }): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className="card"
        style={{ width: 'min(680px, 100%)', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Source ${citation.index}`}
      >
        <div className="card-head">
          <span className="cite-num" style={{ fontSize: 12 }}>
            [{citation.index}]
          </span>
          <span className="card-title">{citation.title}</span>
          <span className="badge" data-tone="info">
            {citation.kind}
          </span>
          <span className="badge" data-tone={citation.score >= 0.6 ? 'ok' : 'warn'}>
            {Math.round(citation.score * 100)}% match
          </span>
          <span className="spacer" />
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="scroll" style={{ padding: 16 }}>
          <Markdown source={citation.excerpt} />
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 12 }}>
            source id: {citation.sourceId}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ChatView(): JSX.Element {
  const store = useStore();
  const { active, busy, phase, settings, documents, indexStats } = store;
  const scrollRef = useRef<HTMLDivElement>(null);
  const composer = useRef<ComposerHandle>(null);
  const [citation, setCitation] = useState<Citation | null>(null);
  const [pinned, setPinned] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const { speak, cancel, speaking } = useSpeech(settings.speech, settings.speech.enabled);

  const messages = active?.messages ?? [];

  // Stick to the bottom while streaming, but never fight a user who scrolled up.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const slack = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (pinned || slack < 220) {
      el.scrollTop = el.scrollHeight;
      setPinned(true);
    }
  }, [messages.length, messages[messages.length - 1]?.content, pinned]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const slack = el.scrollHeight - el.scrollTop - el.clientHeight;
      setPinned(slack < 120);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Focus the input whenever the conversation changes, and pick up any prompt
  // another view queued for us (e.g. "Ask about this document").
  useEffect(() => {
    composer.current?.focus();
    const queued = takePrompt();
    if (queued) {
      composer.current?.replace(queued);
      window.requestAnimationFrame(() => composer.current?.focus());
    }
  }, [active?.id]);

  const suggestions = useMemo(() => {
    if (messages.length > 0) {
      const last = messages[messages.length - 1];
      if (last.role === 'assistant' && !last.pending) {
        return ['Explain that step by step', 'Give me a worked example', 'Summarise in three bullets'];
      }
      return [];
    }
    return ['Explain mixture-of-experts routing', 'Convert 5 GiB to megabytes', 'Review this TypeScript for bugs'];
  }, [messages]);

  const onSend = useCallback(
    (text: string) => {
      void store.send(text);
    },
    [store],
  );

  const onFiles = useCallback(
    (files: FileList) => {
      void (async () => {
        const res = await store.addFiles(files);
        if (res.added > 0) {
          store.toast('ok', `Indexed ${res.added} file${res.added === 1 ? '' : 's'}`, 'It is now searchable and citable in chat.');
        }
      })();
    },
    [store],
  );

  const onSpeak = useCallback(
    (id: string, text: string) => {
      if (speakingId === id || speaking) {
        cancel();
        setSpeakingId(null);
        return;
      }
      setSpeakingId(id);
      speak(text);
    },
    [cancel, speak, speaking, speakingId],
  );

  // If synthesis finishes on its own, clear the indicator.
  useEffect(() => {
    if (!speaking) setSpeakingId(null);
  }, [speaking]);

  const history = useRef<string[]>([]);
  useEffect(() => {
    history.current = messages.filter((m) => m.role === 'user').map((m) => m.content);
  }, [messages]);

  useEffect(() => {
    const onUp = () => {
      const lastUser = history.current[history.current.length - 1];
      if (lastUser && composer.current?.getValue() === '') composer.current.insert(lastUser);
    };
    window.addEventListener('am:history-up', onUp as EventListener);
    return () => window.removeEventListener('am:history-up', onUp as EventListener);
  }, []);

  const totalTokens = useMemo(
    () =>
      messages.reduce((n, m) => n + (m.tokens ? m.tokens.prompt + m.tokens.completion : 0), 0),
    [messages],
  );

  return (
    <div className="view">
      <div className="scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <Hero onPick={(p) => void store.send(p)} docs={documents.length} chunks={indexStats.chunks} />
        ) : (
          <div className="wrap">
            <div className="thread">
              {messages.map((m, i) => (
                <MessageItem
                  key={m.id}
                  message={m}
                  index={i}
                  total={messages.length}
                  speaking={speakingId === m.id}
                  onRegenerate={(id) => void store.regenerate(id)}
                  onDelete={(id) => store.deleteMessage(id)}
                  onEdit={(id, content) => void store.editMessage(id, content)}
                  onSpeak={(text) => onSpeak(m.id, text)}
                  onCiteJump={setCitation}
                />
              ))}
              {busy && messages[messages.length - 1]?.role === 'user' ? (
                <div className="msg" data-role="assistant">
                  <div className="avatar" data-role="assistant" aria-hidden="true">
                    <Icon name="sparkles" size={15} />
                  </div>
                  <div className="msg-col">
                    <div className="bubble" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className="status-dot" />
                      <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{phase}…</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {totalTokens > 0 ? (
              <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
                <button
                  type="button"
                  className="mono chat-telemetry-pill"
                  onClick={() => {
                    store.setView('settings');
                    window.setTimeout(() => emit(EVENTS.settingsSection, 'telemetry'), 60);
                  }}
                  title="View full AI Telemetry & Observability"
                >
                  <Icon name="gauge" size={11} />
                  <span>
                    {messages.length} messages · {totalTokens.toLocaleString()} tokens · view telemetry
                  </span>
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <Composer
        ref={composer}
        onSend={onSend}
        busy={busy}
        onStop={store.stop}
        phase={phase ?? 'working'}
        onFiles={onFiles}
        dictationEnabled={settings.speech.enabled}
        suggestions={suggestions}
        placeholder={
          messages.length === 0
            ? 'Ask anything — or pick a card above to see the engine work…'
            : 'Follow up, or ask something new…'
        }
      />

      {citation ? <CitationSheet citation={citation} onClose={() => setCitation(null)} /> : null}
    </div>
  );
}
