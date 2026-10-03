import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ART_STYLES,
  DEFAULT_SPEC,
  PALETTES,
  buildPromptText,
  paletteForPrompt,
  renderArt,
  type ArtSpec,
  type ArtStyle,
  type RenderResult,
} from '../ai/art';
import { keywords } from '../ai/analysis';
import { db, STORE, uid, type ArtworkRecord } from '../store/db';
import { useStore } from '../store/appStore';
import { ask, isRemote } from '../lib/ask';
import { EVENTS, emit, on } from '../lib/bus';
import { Icon } from '../components/Icons';
import { Markdown } from '../components/Markdown';

/**
 * Prompt Studio.
 *
 * This is not a fake image generator. The prompt is parsed into a structured
 * spec — style, palette, density, chaos, glow, grain, scale, per-term weights,
 * negative terms — and that spec drives a real seeded renderer: value noise,
 * marching squares, flow advection, additive bloom. Same seed, same spec, same
 * pixels, every time. The prompt string you can copy out is a faithful
 * description of what was actually drawn.
 */

const W = 1280;
const H = 800;

function Slider({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}): JSX.Element {
  return (
    <label className="setting-row" style={{ padding: '7px 0' }}>
      <span className="txt">
        <strong style={{ fontSize: 12 }}>
          {label} <span className="mono" style={{ color: 'var(--accent)' }}>{Math.round(value * 100)}%</span>
        </strong>
        {hint ? <span>{hint}</span> : null}
      </span>
      <input
        className="range"
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 128 }}
        aria-label={label}
      />
    </label>
  );
}

