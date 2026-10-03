import { useCallback, useEffect, useMemo, useState } from 'react';
import { AGENT_EXAMPLES } from '../ai/agent';
import { ART_STYLES } from '../ai/art';
import { db, STORE, type ArtworkRecord, type DocRecord } from '../store/db';
import { useStore, type ViewId } from '../store/appStore';
import { EVENTS, emit, on } from '../lib/bus';
import { Icon } from './Icons';

/**
 * Contextual side panel.
 *
 * One column, six different jobs: conversation history in Chat, the indexed
 * corpus in Documents, snippet examples in Code Lab, saved renders in Studio,
 * agent blueprints in Agents, and section navigation in Settings. It collapses
 * entirely — the main surface is the product, not the chrome.
 */

const PANEL_TITLES: Record<ViewId, string> = {
  chat: 'Conversations',
  documents: 'Knowledge base',
  codelab: 'Examples',
  studio: 'Gallery',
  agents: 'Blueprints',
  settings: 'Settings',
};

function kb(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function relTime(ts: number): string {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ─────────────────────────── chat panel ─────────────────────────── */

function ConversationPanel(): JSX.Element {
  const store = useStore();
  const [query, setQuery] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...store.conversations].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [store.conversations, query]);

  const download = useCallback(
    (id: string, format: 'md' | 'json') => {
      const text = store.exportConversation(id, format);
      const conv = store.conversations.find((c) => c.id === id);
      const safe = (conv?.title ?? 'conversation').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase();
      const blob = new Blob([text], { type: format === 'md' ? 'text/markdown' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safe || 'conversation'}.${format === 'md' ? 'md' : 'json'}`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    [store],
  );

  return (
    <>
      <div style={{ padding: '0 2px 8px' }}>
        <div className="row" style={{ gap: 6 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Icon
              name="search"
              size={13}
              style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}
            />
            <input
              className="input"
              style={{ paddingLeft: 27, height: 30, fontSize: 12 }}
              placeholder="Search conversations"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-icon"
            title="New conversation"
            onClick={() => store.newConversation()}
          >
            <Icon name="plus" size={15} />
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          <Icon name="chat" className="ico" />
          <strong>{query ? 'No matches' : 'No conversations yet'}</strong>
          <p>{query ? 'Try a different word.' : 'Start one and it is saved to this browser automatically.'}</p>
        </div>
      ) : (
        list.map((c) => {
          const current = store.active?.id === c.id;
          const last = c.messages[c.messages.length - 1];
          return (
            <div
              key={c.id}
              className="conv-row"
              role="button"
              tabIndex={0}
              aria-current={current}
              onClick={() => store.selectConversation(c.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  store.selectConversation(c.id);
                }
              }}
            >
              <span className="conv-main">
                {renaming === c.id ? (
                  <input
                    className="input"
                    style={{ height: 26, fontSize: 12, padding: '2px 6px' }}
                    value={draft}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={() => {
                      if (draft.trim()) store.renameConversation(c.id, draft.trim());
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && draft.trim()) store.renameConversation(c.id, draft.trim());
                      if (e.key === 'Escape') setRenaming(null);
                      if (e.key === 'Enter' || e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <>
                    <span className="conv-title">
                      {c.pinned ? <Icon name="pin" size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : null}
                      {c.title}
                    </span>
                    <span className="conv-meta">
                      {c.messages.length} msg · {relTime(c.updatedAt)}
                      {last ? ` · ${last.content.slice(0, 34).replace(/\n/g, ' ')}` : ''}
                    </span>
                  </>
                )}
              </span>
              <span className="conv-actions" onClick={(e) => e.stopPropagation()} role="presentation">
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ width: 24, height: 24 }}
                  title={c.pinned ? 'Unpin' : 'Pin'}
                  onClick={() => store.togglePin(c.id)}
                >
                  <Icon name="pin" size={12} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ width: 24, height: 24 }}
                  title="Export as Markdown"
                  onClick={() => download(c.id, 'md')}
                >
                  <Icon name="download" size={12} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ width: 24, height: 24 }}
                  title="Rename"
                  onClick={() => {
                    setRenaming(c.id);
                    setDraft(c.title);
                  }}
                >
                  <Icon name="edit" size={12} />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  style={{ width: 24, height: 24, color: 'var(--err)' }}
                  title="Delete conversation"
                  onClick={() => {
                    if (window.confirm(`Delete "${c.title}"? This cannot be undone.`)) store.deleteConversation(c.id);
                  }}
                >
                  <Icon name="trash" size={12} />
                </button>
              </span>
            </div>
          );
        })
      )}
    </>
  );
}

/* ─────────────────────── documents panel ─────────────────────── */

function DocumentPanel(): JSX.Element {
  const store = useStore();
  const [noteOpen, setNoteOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const totalChars = store.documents.reduce((n, d) => n + d.chars, 0);
  const totalChunks = store.documents.reduce((n, d) => n + d.chunks.length, 0);

  const save = async () => {
    if (!body.trim()) {
      store.toast('warn', 'Nothing to save', 'Type or paste some text first.');
      return;
    }
    await store.addNote(title.trim() || 'Untitled note', body);
    setTitle('');
    setBody('');
    setNoteOpen(false);
  };

  return (
    <>
      <div style={{ padding: '0 2px 8px', display: 'flex', gap: 6 }}>
        <button type="button" className="btn btn-sm btn-block" onClick={() => setNoteOpen((v) => !v)}>
          <Icon name="plus" size={13} /> Note
        </button>
        <button
          type="button"
          className="btn btn-sm btn-block"
          onClick={() => emit(EVENTS.docFocus, 'upload')}
        >
          <Icon name="upload" size={13} /> Files
        </button>
      </div>

      {noteOpen ? (
        <div className="card card-pad" style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            className="input"
            placeholder="Note title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ height: 30, fontSize: 12 }}
          />
          <textarea
            className="textarea"
            placeholder="Paste text to embed and cite…"
            value={body}
            rows={5}
            onChange={(e) => setBody(e.target.value)}
            style={{ minHeight: 90 }}
          />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setNoteOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => void save()}>
              <Icon name="save" size={13} /> Index
            </button>
          </div>
        </div>
      ) : null}

      <div className="kpi" style={{ marginBottom: 8 }}>
        <div className="kpi-value">{totalChunks.toLocaleString()}</div>
        <div className="kpi-label">
          vectors · {store.documents.length} sources · {kb(totalChars)}
        </div>
      </div>

      {store.documents.length === 0 ? (
        <div className="empty">
          <Icon name="doc" className="ico" />
          <strong>Empty corpus</strong>
          <p>Add files or notes and the app embeds them locally — then answers cite these passages.</p>
        </div>
      ) : (
        store.documents.map((d: DocRecord) => (
          <div key={d.id} className="conv-row" style={{ cursor: 'default' }}>
            <span className="toolcard-icon" style={{ marginTop: 1 }}>
              <Icon name={d.kind === 'note' ? 'quote' : 'doc'} size={12} />
            </span>
            <span className="conv-main">
              <span className="conv-title">{d.title}</span>
              <span className="conv-meta">
                {d.chunks.length} chunks · {kb(d.chars)} · {relTime(d.addedAt)}
              </span>
            </span>
            <span className="conv-actions" style={{ opacity: 1 }}>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 24, height: 24, color: 'var(--err)' }}
                title="Remove from index"
                onClick={() => void store.removeDocument(d.id)}
              >
                <Icon name="trash" size={12} />
              </button>
            </span>
          </div>
        ))
      )}
    </>
  );
}

/* ─────────────────────── code lab panel ─────────────────────── */

const CODE_SAMPLES: Array<{ label: string; lang: string; code: string }> = [
  {
    label: 'TypeScript — React hook',
    lang: 'typescript',
    code: `import { useEffect, useState } from 'react';\n\nexport function useDebounced<T>(value: T, delay = 300): T {\n  const [debounced, setDebounced] = useState(value);\n\n  useEffect(() => {\n    const id = setTimeout(() => setDebounced(value), delay);\n    return () => clearTimeout(id);\n  }, [value, delay]);\n\n  return debounced;\n}\n`,
  },
  {
    label: 'Python — data pipeline',
    lang: 'python',
    code: `from collections import Counter\nimport re\n\nTOKEN = re.compile(r"[a-z]+")\n\n\ndef top_terms(text: str, k: int = 10) -> list[tuple[str, int]]:\n    """Return the k most frequent lowercase words in text."""\n    counts = Counter(TOKEN.findall(text.lower()))\n    return counts.most_common(k)\n\n\nif __name__ == "__main__":\n    for term, n in top_terms("the quick brown fox jumps over the lazy dog the end"):\n        print(f"{term}: {n}")\n`,
  },
  {
    label: 'JavaScript — fetch with retry',
    lang: 'javascript',
    code: `async function fetchWithRetry(url, { retries = 3, backoff = 250 } = {}) {\n  for (let attempt = 0; attempt <= retries; attempt++) {\n    try {\n      const res = await fetch(url);\n      if (!res.ok) throw new Error('HTTP ' + res.status);\n      return await res.json();\n    } catch (err) {\n      if (attempt === retries) throw err;\n      await new Promise((r) => setTimeout(r, backoff * 2 ** attempt));\n    }\n  }\n}\n`,
  },
  {
    label: 'Go — worker pool',
    lang: 'go',
    code: `package main\n\nimport (\n\t"fmt"\n\t"sync"\n)\n\nfunc worker(id int, jobs <-chan int, results chan<- int, wg *sync.WaitGroup) {\n\tdefer wg.Done()\n\tfor j := range jobs {\n\t\tresults <- j * 2\n\t}\n}\n\nfunc main() {\n\tjobs := make(chan int, 100)\n\tresults := make(chan int, 100)\n\tvar wg sync.WaitGroup\n\n\tfor w := 1; w <= 3; w++ {\n\t\twg.Add(1)\n\t\tgo worker(w, jobs, results, &wg)\n\t}\n\n\tfor j := 1; j <= 9; j++ {\n\t\tjobs <- j\n\t}\n\tclose(jobs)\n\tgo func() { wg.Wait(); close(results) }()\n\n\tfor r := range results {\n\t\tfmt.Println(r)\n\t}\n}\n`,
  },
  {
    label: 'SQL — window aggregate',
    lang: 'sql',
    code: `SELECT\n  customer_id,\n  order_date,\n  total,\n  SUM(total) OVER (PARTITION BY customer_id ORDER BY order_date) AS running_total,\n  RANK() OVER (PARTITION BY customer_id ORDER BY total DESC) AS spend_rank\nFROM orders\nWHERE order_date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '90 days'\nORDER BY customer_id, order_date;\n`,
  },
  {
    label: 'Rust — trait + iterator',
    lang: 'rust',
    code: `pub trait Shape {\n    fn area(&self) -> f64;\n    fn name(&self) -> &'static str;\n}\n\npub struct Circle { pub r: f64 }\n\nimpl Shape for Circle {\n    fn area(&self) -> f64 { std::f64::consts::PI * self.r * self.r }\n    fn name(&self) -> &'static str { "circle" }\n}\n\npub fn largest<'a, S: Shape>(shapes: &'a [S]) -> Option<&'a S> {\n    shapes.iter().max_by(|a, b| a.area().partial_cmp(&b.area()).unwrap())\n}\n`,
  },
];

function CodePanel(): JSX.Element {
  return (
    <>
      <p style={{ fontSize: 11.5, color: 'var(--text-faint)', padding: '0 4px 8px', lineHeight: 1.5 }}>
        Load an example, or open one of your indexed text files. Analysis runs locally — the code never leaves the tab.
      </p>
      {CODE_SAMPLES.map((s) => (
        <button
          key={s.label}
          type="button"
          className="conv-row"
          onClick={() => emit(EVENTS.codeSample, s)}
        >
          <span className="toolcard-icon" style={{ marginTop: 1 }}>
            <Icon name="braces" size={12} />
          </span>
          <span className="conv-main">
            <span className="conv-title">{s.label}</span>
            <span className="conv-meta">{s.code.split('\n').length} lines · {s.lang}</span>
          </span>
        </button>
      ))}
      <div className="panel-title" style={{ padding: '14px 4px 6px' }}>
        From your corpus
      </div>
      <CodeFileList />
    </>
  );
}

function CodeFileList(): JSX.Element {
  const store = useStore();
  const files = useMemo(
    () =>
      store.documents
        .filter((d) => /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|css|html|sql|sh|rb|php|json|ya?ml|xml)$/i.test(d.title))
        .slice(0, 20),
    [store.documents],
  );

  if (files.length === 0) {
    return (
      <p style={{ fontSize: 11.5, color: 'var(--text-faint)', padding: '0 4px' }}>
        No code files indexed yet — attach them from the Documents view.
      </p>
    );
  }

  return (
    <>
      {files.map((f) => (
        <button
          key={f.id}
          type="button"
          className="conv-row"
          onClick={() => emit(EVENTS.codeFile, f)}
        >
          <span className="toolcard-icon" style={{ marginTop: 1 }}>
            <Icon name="code" size={12} />
          </span>
          <span className="conv-main">
            <span className="conv-title">{f.title}</span>
            <span className="conv-meta">{kb(f.chars)}</span>
          </span>
        </button>
      ))}
    </>
  );
}

