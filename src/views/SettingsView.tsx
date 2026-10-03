import { useCallback, useEffect, useMemo, useState } from 'react';
import { ACCENT_CHOICES, THEMES, type ThemeChoice } from '../theme/themes';
import { useTheme } from '../theme/ThemeContext';
import { PROVIDER_PRESETS, probeProvider, type ProviderKind } from '../ai/providers';
import { KNOWLEDGE } from '../ai/knowledge';
import { EMBED_DIM } from '../ai/embeddings';
import { runTool } from '../ai/tools';
import { generate } from '../ai/engine';
import { store as vectorStore } from '../ai/vectorStore';
import { db, lsGet, STORE, DEFAULT_SETTINGS, type ArtworkRecord, type Settings } from '../store/db';
import { useStore } from '../store/appStore';
import { providerFrom } from '../lib/ask';
import { EVENTS, on, queuePrompt } from '../lib/bus';
import { listVoices, useSpeech, whenVoicesReady } from '../lib/speech';
import { Icon } from '../components/Icons';

/**
 * Settings.
 *
 * Four jobs: make the night mode yours, tune the on-device engine, optionally
 * hand the wheel to a frontier model, and prove that your data never left. The
 * diagnostics section runs real assertions against the live engine rather than
 * displaying static claims.
 */

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      className="switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    />
  );
}