export function StudioView(): JSX.Element {
  const store = useStore();
  const { settings } = store;

  const [spec, setSpec] = useState<ArtSpec>(() => ({
    ...DEFAULT_SPEC,
    prompt: localStorage.getItem('am.studio.prompt') ?? 'aurora over a frozen lake at midnight, long exposure',
    seed: Number(localStorage.getItem('am.studio.seed')) || 20261003,
    weights: {},
  }));
  const [animate, setAnimate] = useState(false);
  const [result, setResult] = useState<RenderResult | null>(null);
  const [refining, setRefining] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [copied, setCopied] = useState(false);

  const canvas = useRef<HTMLCanvasElement>(null);
  const raf = useRef<number>(0);
  const timeRef = useRef(0);

  const palette = useMemo(() => paletteForPrompt(spec.prompt, spec.paletteId), [spec.prompt, spec.paletteId]);
  const promptText = useMemo(() => buildPromptText(spec, palette), [spec, palette]);
  const terms = useMemo(() => keywords(spec.prompt, 6).map((k) => k.term), [spec.prompt]);

  const paint = useCallback(
    (time: number) => {
      const cv = canvas.current;
      if (!cv) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const res = renderArt(ctx, W, H, spec, time);
      setResult(res);
    },
    [spec],
  );

  // Static render whenever the spec changes.
  useEffect(() => {
    if (animate) return;
    paint(0);
  }, [animate, paint]);

  // Animated render loop — only the time-varying styles actually move.
  useEffect(() => {
    if (!animate) return;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      timeRef.current += dt / 1000;
      paint(timeRef.current);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [animate, paint]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      localStorage.setItem('am.studio.prompt', spec.prompt);
      localStorage.setItem('am.studio.seed', String(spec.seed));
    }, 400);
    return () => window.clearTimeout(t);
  }, [spec.prompt, spec.seed]);

  useEffect(
    () =>
      on<ArtStyle>('am:art-style', (style) => {
        setSpec((s) => ({ ...s, style }));
      }),
    [],
  );

  useEffect(
    () =>
      on<ArtworkRecord>(EVENTS.artOpen, (a) => {
        const loaded = a.spec as ArtSpec;
        if (loaded && typeof loaded === 'object') {
          setSpec({ ...DEFAULT_SPEC, ...loaded });
          setAnimate(false);
        }
      }),
    [],
  );

  const patch = (p: Partial<ArtSpec>) => setSpec((s) => ({ ...s, ...p }));

  const randomise = () => {
    const seed = Math.floor(Math.random() * 4294967295);
    const style = ART_STYLES[Math.floor(Math.random() * ART_STYLES.length)].id;
    const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)].id;
    patch({
      seed,
      style,
      paletteId: pal,
      density: 0.3 + Math.random() * 0.6,
      chaos: 0.15 + Math.random() * 0.7,
      glow: 0.25 + Math.random() * 0.7,
      grain: Math.random() * 0.35,
      scale: 0.25 + Math.random() * 0.65,
    });
  };

  const download = () => {
    const cv = canvas.current;
    if (!cv) return;
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = `aurora-${spec.style}-${spec.seed}.png`;
    a.click();
    store.toast('ok', 'PNG exported', `${W}×${H} · seed ${spec.seed}`);
  };

  const save = async () => {
    const cv = canvas.current;
    if (!cv) return;
    const record: ArtworkRecord = {
      id: uid('a'),
      spec,
      promptText,
      dataUrl: cv.toDataURL('image/png'),
      createdAt: Date.now(),
    };
    await db.put(STORE.artworks, record);
    emit(EVENTS.artChanged, null);
    store.toast('ok', 'Saved to gallery', 'Open it again from the Studio panel.');
  };

  const refine = async () => {
    setRefining(true);
    setRefineText('');
    const res = await ask(
      `Rewrite this image prompt so it is more vivid and specific, keeping the same subject and mood. Reply with only the improved prompt on one line — no quotes, no explanation.\n\nCurrent prompt: ${spec.prompt}`,
      {
        settings,
        system:
          'You are a prompt engineer for a deterministic generative-art renderer. Your output must be a single line of comma-separated visual descriptors: subject, lighting, palette mood, texture, camera or exposure. No preamble.',
        ground: false,
        onDelta: (t) => setRefineText((s) => s + t),
      },
    );
    const out = (res.content || refineText).trim().split('\n')[0].replace(/^["'`]+|["'`]+$/g, '');
    if (out) {
      patch({ prompt: out });
      store.toast('ok', 'Prompt refined', res.model);
    } else {
      store.toast('warn', 'No rewrite returned', res.error ?? 'The engine returned an empty response.');
    }
    setRefining(false);
    setRefineText('');
  };

  const copyPrompt = () => {
    void navigator.clipboard
      ?.writeText(promptText)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => undefined);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="view-title">Prompt Studio</div>
          <div className="view-sub">
            Structured prompt → seeded renderer · {spec.style} · {palette.label} · seed {spec.seed}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-sm"
          aria-pressed={animate}
          onClick={() => setAnimate((v) => !v)}
          title="Animate the time-varying styles"
        >
          <Icon name={animate ? 'stop' : 'play'} size={13} /> {animate ? 'Stop' : 'Animate'}
        </button>
        <button type="button" className="btn btn-sm" onClick={randomise}>
          <Icon name="dice" size={13} /> Randomise
        </button>
        <button type="button" className="btn btn-sm" onClick={download}>
          <Icon name="download" size={13} /> PNG
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void save()}>
          <Icon name="save" size={13} /> Save
        </button>
      </div>

      <div className="scroll">
        <div className="wrap wrap-wide">
          <div className="studio">
            <div>
              <div className="canvas-frame">
                <canvas ref={canvas} width={W} height={H} />
                <div className="canvas-overlay">
                  {result ? (
                    <>
                      <span>seed {result.seed}</span>
                      <span>{result.style}</span>
                      <span>{result.palette.label}</span>
                      <span>{result.elements} elements</span>
                      <span>{result.ms.toFixed(1)} ms</span>
                      <span>
                        {W}×{H}
                      </span>
                    </>
                  ) : (
                    <span>rendering…</span>
                  )}
                </div>
              </div>

              <div className="card" style={{ marginTop: 12 }}>
                <div className="card-head">
                  <Icon name="quote" size={15} className="ico" />
                  <span className="card-title">Compiled prompt</span>
                  <span style={{ flex: 1 }} />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={copyPrompt}>
                    <Icon name={copied ? 'check' : 'copy'} size={13} /> {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <div className="card-pad">
                  <div className="mono" style={{ fontSize: 11.5, lineHeight: 1.7, color: 'var(--text-dim)', wordBreak: 'break-word' }}>
                    {promptText}
                  </div>
                  <div className="row" style={{ gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
                    {palette.colors.map((c) => (
                      <span
                        key={c}
                        className="badge"
                        title={c}
                        style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}
                      >
                        <i style={{ width: 9, height: 9, borderRadius: 3, background: c, display: 'inline-block', marginRight: 5 }} />
                        {c}
                      </span>
                    ))}
                    <span className="badge">bg {palette.background}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* controls */}
            <div className="col" style={{ gap: 12 }}>
              <div className="card card-pad">
                <div className="card-title" style={{ marginBottom: 8 }}>
                  Prompt
                </div>
                <textarea
                  className="textarea"
                  rows={3}
                  value={spec.prompt}
                  placeholder="Describe the image — the renderer reads palette, mood and texture words"
                  onChange={(e) => patch({ prompt: e.target.value })}
                  style={{ minHeight: 64 }}
                />
                <input
                  className="input"
                  style={{ marginTop: 7 }}
                  placeholder="Negative prompt — words to suppress (e.g. text, borders, warm)"
                  value={spec.negative}
                  onChange={(e) => patch({ negative: e.target.value })}
                />
                <div className="row" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-sm" onClick={() => void refine()} disabled={refining}>
                    <Icon name="sparkles" size={13} /> {refining ? 'Refining…' : 'Refine with AI'}
                  </button>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                    {isRemote(settings) ? 'uses your provider' : 'on-device'}
                  </span>
                </div>
                {refining || refineText ? (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-dim)' }}>
                    <Markdown source={refineText || '…'} streaming={refining} />
                  </div>
                ) : null}
              </div>

              <div className="card card-pad">
                <div className="card-title" style={{ marginBottom: 8 }}>
                  Style
                </div>
                <div className="style-grid">
                  {ART_STYLES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="style-btn"
                      data-on={spec.style === s.id}
                      onClick={() => patch({ style: s.id })}
                      title={s.hint}
                    >
                      <strong>{s.label}</strong>
                      <em>{s.hint}</em>
                    </button>
                  ))}
                </div>
              </div>

              <div className="card card-pad">
                <div className="card-title" style={{ marginBottom: 8 }}>
                  Palette
                </div>
                <div className="palette-row">
                  {PALETTES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="palette-swatch"
                      data-on={(spec.paletteId ?? palette.id) === p.id}
                      title={p.label}
                      onClick={() => patch({ paletteId: p.id })}
                      style={{ width: 'calc(20% - 5px)' }}
                    >
                      <i>
                        {p.colors.map((c) => (
                          <span key={c} style={{ background: c }} />
                        ))}
                      </i>
                    </button>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 8 }}>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => patch({ paletteId: '' })}>
                    <Icon name="zap" size={13} /> Auto from prompt
                  </button>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                    now: {palette.label}
                  </span>
                </div>
              </div>

              <div className="card card-pad">
                <div className="card-title" style={{ marginBottom: 4 }}>
                  Parameters
                </div>
                <Slider label="Density" value={spec.density} onChange={(v) => patch({ density: v })} hint="how many elements are drawn" />
                <Slider label="Chaos" value={spec.chaos} onChange={(v) => patch({ chaos: v })} hint="noise frequency and randomness" />
                <Slider label="Glow" value={spec.glow} onChange={(v) => patch({ glow: v })} hint="additive bloom strength" />
                <Slider label="Scale" value={spec.scale} onChange={(v) => patch({ scale: v })} hint="feature size" />
                <Slider label="Grain" value={spec.grain} onChange={(v) => patch({ grain: v })} hint="film grain" />

                <label className="setting-row" style={{ padding: '7px 0' }}>
                  <span className="txt">
                    <strong style={{ fontSize: 12 }}>Seed</strong>
                    <span>same seed + same spec = identical pixels</span>
                  </span>
                  <input
                    className="input"
                    type="number"
                    value={spec.seed}
                    min={0}
                    style={{ width: 128, height: 28, fontSize: 12 }}
                    onChange={(e) => patch({ seed: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>

              {terms.length > 0 ? (
                <div className="card card-pad">
                  <div className="card-title" style={{ marginBottom: 8 }}>
                    Term weights
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', margin: '0 0 8px', lineHeight: 1.5 }}>
                    Extracted from your prompt by TF-IDF. Raising a weight biases the renderer towards that concept;
                    1.00 is neutral.
                  </p>
                  <div className="col" style={{ gap: 5 }}>
                    {terms.map((t) => {
                      const w = spec.weights[t] ?? 1;
                      return (
                        <div className="weight-row" key={t}>
                          <span className="mono" style={{ width: 92, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {t}
                          </span>
                          <input
                            className="range"
                            type="range"
                            min={0}
                            max={2}
                            step={0.05}
                            value={w}
                            onChange={(e) => patch({ weights: { ...spec.weights, [t]: Number(e.target.value) } })}
                          />
                          <span className="mono" style={{ width: 34, textAlign: 'right', color: w === 1 ? 'var(--text-faint)' : 'var(--accent)' }}>
                            {w.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