/* ─────────────────────── studio panel ─────────────────────── */

function StudioPanel(): JSX.Element {
  const [art, setArt] = useState<ArtworkRecord[]>([]);

  const load = useCallback(() => {
    void db.getAll<ArtworkRecord>(STORE.artworks).then((rows) => {
      setArt(rows.sort((a, b) => b.createdAt - a.createdAt));
    });
  }, []);

  useEffect(() => {
    load();
    return on(EVENTS.artChanged, load);
  }, [load]);

  return (
    <>
      <div className="panel-title" style={{ padding: '2px 4px 6px' }}>
        Styles
      </div>
      {ART_STYLES.map((s) => (
        <button key={s.id} type="button" className="conv-row" onClick={() => emit('am:art-style', s.id)}>
          <span className="toolcard-icon" style={{ marginTop: 1 }}>
            <Icon name="palette" size={12} />
          </span>
          <span className="conv-main">
            <span className="conv-title">{s.label}</span>
            <span className="conv-meta">{s.hint}</span>
          </span>
        </button>
      ))}

      <div className="panel-title" style={{ padding: '14px 4px 6px' }}>
        Saved renders · {art.length}
      </div>
      {art.length === 0 ? (
        <p style={{ fontSize: 11.5, color: 'var(--text-faint)', padding: '0 4px' }}>
          Nothing saved yet. Render a prompt in Studio and save it — the PNG is stored in this browser.
        </p>
      ) : (
        art.map((a) => (
          <div key={a.id} className="conv-row" style={{ cursor: 'default' }}>
            <img
              src={a.dataUrl}
              alt=""
              style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', flex: 'none', border: '1px solid var(--border)' }}
            />
            <span className="conv-main">
              <span className="conv-title">{a.promptText.slice(0, 44) || 'Untitled'}</span>
              <span className="conv-meta">{relTime(a.createdAt)}</span>
            </span>
            <span className="conv-actions" style={{ opacity: 1 }}>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 24, height: 24 }}
                title="Open in studio"
                onClick={() => emit(EVENTS.artOpen, a)}
              >
                <Icon name="external" size={12} />
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                style={{ width: 24, height: 24, color: 'var(--err)' }}
                title="Delete render"
                onClick={() => {
                  void db.delete(STORE.artworks, a.id).then(load);
                }}
              >
                <Icon name="trash" size={12} />
              </button>
            </span>
          </div>
        ))
      )}
    </>
  );
}

