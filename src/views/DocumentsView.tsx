import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KNOWLEDGE } from '../ai/knowledge';
import { KNOWLEDGE_PACK } from '../ai/pack';
import { EMBED_DIM } from '../ai/embeddings';
import { store as vectorStore, type Hit } from '../ai/vectorStore';
import { useStore } from '../store/appStore';
import type { DocRecord } from '../store/db';
import { EVENTS, on, queuePrompt } from '../lib/bus';
import { Icon } from '../components/Icons';
import { Markdown } from '../components/Markdown';

/**
 * Documents — the retrieval layer.
 *
 * Files are chunked and embedded *here*, in the tab, with a 1024-dimension
 * hashed vector. The retrieval tester below is the honest way to inspect that
 * work: type a question and see the exact passages the engine would cite, with
 * their semantic and lexical scores.
 */

const ACCEPT = '.txt,.md,.markdown,.csv,.tsv,.json,.log,.py,.js,.ts,.tsx,.jsx,.css,.html,.xml,.yml,.yaml,.sql,.sh,.c,.cpp,.h,.java,.go,.rs,.rb,.php,text/*';

function kb(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function ScoreBar({ hit }: { hit: Hit }): JSX.Element {
  const total = Math.max(0.0001, hit.score);
  const semShare = hit.semantic / (hit.semantic + hit.lexical || 1);
  return (
    <div className="progress" title={`semantic ${(hit.semantic * 100).toFixed(1)}% · lexical ${(hit.lexical * 100).toFixed(1)}%`}>
      <i style={{ width: `${Math.min(100, total * 100)}%` }}>
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${semShare * 100}%`,
            background: 'var(--accent)',
            opacity: 0.85,
          }}
        />
      </i>
    </div>
  );
}

export function DocumentsView(): JSX.Element {
  const store = useStore();
  const { documents, indexStats, settings } = store;

  const [over, setOver] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  /* ingest */
  const ingest = useCallback(
    (files: FileList | File[]) => {
      void (async () => {
        const res = await store.addFiles(files);
        if (res.added > 0) {
          store.toast('ok', `Indexed ${res.added} file${res.added === 1 ? '' : 's'}`, 'Chunked, embedded and searchable.');
        }
        if (res.failed > 0) {
          store.toast(
            'warn',
            `${res.failed} file${res.failed === 1 ? '' : 's'} could not be read`,
            'PDF, Word and other binary formats cannot be parsed in the browser — open them, copy the text, and paste it into a note instead.',
          );
        }
      })();
    },
    [store],
  );

  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setOver(false);
      if (e.dataTransfer?.files?.length) ingest(e.dataTransfer.files);
    };
    const onOver = (e: DragEvent) => {
      e.preventDefault();
      setOver(true);
    };
    const onLeave = () => setOver(false);
    el.addEventListener('drop', onDrop);
    el.addEventListener('dragover', onOver);
    el.addEventListener('dragleave', onLeave);
    return () => {
      el.removeEventListener('drop', onDrop);
      el.removeEventListener('dragover', onOver);
      el.removeEventListener('dragleave', onLeave);
    };
  }, [ingest]);

  // The rail / sidebar "Files" button focuses this page's picker.
  useEffect(() => on(EVENTS.docFocus, () => input.current?.click()), []);

  /* retrieval tester */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(() => {
      const found = vectorStore.search(q, 8, undefined, 0.03);
      setHits(found);
      setSearching(false);
    }, 110);
    return () => window.clearTimeout(t);
  }, [query]);

  const totals = useMemo(() => {
    const chars = documents.reduce((n, d) => n + d.chars, 0);
    const chunks = documents.reduce((n, d) => n + d.chunks.length, 0);
    const words = documents.reduce((n, d) => n + d.text.split(/\s+/).filter(Boolean).length, 0);
    return { chars, chunks, words };
  }, [documents]);

  const addNote = async () => {
    if (!noteBody.trim()) {
      store.toast('warn', 'Nothing to index', 'Paste or type some text first.');
      return;
    }
    await store.addNote(noteTitle.trim() || 'Untitled note', noteBody);
    setNoteBody('');
    setNoteTitle('');
    store.toast('ok', 'Note indexed', 'It can now be cited by the chat engine.');
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="view-title">Knowledge base</div>
          <div className="view-sub">
            Chunked, embedded and indexed on this device · {EMBED_DIM}-dimensional vectors · hybrid semantic + lexical
            retrieval
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}>
          <Icon name="upload" size={14} /> Index files
        </button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void addNote()}>
          <Icon name="plus" size={14} /> Add note
        </button>
      </div>

      <input
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) ingest(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="scroll">
        <div className="wrap wrap-wide">
          <div className="grid grid-4" style={{ marginBottom: 14 }}>
            <div className="kpi">
              <div className="kpi-value">{documents.length}</div>
              <div className="kpi-label">your sources</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">{totals.chunks.toLocaleString()}</div>
              <div className="kpi-label">your chunks</div>
            </div>
            <div className="kpi">
              <div className="kpi-value">{indexStats.chunks.toLocaleString()}</div>
              <div className="kpi-label">
                vectors total ({indexStats.sources} incl. {KNOWLEDGE.length + (settings.engine.extendedPack ? KNOWLEDGE_PACK.length : 0)} built-in)
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-value">{kb(totals.chars)}</div>
              <div className="kpi-label">{totals.words.toLocaleString()} words</div>
            </div>
          </div>

          <div className="grid grid-2">
            {/* ingest */}
            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="card-title">Add to the corpus</div>

              <div
                ref={dropRef}
                className="dropzone"
                data-over={over}
                onClick={() => input.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') input.current?.click();
                }}
              >
                <Icon name="upload" className="ico" />
                <div style={{ fontSize: 13, fontWeight: 560 }}>Drop files here, or click to browse</div>
                <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--text-faint)' }}>
                  .txt, .md, .csv, .json, source code — up to 8 MB each. Text only: PDFs and Office files cannot be
                  decoded in a browser tab.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <input
                  className="input"
                  placeholder="Note title (optional)"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                />
                <textarea
                  className="textarea"
                  placeholder="Or paste text directly — meeting notes, a spec, an article…"
                  value={noteBody}
                  rows={6}
                  onChange={(e) => setNoteBody(e.target.value)}
                />
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                    {noteBody.trim() ? `${noteBody.trim().split(/\s+/).length} words · ~${Math.ceil(noteBody.length / 760)} chunks` : 'nothing to index yet'}
                  </span>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => void addNote()} disabled={!noteBody.trim()}>
                    <Icon name="db" size={13} /> Embed &amp; index
                  </button>
                </div>
              </div>
            </div>

            {/* retrieval tester */}
            <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="card-title">Retrieval tester</div>
              <p style={{ fontSize: 11.5, color: 'var(--text-faint)', lineHeight: 1.5, margin: 0 }}>
                Run the exact search the chat engine runs. Scores below 0.20 are treated as irrelevant and the engine
                says so instead of inventing an answer.
              </p>
              <div style={{ position: 'relative' }}>
                <Icon
                  name="search"
                  size={14}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}
                />
                <input
                  className="input"
                  style={{ paddingLeft: 30 }}
                  placeholder="e.g. how does quantisation reduce memory use?"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                {searching ? (
                  <div className="empty">
                    <Icon name="gauge" className="ico" />
                    <strong>Embedding query…</strong>
                  </div>
                ) : hits.length === 0 ? (
                  <div className="empty">
                    <Icon name="db" className="ico" />
                    <strong>{query.trim() ? 'No passage cleared the floor' : 'Type a question'}</strong>
                    <p>
                      {query.trim()
                        ? 'Nothing in the corpus is relevant enough to cite. The engine would decline rather than guess.'
                        : 'Results appear as you type, ranked by blended semantic and lexical similarity.'}
                    </p>
                  </div>
                ) : (
                  hits.map((h, i) => (
                    <div key={h.chunk.id} className="doc-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
                      <div className="row" style={{ gap: 7 }}>
                        <span className="cite-num">{i + 1}</span>
                        <span className="doc-name" style={{ flex: 1 }}>
                          {h.chunk.sourceTitle}
                        </span>
                        <span className="badge" data-tone={h.score >= 0.6 ? 'ok' : h.score >= 0.35 ? 'warn' : 'err'}>
                          {(h.score * 100).toFixed(1)}%
                        </span>
                      </div>
                      <ScoreBar hit={h} />
                      <div style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                        {h.chunk.text.length > 260 ? `${h.chunk.text.slice(0, 260)}…` : h.chunk.text}
                      </div>
                      <div className="mono" style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>
                        chunk {h.chunk.index} · {h.chunk.tokens} tok · sem {(h.semantic * 100).toFixed(0)}% · lex{' '}
                        {(h.lexical * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* corpus */}
          <div className="card" style={{ marginTop: 14 }}>
            <div className="card-head">
              <Icon name="doc" size={15} className="ico" />
              <span className="card-title">Indexed sources</span>
              <span className="badge" data-tone="info">{documents.length}</span>
              <span style={{ flex: 1 }} />
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                stored in IndexedDB · embeddings persisted, never recomputed on reload
              </span>
            </div>
            <div className="card-pad">
              {documents.length === 0 ? (
                <div className="empty">
                  <Icon name="doc" className="ico" />
                  <strong>No documents yet</strong>
                  <p>
                    Drop a text file above. Until then, chat answers draw on the {KNOWLEDGE.length + (settings.engine.extendedPack ? KNOWLEDGE_PACK.length : 0)} built-in knowledge
                    entries and the live tools.
                  </p>
                </div>
              ) : (
                documents.map((d: DocRecord) => {
                  const open = expanded === d.id;
                  return (
                    <div key={d.id}>
                      <div className="doc-row" aria-current={open} style={{ cursor: 'pointer' }} onClick={() => setExpanded(open ? null : d.id)}>
                        <span className="doc-icon">
                          <Icon name={d.kind === 'note' ? 'quote' : 'doc'} size={15} />
                        </span>
                        <span className="doc-info">
                          <span className="doc-name">{d.title}</span>
                          <span className="doc-meta">
                            {d.chunks.length} chunks · {kb(d.chars)} ·{' '}
                            {new Date(d.addedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            store.newConversation(`About ${d.title}`);
                            queuePrompt(`Using only my indexed documents, summarise the key points of "${d.title}" and cite the passages you used.`);
                          }}
                          title="Ask the engine about this document"
                        >
                          <Icon name="chat" size={13} /> Ask
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          style={{ color: 'var(--err)' }}
                          title="Remove and drop its vectors"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Remove "${d.title}" from the index?`)) void store.removeDocument(d.id);
                          }}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                        <Icon
                          name="chevR"
                          size={13}
                          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 160ms', opacity: 0.6 }}
                        />
                      </div>
                      {open ? (
                        <div style={{ padding: '2px 6px 14px 46px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                            {d.chunks.length} chunks · first {Math.min(3, d.chunks.length)} shown
                          </div>
                          {d.chunks.slice(0, 3).map((c, i) => (
                            <div key={`${d.id}-chunk-${i}`} className="card card-pad" style={{ background: 'var(--surface-2)' }}>
                              <div className="mono" style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 5 }}>
                                chunk #{i} · {c.text.length} chars · vector {EMBED_DIM}-d
                              </div>
                              <Markdown source={c.text.length > 700 ? `${c.text.slice(0, 700)}…` : c.text} />
                            </div>
                          ))}
                          <details className="card card-pad" style={{ background: 'var(--surface-2)' }}>
                            <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-dim)' }}>
                              Full text ({kb(d.chars)})
                            </summary>
                            <pre
                              style={{
                                marginTop: 8,
                                maxHeight: 300,
                                overflow: 'auto',
                                fontSize: 11,
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'var(--font-mono)',
                                color: 'var(--text-dim)',
                              }}
                            >
                              {d.text}
                            </pre>
                          </details>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="callout" data-tone="ok" style={{ marginTop: 14 }}>
            <Icon name="shield" size={15} className="ico" />
            <div>
              <strong style={{ fontSize: 12.5 }}>Nothing is uploaded</strong>
              <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>
                Chunking, embedding and search all run on the main thread of this tab. Deleting a source drops its
                vectors immediately; “Erase everything” in Settings clears IndexedDB and localStorage together.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