function Row({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="setting-row">
      <span className="txt">
        <strong>{title}</strong>
        {hint ? <span>{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

function Section({
  id,
  title,
  icon,
  sub,
  children,
}: {
  id: string;
  title: string;
  icon: string;
  sub: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="card" id={id} style={{ scrollMarginTop: 12 }}>
      <div className="card-head">
        <Icon name={icon} size={15} className="ico" />
        <span className="card-title">{title}</span>
        <span className="view-sub" style={{ marginLeft: 4 }}>
          {sub}
        </span>
      </div>
      <div className="card-pad">{children}</div>
    </section>
  );
}

interface Diag {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
}

export function SettingsView(): JSX.Element {
  const store = useStore();
  const { settings, updateSettings, updateProvider, documents, conversations, indexStats } = store;
  const theme = useTheme();
  const { speak, cancel, speaking } = useSpeech(settings.speech, true);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => listVoices());
  const [probe, setProbe] = useState<{ state: 'idle' | 'run' | 'ok' | 'err'; message: string; models?: string[] }>({
    state: 'idle',
    message: '',
  });
  const [diags, setDiags] = useState<Diag[] | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  const [usage, setUsage] = useState({ bytes: 0, quota: 0 });
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    void whenVoicesReady().then(setVoices);
    return on<string>(EVENTS.settingsSection, (id) => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  useEffect(() => {
    void db.estimate().then((e) => {
      setUsage({ bytes: e?.usage ?? 0, quota: e?.quota ?? 0 });
    });
  }, [conversations.length, documents.length, settings]);

  const preset =
    settings.provider.kind === 'offline' ? null : PROVIDER_PRESETS[settings.provider.kind as keyof typeof PROVIDER_PRESETS];

  const runDiagnostics = useCallback(async () => {
    setDiagRunning(true);
    const out: Diag[] = [];
    const t = async (name: string, fn: () => Promise<string> | string) => {
      const t0 = performance.now();
      try {
        const detail = await fn();
        out.push({ name, ok: true, detail, ms: Math.round(performance.now() - t0) });
      } catch (e) {
        out.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e), ms: Math.round(performance.now() - t0) });
      }
    };

    await t('Calculator precedence', async () => {
      const r = await runTool('calculate', { expression: '2^3^2 + 20% of 150' });
      const got = String((r.data as { value?: number })?.value ?? r.summary);
      if (!got.startsWith('542')) throw new Error(`expected 542, got ${got}`);
      return `${got} — right-associative power, percent-of parsing`;
    });

    await t('Unit conversion', async () => {
      const r = await runTool('convert_units', { value: 100, from: 'km', to: 'mi' });
      if (!/62\.13/.test(r.summary)) throw new Error(r.summary);
      return r.summary;
    });

    await t('Colour science', async () => {
      const r = await runTool('convert_color', { color: '#7c8cff', to: 'oklch' });
      if (!/oklch/i.test(r.summary + (r.detail ?? ''))) throw new Error(r.summary);
      return r.summary;
    });

    await t('Static code analysis', async () => {
      const r = await runTool('code_analyze', { code: 'function f(a){ if(a){ return 1 } return 2 }' });
      if (!r.ok) throw new Error(r.error ?? 'failed');
      return r.summary;
    });

    await t(`Retrieval over ${indexStats.chunks} vectors`, () => {
      const hits = vectorStore.search('how do embeddings represent meaning', 3, undefined, 0.05);
      if (!hits.length) throw new Error('no hits above the floor');
      return `top hit "${hits[0].chunk.sourceTitle}" at ${(hits[0].score * 100).toFixed(1)}%`;
    });

    await t('Engine grounding', async () => {
      const res = await generate('What causes hallucination in large language models?', { streamDelay: 0 });
      if (res.citations.length === 0) throw new Error('answered without citing anything');
      return `${res.intent} · ${(res.confidence * 100).toFixed(0)}% confident · ${res.citations.length} citations`;
    });

    await t('Vector dimension', () => {
      if (EMBED_DIM !== 1024) throw new Error(`expected 1024, got ${EMBED_DIM}`);
      return `${EMBED_DIM}-d hashed embeddings, cosine + lexical blend`;
    });

    await t('Persistence round-trip', async () => {
      const probe: ArtworkRecord = { id: '__diagnostic__', spec: {}, promptText: 'probe', dataUrl: '', createdAt: Date.now() };
      await db.put(STORE.artworks, probe);
      const back = await db.get<ArtworkRecord>(STORE.artworks, '__diagnostic__');
      await db.delete(STORE.artworks, '__diagnostic__');
      if (!back) throw new Error('IndexedDB write → read returned nothing');
      const saved = lsGet<Partial<Settings>>('am.settings', {});
      if (!saved || typeof saved !== 'object') throw new Error('localStorage preferences unreadable');
      return `IndexedDB + localStorage writable · ${conversations.length} chats · ${documents.length} documents`;
    });

    setDiags(out);
    setDiagRunning(false);
  }, [conversations.length, documents.length, indexStats.chunks, settings]);

  const exportAll = useCallback(async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: 'Aurora Mind',
      settings,
      conversations,
      documents: documents.map((d) => ({ ...d, chunks: d.chunks.map((c) => ({ ...c, embedding: undefined })) })),
      artworks: await db.getAll(STORE.artworks),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aurora-mind-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    store.toast('ok', 'Export written', 'Embeddings are stripped from the dump to keep it readable.');
  }, [conversations, documents, settings, store]);

  const testConnection = useCallback(async () => {
    setProbe({ state: 'run', message: 'Contacting provider…' });
    const res = await probeProvider(providerFrom(settings));
    setProbe({
      state: res.ok ? 'ok' : 'err',
      message: res.message,
      models: res.models,
    });
  }, [settings]);

  const setSpeech = (patch: Partial<Settings['speech']>) => updateSettings({ speech: { ...settings.speech, ...patch } });

  const pct = useMemo(
    () => (usage.quota ? Math.min(100, (usage.bytes / usage.quota) * 100) : 0),
    [usage],
  );

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="view-title">Settings</div>
          <div className="view-sub">Appearance, engine, provider, voice and data — all stored on this device</div>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-sm" onClick={() => void runDiagnostics()} disabled={diagRunning}>
          <Icon name="gauge" size={13} /> {diagRunning ? 'Testing…' : 'Run diagnostics'}
        </button>
      </div>

      <div className="scroll">
        <div className="wrap wrap-wide settings-grid">
          {/* ── appearance ── */}
          <Section id="appearance" title="Appearance & night modes" icon="moon" sub="five looks, one of them daylight">
            <div className="theme-grid">
              {THEMES.map((t) => {
                const on = theme.choice === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    className="theme-card"
                    data-on={on}
                    onClick={() => theme.setChoice(t.id as ThemeChoice)}
                    title={t.description}
                  >
                    <span
                      className="theme-preview"
                      style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[2]}33 60%, ${t.swatch[0]})` }}
                    >
                      {t.swatch.map((c) => (
                        <i key={c} style={{ background: c }} />
                      ))}
                    </span>
                    <span className="theme-card-body">
                      <strong>{t.label}</strong>
                      <em>{t.tagline}</em>
                      <span className="theme-feats">
                        {t.features.slice(0, 3).map((f) => (
                          <span className="theme-feat" key={f}>
                            {f}
                          </span>
                        ))}
                        {on ? <span className="theme-feat" style={{ color: 'var(--accent)' }}>active</span> : null}
                      </span>
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                className="theme-card"
                data-on={theme.choice === 'auto'}
                onClick={() => theme.setChoice('auto')}
                title="Switches between Daylight and your chosen night theme at local sunrise and sunset."
              >
                <span
                  className="theme-preview"
                  style={{ background: 'linear-gradient(135deg, #f4f6fb, #4b5bd733 45%, #05060e)' }}
                >
                  <i style={{ background: '#ffd166' }} />
                  <i style={{ background: '#4b5bd7' }} />
                  <i style={{ background: '#7c8cff' }} />
                  <i style={{ background: '#05060e' }} />
                </span>
                <span className="theme-card-body">
                  <strong>Auto — follow the sun</strong>
                  <em>Daylight by day, night after sunset</em>
                  <span className="theme-feats">
                    <span className="theme-feat">
                      {theme.auto.active ? `↑ ${theme.auto.sunrise}` : 'location estimated'} ↓ {theme.auto.sunset}
                    </span>
                    <span className="theme-feat">{theme.auto.isDaylight ? 'day now' : 'night now'}</span>
                  </span>
                </span>
              </button>
            </div>

            <div style={{ marginTop: 14 }}>
              <Row
                title="Accent colour"
                hint="Overrides the theme accent everywhere — buttons, links, the activity meter, the backdrop glow."
              >
                <span className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                  {ACCENT_CHOICES.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="chip"
                      data-on={theme.accent === a.value}
                      onClick={() => theme.setAccent(a.value)}
                      title={a.label}
                    >
                      <i
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 3,
                          display: 'inline-block',
                          marginRight: 5,
                          background: a.value || 'conic-gradient(from 200deg, #5ef0c8, #7c8cff, #a86bff, #5ef0c8)',
                        }}
                      />
                      {a.label}
                    </button>
                  ))}
                </span>
              </Row>

              <Row title="Motion" hint="Reduced keeps the backdrop but slows it; Off freezes every animation and hides the canvas.">
                <span className="seg">
                  {(['full', 'reduced', 'off'] as const).map((m) => (
                    <button key={m} type="button" aria-pressed={theme.motion === m} onClick={() => theme.setMotion(m)}>
                      {m}
                    </button>
                  ))}
                </span>
              </Row>

              <Row title="Density" hint="Compact tightens spacing and type for small screens or dense reading.">
                <span className="seg">
                  {(['cosy', 'compact'] as const).map((d) => (
                    <button key={d} type="button" aria-pressed={theme.density === d} onClick={() => theme.setDensity(d)}>
                      {d}
                    </button>
                  ))}
                </span>
              </Row>

              <Row
                title="Precise location for Auto"
                hint={`Currently ${theme.auto.active ? 'using your browser location' : 'estimated from your timezone'}. Used only to compute sunrise and sunset — never stored or sent anywhere.`}
              >
                <button type="button" className="btn btn-sm" onClick={() => void theme.refineLocation()}>
                  <Icon name="globe" size={13} /> Ask the browser
                </button>
              </Row>
            </div>

            <div className="callout" data-tone="ok" style={{ marginTop: 12 }}>
              <Icon name="info" size={15} className="ico" />
              <div>
                <strong style={{ fontSize: 12.5 }}>{theme.meta.label}</strong>
                <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>{theme.meta.description}</div>
              </div>
            </div>
          </Section>

          {/* ── engine ── */}
          <Section
            id="engine"
            title="On-device engine"
            icon="cpu"
            sub={`${indexStats.chunks.toLocaleString()} vectors · ${KNOWLEDGE.length} built-in entries`}
          >
            <Row
              title="Retrieve from my documents"
              hint="Lets answers cite the files and notes you indexed. Turn it off to rely only on the built-in corpus."
            >
              <Switch
                checked={settings.engine.useDocuments}
                label="Retrieve from my documents"
                onChange={(v) => updateSettings({ engine: { ...settings.engine, useDocuments: v } })}
              />
            </Row>
            <Row title="Retrieve from the built-in corpus" hint={`${KNOWLEDGE.length} entries covering AI, this app, engineering practice and science.`}>
              <Switch
                checked={settings.engine.useKnowledge}
                label="Retrieve from the built-in corpus"
                onChange={(v) => updateSettings({ engine: { ...settings.engine, useKnowledge: v } })}
              />
            </Row>
            <Row title="Streaming speed" hint="How fast tokens are surfaced. 0 shows the whole answer at once; higher is more cinematic.">
              <input
                className="range"
                type="range"
                min={0}
                max={3}
                step={0.25}
                value={settings.engine.streamSpeed}
                style={{ width: 160 }}
                onChange={(e) => updateSettings({ engine: { ...settings.engine, streamSpeed: Number(e.target.value) } })}
              />
            </Row>
            <Row title="Reset engine settings" hint="Restores retrieval and streaming defaults. Your data is untouched.">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => updateSettings({ engine: DEFAULT_SETTINGS.engine })}
              >
                <Icon name="refresh" size={13} /> Reset
              </button>
            </Row>

            {diags ? (
              <div style={{ marginTop: 12 }}>
                <div className="card-title" style={{ marginBottom: 8 }}>
                  Diagnostics — {diags.filter((d) => d.ok).length}/{diags.length} passed
                </div>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Check</th>
                        <th>Result</th>
                        <th style={{ textAlign: 'right' }}>ms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diags.map((d) => (
                        <tr key={d.name}>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <Icon name={d.ok ? 'check' : 'x'} size={12} style={{ color: d.ok ? 'var(--ok)' : 'var(--err)', marginRight: 6 }} />
                            {d.name}
                          </td>
                          <td className="mono" style={{ fontSize: 11.5 }}>{d.detail}</td>
                          <td className="mono" style={{ textAlign: 'right', fontSize: 11.5 }}>{d.ms}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 10, lineHeight: 1.5 }}>
                Run diagnostics to execute live assertions against the calculator, unit converter, colour engine, code
                analyser, retrieval index and the grounding path — with timings.
              </p>
            )}
          </Section>

          {/* ── provider ── */}
          <Section
            id="provider"
            title="Model provider"
            icon="key"
            sub={settings.provider.kind === 'offline' ? 'on-device engine active' : `${settings.provider.kind} active`}
          >
            <Row title="Engine" hint="On-device needs no key and never makes a network call. A provider streams a frontier model instead.">
              <select
                className="select"
                value={settings.provider.kind}
                onChange={(e) => {
                  const kind = e.target.value as ProviderKind;
                  const p = kind === 'offline' ? null : PROVIDER_PRESETS[kind];
                  updateProvider({
                    kind,
                    baseUrl: p?.baseUrl ?? '',
                    model: kind === 'ollama' ? 'llama3.2' : (p?.models[0] ?? ''),
                  });
                  setProbe({ state: 'idle', message: '' });
                }}
              >
                <option value="offline">On-device engine (default, private)</option>
                {(Object.keys(PROVIDER_PRESETS) as ProviderKind[]).filter((k) => k !== 'offline').map((k) => (
                  <option key={k} value={k}>
                    {PROVIDER_PRESETS[k].label}
                  </option>
                ))}
              </select>
            </Row>

            {preset ? (
              <>
                <div className="callout" style={{ margin: '4px 0 12px' }}>
                  <Icon name="info" size={15} className="ico" />
                  <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
                    {preset.note} <span className="mono">{preset.docs}</span>
                  </div>
                </div>

                <Row
                  title="API key"
                  hint="Stored in this browser's local storage and sent only to the base URL below. Clear it any time."
                >
                  <span className="row" style={{ gap: 5 }}>
                    <input
                      className="input mono"
                      type={showKey ? 'text' : 'password'}
                      style={{ width: 220, fontSize: 11.5 }}
                      placeholder={settings.provider.kind === 'ollama' ? 'not needed' : 'sk-…'}
                      value={settings.provider.apiKey}
                      onChange={(e) => updateProvider({ apiKey: e.target.value })}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <button type="button" className="btn btn-icon" onClick={() => setShowKey((v) => !v)} title={showKey ? 'Hide' : 'Show'}>
                      <Icon name={showKey ? 'eye' : 'lock'} size={14} />
                    </button>
                  </span>
                </Row>

                <Row title="Base URL" hint="Change it to point at OpenRouter, Groq, Together, a proxy, or a local Ollama.">
                  <input
                    className="input mono"
                    style={{ width: 260, fontSize: 11.5 }}
                    value={settings.provider.baseUrl}
                    onChange={(e) => updateProvider({ baseUrl: e.target.value })}
                    placeholder={preset.baseUrl}
                    spellCheck={false}
                  />
                </Row>

                <Row title="Model" hint="Type any model id your endpoint serves.">
                  <input
                    className="input mono"
                    style={{ width: 200, fontSize: 11.5 }}
                    list="am-models"
                    value={settings.provider.model}
                    onChange={(e) => updateProvider({ model: e.target.value })}
                    placeholder={preset.models[0]}
                    spellCheck={false}
                  />
                </Row>
                <datalist id="am-models">
                  {preset.models.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>

                <Row title={`Temperature — ${settings.provider.temperature.toFixed(2)}`} hint="0 is deterministic; higher is more varied.">
                  <input
                    className="range"
                    type="range"
                    min={0}
                    max={2}
                    step={0.05}
                    style={{ width: 160 }}
                    value={settings.provider.temperature}
                    onChange={(e) => updateProvider({ temperature: Number(e.target.value) })}
                  />
                </Row>

                <Row title={`Max output tokens — ${settings.provider.maxTokens}`} hint="Caps the length of a single response.">
                  <input
                    className="range"
                    type="range"
                    min={256}
                    max={8192}
                    step={256}
                    style={{ width: 160 }}
                    value={settings.provider.maxTokens}
                    onChange={(e) => updateProvider({ maxTokens: Number(e.target.value) })}
                  />
                </Row>

                <Row title="Tool calling" hint="Lets the provider invoke the same 16 local tools the on-device engine uses.">
                  <Switch checked={settings.provider.useTools} label="Tool calling" onChange={(v) => updateProvider({ useTools: v })} />
                </Row>

                <Row title="Ground in my knowledge base" hint="Injects the top 5 retrieved passages into the system prompt and cites them.">
                  <Switch
                    checked={settings.provider.groundWithRetrieval}
                    label="Ground in my knowledge base"
                    onChange={(v) => updateProvider({ groundWithRetrieval: v })}
                  />
                </Row>

                <div style={{ marginTop: 10 }}>
                  <label className="card-title" htmlFor="sysprompt" style={{ display: 'block', marginBottom: 6 }}>
                    System prompt
                  </label>
                  <textarea
                    id="sysprompt"
                    className="textarea"
                    rows={4}
                    placeholder="Optional. Describes how the model should behave; retrieval context is appended automatically."
                    value={settings.provider.systemPrompt}
                    onChange={(e) => updateProvider({ systemPrompt: e.target.value })}
                  />
                </div>

                <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => void testConnection()} disabled={probe.state === 'run'}>
                    <Icon name="bolt" size={13} /> {probe.state === 'run' ? 'Testing…' : 'Test connection'}
                  </button>
                  {probe.state === 'ok' || probe.state === 'err' ? (
                    <span className="badge" data-tone={probe.state === 'ok' ? 'ok' : 'err'}>
                      {probe.message}
                    </span>
                  ) : null}
                </div>
                {probe.models?.length ? (
                  <div className="row" style={{ gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                    {probe.models.slice(0, 14).map((m) => (
                      <button key={m} type="button" className="chip" onClick={() => updateProvider({ model: m })}>
                        {m}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="callout" data-tone="ok" style={{ marginTop: 4 }}>
                <Icon name="lock" size={15} className="ico" />
                <div style={{ fontSize: 11.5, lineHeight: 1.55 }}>
                  <strong style={{ fontSize: 12.5 }}>Fully local.</strong> The on-device engine parses intent, retrieves
                  from your index, calls tools and composes answers without a single network request. Pick a provider
                  above only if you want a frontier model — and your key stays in this browser.
                </div>
              </div>
            )}
          </Section>

          {/* ── voice ── */}
          <Section id="voice" title="Voice" icon="mic" sub="Web Speech API — optional">
            <Row title="Enable voice" hint="Adds a microphone button to the composer and a read-aloud button to answers.">
              <Switch checked={settings.speech.enabled} label="Enable voice" onChange={(v) => setSpeech({ enabled: v })} />
            </Row>
            <Row title={`Rate — ${settings.speech.rate.toFixed(2)}×`} hint="Speaking speed for read-aloud.">
              <input
                className="range"
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                style={{ width: 160 }}
                value={settings.speech.rate}
                onChange={(e) => setSpeech({ rate: Number(e.target.value) })}
              />
            </Row>
            <Row title={`Pitch — ${settings.speech.pitch.toFixed(2)}`} hint="Voice pitch for read-aloud.">
              <input
                className="range"
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                style={{ width: 160 }}
                value={settings.speech.pitch}
                onChange={(e) => setSpeech({ pitch: Number(e.target.value) })}
              />
            </Row>
            <Row title="Voice" hint={`${voices.length} installed on this system. Leave empty for the browser default.`}>
              <select
                className="select"
                style={{ maxWidth: 240 }}
                value={settings.speech.voiceName}
                onChange={(e) => setSpeech({ voiceName: e.target.value })}
              >
                <option value="">System default</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </Row>
            <Row title="Test" hint="Speaks a sentence with the current settings.">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  if (speaking) {
                    cancel();
                    return;
                  }
                  speak('Aurora Mind. Voice output is working, and every word you hear was generated on this device.');
                }}
              >
                <Icon name={speaking ? 'stop' : 'volume'} size={13} /> {speaking ? 'Stop' : 'Speak'}
              </button>
            </Row>
            <p style={{ fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5, marginTop: 8 }}>
              Dictation needs Chrome or Edge and microphone permission; audio is processed by your browser's speech
              service, not by this app. Read-aloud uses the voices installed on your operating system.
            </p>
          </Section>

          {/* ── data ── */}
          <Section id="data" title="Data & privacy" icon="shield" sub="everything lives in this browser">
            <div className="grid grid-4" style={{ marginBottom: 12 }}>
              <div className="kpi">
                <div className="kpi-value">{conversations.length}</div>
                <div className="kpi-label">conversations</div>
              </div>
              <div className="kpi">
                <div className="kpi-value">{documents.length}</div>
                <div className="kpi-label">sources</div>
              </div>
              <div className="kpi">
                <div className="kpi-value">{indexStats.chunks.toLocaleString()}</div>
                <div className="kpi-label">vectors</div>
              </div>
              <div className="kpi">
                <div className="kpi-value">{(usage.bytes / 1024 / 1024).toFixed(2)} MB</div>
                <div className="kpi-label">
                  {usage.quota ? `${pct.toFixed(2)}% of quota` : 'in IndexedDB'}
                </div>
              </div>
            </div>

            {usage.quota ? (
              <div className="progress" style={{ marginBottom: 12 }}>
                <i style={{ width: `${pct}%` }} />
              </div>
            ) : null}

            <Row title="Export everything" hint="One JSON file: settings, conversations, documents and saved renders.">
              <button type="button" className="btn btn-sm" onClick={() => void exportAll()}>
                <Icon name="download" size={13} /> Export JSON
              </button>
            </Row>

            <Row title="Ask the engine about your data" hint="Opens chat with a grounded question about storage and privacy.">
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  store.newConversation('Where is my data stored?');
                  queuePrompt('Where exactly is my data stored, what leaves this device, and how do I delete it all?');
                }}
              >
                <Icon name="chat" size={13} /> Ask in chat
              </button>
            </Row>

            <Row
              title="Erase everything"
              hint="Deletes conversations, documents, vectors, saved renders and preferences from this browser. Cannot be undone."
            >
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => {
                  if (window.confirm('Erase all conversations, documents, renders and settings from this browser?')) {
                    void store.wipe();
                    setDiags(null);
                  }
                }}
              >
                <Icon name="trash" size={13} /> Erase everything
              </button>
            </Row>

            <div className="callout" data-tone="ok" style={{ marginTop: 12 }}>
              <Icon name="lock" size={15} className="ico" />
              <div style={{ fontSize: 11.5, lineHeight: 1.55 }}>
                Conversations, embeddings and settings are written to IndexedDB and localStorage under this origin.
                Nothing is sent to any server unless you configure a provider key — and then only your prompt, the
                retrieved context and the conversation history go to the base URL you chose.
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