/* ─────────────────────── agents panel ─────────────────────── */

function AgentPanel(): JSX.Element {
  return (
    <>
      <p style={{ fontSize: 11.5, color: 'var(--text-faint)', padding: '0 4px 8px', lineHeight: 1.5 }}>
        An agent decomposes a goal into steps, runs the tools each step needs, and writes a report from the evidence it
        actually collected.
      </p>
      {AGENT_EXAMPLES.map((ex) => (
        <button key={ex.label} type="button" className="conv-row" onClick={() => emit(EVENTS.agentGoal, ex)}>
          <span className="toolcard-icon" style={{ marginTop: 1 }}>
            <Icon name="bot" size={12} />
          </span>
          <span className="conv-main">
            <span className="conv-title">{ex.label}</span>
            <span className="conv-meta">{ex.goal.slice(0, 62).replace(/\s+/g, ' ')}…</span>
          </span>
        </button>
      ))}
    </>
  );
}

/* ─────────────────────── settings panel ─────────────────────── */

const SETTINGS_SECTIONS = [
  { id: 'appearance', label: 'Appearance & night modes', icon: 'moon' },
  { id: 'engine', label: 'On-device engine', icon: 'cpu' },
  { id: 'provider', label: 'Model provider & API key', icon: 'key' },
  { id: 'voice', label: 'Voice', icon: 'mic' },
  { id: 'data', label: 'Data & privacy', icon: 'shield' },
];

