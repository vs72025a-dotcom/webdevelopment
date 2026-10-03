import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { detectLanguage, estimateTokens, LANGUAGES, type Language } from '../ai/tokenizer';
import { highlight } from '../ai/highlight';
import { runTool } from '../ai/tools';
import type { Citation } from '../ai/engine';
import type { ToolCallInfo } from '../store/db';
import { useStore } from '../store/appStore';
import { ask, isRemote } from '../lib/ask';
import { EVENTS, on } from '../lib/bus';
import { Icon } from '../components/Icons';
import { Markdown } from '../components/Markdown';

/**
 * Code Lab.
 *
 * Two distinct kinds of answer live here. **Analyse** is deterministic static
 * analysis — line counts, structure, cyclomatic estimate, smell detection — and
 * always runs, because it is our own parser, not a model. **Explain / Review /
 * Tests** go through the same routing as chat: your provider if you configured
 * one, otherwise the on-device engine with its tools and citations.
 */

const STARTER = `// Paste your code here, or load an example from the panel on the left.
// "Analyse" runs locally and instantly. "Explain" and "Review" use the engine.

function debounce(fn, wait) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}
`;

type Mode = 'idle' | 'running';

interface LabResult {
  title: string;
  markdown: string;
  model: string;
  citations: Citation[];
  toolCalls: ToolCallInfo[];
  thinking: string[];
  ms: number;
  error?: string;
}

