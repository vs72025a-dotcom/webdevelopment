import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { estimateTokens } from '../ai/tokenizer';
import { Icon } from './Icons';
import { useDictation } from '../lib/speech';

/**
 * The input surface.
 *
 * Auto-grows to the content, accepts dictation, and routes to file ingestion.
 * `Enter` sends, `Shift+Enter` breaks the line, `Escape` blurs.
 */

export interface ComposerHandle {
  focus: () => void;
  insert: (text: string) => void;
  replace: (text: string) => void;
  getValue: () => string;
}

export interface ComposerProps {
  onSend: (text: string) => void;
  busy: boolean;
  onStop: () => void;
  phase: string;
  onFiles: (files: FileList) => void;
  dictationEnabled: boolean;
  placeholder?: string;
  suggestions?: string[];
}

export const Composer = forwardRef<ComposerHandle, ComposerProps>(function Composer(
  { onSend, busy, onStop, phase, onFiles, dictationEnabled, placeholder, suggestions = [] },
  ref,
): JSX.Element {
  const [value, setValue] = useState('');
  const [dictation, setDictation] = useState<string | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  const grow = useCallback(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(260, Math.max(52, el.scrollHeight))}px`;
  }, []);

  useEffect(grow, [value, grow]);

  useImperativeHandle(ref, () => ({
    focus: () => ta.current?.focus(),
    insert: (text: string) =>
      setValue((v) => {
        const next = v.trim() ? `${v.replace(/\s+$/, '')} ${text}` : text;
        return next;
      }),
    replace: (text: string) => setValue(text),
    getValue: () => value,
  }));

  const { listening, start, stop, supported, error } = useDictation(
    useCallback((text: string, isFinal: boolean) => {
      if (isFinal) {
        setDictation(null);
        setValue((v) => (v.trim() ? `${v.replace(/\s+$/, '')} ${text.trim()}` : text.trim()));
      } else {
        setDictation(text);
      }
    }, []),
  );

  useEffect(() => {
    if (error) setDictation(null);
  }, [error]);

  const send = useCallback(() => {
    const text = value.trim();
    if (!text || busy) return;
    onSend(text);
    setValue('');
    setDictation(null);
    if (listening) stop();
    window.requestAnimationFrame(() => {
      if (ta.current) ta.current.style.height = 'auto';
    });
  }, [busy, listening, onSend, stop, value]);

  const shown = dictation ?? value;
  const tokens = shown.trim() ? estimateTokens(shown) : 0;

  return (
    <div className="composer-wrap">
      {suggestions.length > 0 && !busy ? (
        <div className="suggest">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              onClick={() => {
                setValue(s);
                ta.current?.focus();
                window.requestAnimationFrame(grow);
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <div className="composer">
        <textarea
          ref={ta}
          className="composer-text"
          rows={1}
          value={value}
          placeholder={placeholder ?? 'Ask anything — maths, code, your documents, or a research plan…'}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            } else if (e.key === 'Escape') {
              ta.current?.blur();
            } else if (e.key === 'ArrowUp' && value === '') {
              // handled by ChatView via a custom event so history works
              window.dispatchEvent(new CustomEvent('am:history-up'));
            }
          }}
          spellCheck
        />

        {dictation ? (
          <div className="composer-hint" style={{ padding: '0 15px 6px', color: 'var(--accent)' }}>
            <Icon name="mic" size={11} /> {dictation}
          </div>
        ) : null}

        {error ? (
          <div className="composer-hint" style={{ padding: '0 15px 6px', color: 'var(--err)' }}>
            {error}
          </div>
        ) : null}

        <div className="composer-bar">
          <input
            ref={file}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.csv,.tsv,.json,.log,.py,.js,.ts,.tsx,.jsx,.css,.html,.xml,.yml,.yaml,.sql,.sh,.c,.cpp,.h,.java,.go,.rs,.rb,.php,.text/plain"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            title="Attach text files to your knowledge base"
            onClick={() => file.current?.click()}
          >
            <Icon name="upload" size={15} />
          </button>

          {supported && dictationEnabled ? (
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              data-active={listening}
              title={listening ? 'Stop dictation' : 'Dictate'}
              style={listening ? { color: 'var(--accent)', borderColor: 'var(--accent-line)' } : undefined}
              onClick={() => (listening ? stop() : start())}
            >
              <Icon name={listening ? 'micOff' : 'mic'} size={15} />
            </button>
          ) : null}

          <span className="composer-hint">
            {busy ? (
              <>
                <span className="status-dot" /> {phase}
              </>
            ) : (
              <>
                <kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> newline · <kbd>⌘K</kbd> commands
              </>
            )}
          </span>

          {tokens > 0 ? <span className="composer-hint mono">~{tokens} tok</span> : null}

          <button
            type="button"
            className="send-btn"
            data-stop={busy}
            disabled={!busy && !value.trim()}
            title={busy ? 'Stop generating' : 'Send'}
            onClick={() => (busy ? onStop() : send())}
          >
            <Icon name={busy ? 'stop' : 'send'} size={16} />
          </button>
        </div>
      </div>
    </div>
  );
});