function SettingsPanel(): JSX.Element {
  return (
    <>
      {SETTINGS_SECTIONS.map((s) => (
        <button
          key={s.id}
          type="button"
          className="conv-row"
          onClick={() => emit(EVENTS.settingsSection, s.id)}
        >
          <span className="toolcard-icon" style={{ marginTop: 1 }}>
            <Icon name={s.icon} size={12} />
          </span>
          <span className="conv-main">
            <span className="conv-title">{s.label}</span>
          </span>
        </button>
      ))}
    </>
  );
}

/* ─────────────────────── shell ─────────────────────── */

export function Sidebar(): JSX.Element {
  const store = useStore();
  const { view, panelOpen, setPanelOpen, conversations, documents } = store;

  const count =
    view === 'chat' ? conversations.length : view === 'documents' ? documents.length : undefined;

  return (
    <aside className="panel" data-open={panelOpen} aria-hidden={!panelOpen}>
      <div className="panel-head">
        <span className="panel-title">{PANEL_TITLES[view]}</span>
        {count !== undefined ? (
          <span className="badge" data-tone="info">
            {count}
          </span>
        ) : null}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          style={{ width: 26, height: 26 }}
          title="Collapse panel"
          onClick={() => setPanelOpen(false)}
        >
          <Icon name="chevL" size={14} />
        </button>
      </div>

      <div className="panel-body">
        {view === 'chat' ? <ConversationPanel /> : null}
        {view === 'documents' ? <DocumentPanel /> : null}
        {view === 'codelab' ? <CodePanel /> : null}
        {view === 'studio' ? <StudioPanel /> : null}
        {view === 'agents' ? <AgentPanel /> : null}
        {view === 'settings' ? <SettingsPanel /> : null}
      </div>

      <div className="panel-foot">
        {view === 'chat' ? (
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-danger btn-block"
            onClick={() => {
              if (window.confirm('Delete every conversation on this device?')) void store.clearConversations();
            }}
          >
            <Icon name="trash" size={13} /> Clear all conversations
          </button>
        ) : (
          <span className="mono" style={{ fontSize: 10.5 }}>
            stored locally · IndexedDB
          </span>
        )}
      </div>
    </aside>
  );
}