export function CodeLabView(): JSX.Element {
  const store = useStore();
  const { settings } = store;

  const [code, setCode] = useState<string>(() => localStorage.getItem('am.codelab') ?? STARTER);
  const [langOverride, setLangOverride] = useState<string>('auto');
  const [preview, setPreview] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [phase, setPhase] = useState('');
  const [result, setResult] = useState<LabResult | null>(null);
  const [stream, setStream] = useState('');

  const ta = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const abort = useRef<{ aborted: boolean }>({ aborted: false });

  const lang: Language = useMemo(
    () => detectLanguage(code, langOverride === 'auto' ? undefined : langOverride),
    [code, langOverride],
  );

  const lines = useMemo(() => code.split('\n'), [code]);
  const html = useMemo(() => (preview ? highlight(code, lang) : ''), [preview, code, lang]);

  /* persist + sample loading */
  useEffect(() => {
    const t = window.setTimeout(() => localStorage.setItem('am.codelab', code), 400);
    return () => window.clearTimeout(t);
  }, [code]);

  useEffect(
    () =>
      on<{ label: string; lang: string; code: string }>(EVENTS.codeSample, (s) => {
        setCode(s.code);
        setLangOverride(s.lang);
        setResult(null);
        store.toast('info', `Loaded ${s.label}`);
      }),
    [store],
  );

  useEffect(
    () =>
      on<{ id: string; title: string; text: string }>(EVENTS.codeFile, (f) => {
        setCode(f.text);
        setLangOverride('auto');
        setResult(null);
        store.toast('info', `Loaded ${f.title} from your corpus`);
      }),
    [store],
  );

  const syncScroll = useCallback(() => {
    if (gutter.current && ta.current) gutter.current.scrollTop = ta.current.scrollTop;
  }, []);

  const stop = useCallback(() => {
    abort.current.aborted = true;
    setMode('idle');
    setPhase('stopped');
  }, []);

  /** Deterministic static analysis — no model involved. */
  const analyse = useCallback(async () => {
    setMode('running');
    setPhase('analysing');
    setStream('');
    const t0 = performance.now();
    const res = await runTool('code_analyze', { code, language: lang });
    setResult({
      title: 'Static analysis',
      markdown: res.ok ? res.detail ?? res.summary : `**Analysis failed.** ${res.error ?? ''}`,
      model: 'local parser',
      citations: [],
      toolCalls: [],
      thinking: [`code_analyze(${code.length} chars, ${lang})`],
      ms: Math.round(performance.now() - t0),
      error: res.ok ? undefined : res.error,
    });
    setMode('idle');
    setPhase('');
  }, [code, lang]);

  /** Model-backed tasks routed through the shared `ask` helper. */
  const runModelTask = useCallback(
    async (title: string, instruction: string, system: string) => {
      if (!code.trim()) {
        store.toast('warn', 'Nothing to work on', 'Paste some code first.');
        return;
      }
      abort.current = { aborted: false };
      setMode('running');
      setResult(null);
      setStream('');
      setPhase('thinking');

      const prompt = `${instruction}\n\nLanguage: ${lang}\n\n\`\`\`${lang}\n${code}\n\`\`\``;
      const res = await ask(prompt, {
        settings,
        system,
        signal: abort.current,
        ground: false,
        onDelta: (t) => setStream((s) => s + t),
        onPhase: setPhase,
      });

      setResult({
        title,
        markdown: res.content || (res.error ? '' : '_No output._'),
        model: res.model,
        citations: res.citations,
        toolCalls: res.toolCalls,
        thinking: res.thinking,
        ms: res.latencyMs,
        error: res.error,
      });
      setStream('');
      setMode('idle');
      setPhase('');
    },
    [code, lang, settings, store],
  );

  const stats = useMemo(() => {
    const nonEmpty = lines.filter((l) => l.trim()).length;
    const commentish = lines.filter((l) => /^\s*(\/\/|#|\/\*|\*|--|%)/.test(l)).length;
    return {
      lines: lines.length,
      nonEmpty,
      comments: commentish,
      chars: code.length,
      tokens: estimateTokens(code),
      blank: lines.length - nonEmpty,
    };
  }, [code, lines]);

  const saveToCorpus = useCallback(async () => {
    const name = window.prompt('Index this file in the knowledge base as:', `snippet.${lang === 'text' ? 'txt' : lang}`);
    if (!name) return;
    await store.addNote(name, code);
    store.toast('ok', 'Indexed', 'It can now be retrieved and cited in chat.');
  }, [code, lang, store]);

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="view-title">Code Lab</div>
          <div className="view-sub">
            {lang} · {stats.lines} lines · {stats.tokens.toLocaleString()} tokens ·{' '}
            {isRemote(settings) ? 'model-backed review' : 'on-device review'}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <div className="seg" role="group" aria-label="Editor mode">
          <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>
            Edit
          </button>
          <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>
            Highlighted
          </button>
        </div>
        <select
          className="select"
          style={{ height: 30, fontSize: 12 }}
          value={langOverride}
          onChange={(e) => setLangOverride(e.target.value)}
          title="Language for analysis and highlighting"
        >
          <option value="auto">auto-detect ({lang})</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>

      <div className="scroll">
        <div className="wrap wrap-wide">
          <div className="editor-shell">
            <div className="editor-bar">
              <button type="button" className="btn btn-sm btn-primary" onClick={() => void analyse()} disabled={mode === 'running'}>
                <Icon name="gauge" size={13} /> Analyse
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={mode === 'running'}
                onClick={() =>
                  void runModelTask(
                    'Explanation',
                    'Explain what this code does. Walk through the control flow, name the key abstractions, state the inputs and outputs, and point out anything a new reader would find surprising.',
                    'You are a senior engineer explaining code to a competent colleague. Be concrete and reference actual identifiers from the snippet. Use markdown with short sections.',
                  )
                }
              >
                <Icon name="book" size={13} /> Explain
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={mode === 'running'}
                onClick={() =>
                  void runModelTask(
                    'Review',
                    'Review this code for defects. List concrete bugs, race conditions, error-handling gaps, security issues and performance traps. For each finding give severity, the exact line or identifier, why it is wrong, and a corrected version.',
                    'You are a demanding code reviewer. Never invent problems; if the code is sound, say so and explain why. Cite identifiers verbatim.',
                  )
                }
              >
                <Icon name="shield" size={13} /> Review
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={mode === 'running'}
                onClick={() =>
                  void runModelTask(
                    'Test plan',
                    'Write a test plan for this code: enumerate the behaviours worth covering, then give runnable test cases including edge cases and failure modes. Use the idiomatic test framework for the language.',
                    'You write precise, executable tests. Cover boundaries, empty inputs, and error paths. Do not restate the implementation.',
                  )
                }
              >
                <Icon name="list" size={13} /> Tests
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={mode === 'running'}
                onClick={() =>
                  void runModelTask(
                    'Refactor',
                    'Refactor this code. Show the improved version in full, then list each change with the reason. Preserve behaviour exactly unless a bug makes that impossible.',
                    'You refactor for clarity and correctness, not novelty. Keep the public interface stable.',
                  )
                }
              >
                <Icon name="refresh" size={13} /> Refactor
              </button>

              <span style={{ flex: 1 }} />

              {mode === 'running' ? (
                <button type="button" className="btn btn-sm btn-danger" onClick={stop}>
                  <Icon name="stop" size={13} /> Stop
                </button>
              ) : null}

              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Copy code"
                onClick={() => void navigator.clipboard?.writeText(code).catch(() => undefined)}
              >
                <Icon name="copy" size={13} />
              </button>
              <button type="button" className="btn btn-ghost btn-sm" title="Index in knowledge base" onClick={() => void saveToCorpus()}>
                <Icon name="db" size={13} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title="Clear editor"
                onClick={() => {
                  setCode('');
                  setResult(null);
                  ta.current?.focus();
                }}
              >
                <Icon name="trash" size={13} />
              </button>
            </div>

            <div className="editor-area">
              <div className="editor-gutter" ref={gutter} aria-hidden="true">
                {lines.map((_, i) => `${i + 1}\n`).join('')}
              </div>
              {preview ? (
                <pre
                  className="editor-input"
                  style={{ margin: 0, overflow: 'auto' }}
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : (
                <textarea
                  ref={ta}
                  className="editor-input"
                  value={code}
                  spellCheck={false}
                  onChange={(e) => setCode(e.target.value)}
                  onScroll={syncScroll}
                  onKeyDown={(e) => {
                    if (e.key === 'Tab') {
                      e.preventDefault();
                      const el = e.currentTarget;
                      const s = el.selectionStart;
                      const next = `${code.slice(0, s)}  ${code.slice(el.selectionEnd)}`;
                      setCode(next);
                      window.requestAnimationFrame(() => {
                        el.selectionStart = el.selectionEnd = s + 2;
                      });
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      void analyse();
                    }
                  }}
                />
              )}
            </div>
          </div>

          <div className="grid grid-4" style={{ margin: '12px 0' }}>
            <div className="kpi">
              <div className="kpi-value">{stats.nonEmpty}</div>
              <div className="kpi-label">code lines</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">{stats.comments}</div>
              <div className="kpi-label">comment lines</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">{stats.tokens.toLocaleString()}</div>
              <div className="kpi-label">est. tokens</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">{lang}</div>
              <div className="kpi-label">detected language</div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <Icon name="terminal" size={15} className="ico" />
              <span className="card-title">{result?.title ?? 'Output'}</span>
              {result ? (
                <>
                  <span className="badge" data-tone="info">{result.model}</span>
                  <span className="badge">{result.ms} ms</span>
                </>
              ) : null}
              {mode === 'running' ? (
                <span className="badge" data-tone="accent">
                  <span className="status-dot" /> {phase || 'working'}
                </span>
              ) : null}
              <span style={{ flex: 1 }} />
              {result ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void navigator.clipboard?.writeText(result.markdown).catch(() => undefined)}
                >
                  <Icon name="copy" size={13} /> Copy
                </button>
              ) : null}
            </div>
            <div className="card-pad">
              {mode === 'running' && !stream ? (
                <div className="empty">
                  <Icon name="cpu" className="ico" />
                  <strong>{phase || 'Working'}…</strong>
                  <p>{isRemote(settings) ? 'Streaming from your provider.' : 'The on-device engine is parsing, routing and composing.'}</p>
                </div>
              ) : stream ? (
                <div>
                  <Markdown source={stream} streaming />
                  <span className="caret" />
                </div>
              ) : result ? (
                <div>
                  {result.error ? (
                    <div className="callout" data-tone="err">
                      <Icon name="alert" size={15} className="ico" />
                      <div>
                        <strong style={{ fontSize: 12.5 }}>{result.error}</strong>
                        <div style={{ fontSize: 11.5, opacity: 0.85 }}>
                          Partial output below, if any. Switch engines in Settings → Model provider.
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <Markdown source={result.markdown} citations={result.citations.map((c) => ({ index: c.index, title: c.title }))} />
                  {result.toolCalls.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
                      {result.toolCalls.map((t, i) => (
                        <div className="toolcard" key={i}>
                          <div className="toolcard-head" style={{ cursor: 'default' }}>
                            <span className="toolcard-icon">
                              <Icon name="braces" size={12} />
                            </span>
                            <span className="toolcard-name">{t.label}</span>
                            <span className="toolcard-sum">{t.summary}</span>
                            <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                              {t.ms}ms
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {result.thinking.length > 0 ? (
                    <details style={{ marginTop: 10 }}>
                      <summary style={{ cursor: 'pointer', fontSize: 11.5, color: 'var(--text-faint)' }}>
                        Reasoning trace ({result.thinking.length})
                      </summary>
                      <div className="trace-body" style={{ padding: '8px 0 0' }}>
                        {result.thinking.map((t, i) => (
                          <div key={i}>› {t}</div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : (
                <div className="empty">
                  <Icon name="code" className="ico" />
                  <strong>No output yet</strong>
                  <p>
                    <kbd>⌘</kbd>+<kbd>Enter</kbd> runs the static analysis. Explain, Review, Tests and Refactor go
                    through the engine.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
