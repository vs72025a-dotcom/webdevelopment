import { memo, useCallback, useMemo, useState } from 'react';
import type { Citation } from '../ai/engine';
import type { Message } from '../store/db';
import { Icon } from './Icons';
import { Markdown, StreamingCaret } from './Markdown';

/**
 * One turn of the thread.
 *
 * Beyond the rendered answer this shows the *reasoning*: the phase trace, every
 * tool the engine called with its arguments and output, and the retrieved
 * passages that grounded the answer. That transparency is the point — you can
 * audit why a claim was made instead of trusting it.
 */

function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 45) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.round(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = h / 24;
  if (d < 7) return `${Math.round(d)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function confidenceTone(c: number): 'ok' | 'warn' | 'err' {
  if (c >= 0.72) return 'ok';
  if (c >= 0.45) return 'warn';
  return 'err';
}

const TOOL_ICONS: Record<string, string> = {
  calculator: 'calc',
  unit_convert: 'ruler',
  base_convert: 'hash',
  datetime: 'clock',
  random: 'dice',
  color: 'palette',
  text_stats: 'list',
  summarize: 'quote',
  keywords: 'sparkles',
  sentiment: 'gauge',
  code_analyze: 'braces',
  search: 'search',
  retrieve: 'db',
  regex: 'asterisk',
  json_format: 'layers',
  hash: 'shield',
};

function toolIcon(name: string): string {
  return TOOL_ICONS[name] ?? 'zap';
}

export interface MessageItemProps {
  message: Message;
  onRegenerate: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onSpeak: (text: string) => void;
  speaking: boolean;
  onCiteJump: (c: Citation) => void;
  onFork?: (id: string) => void;
  index?: number;
  total?: number;
}

export const MessageItem = memo(function MessageItem({
  message,
  onRegenerate,
  onDelete,
  onEdit,
  onSpeak,
  speaking,
  onCiteJump,
  onFork,
}: MessageItemProps): JSX.Element {
  const [traceOpen, setTraceOpen] = useState(false);
  const [openTools, setOpenTools] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const [copied, setCopied] = useState(false);

  const isUser = message.role === 'user';
  const citations = message.citations ?? [];
  const tools = message.toolCalls ?? [];
  const thinking = message.thinking ?? [];
  const plan = message.plan ?? [];
  const live = message.pending === true;

  const citeMap = useMemo(() => citations.map((c) => ({ index: c.index, title: c.title })), [citations]);

  const onCopy = useCallback(() => {
    void navigator.clipboard
      ?.writeText(message.content)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => undefined);
  }, [message.content]);

  const commitEdit = useCallback(() => {
    const text = draft.trim();
    setEditing(false);
    if (text && text !== message.content) onEdit(message.id, text);
    else setDraft(message.content);
  }, [draft, message.content, message.id, onEdit]);

  const citeClick = useCallback(
    (idx: number) => {
      const found = citations.find((c) => c.index === idx);
      if (found) onCiteJump(found);
    },
    [citations, onCiteJump],
  );

  return (
    <article className="msg" data-role={message.role}>
      <div className="avatar" data-role={message.role} aria-hidden="true">
        {isUser ? <Icon name="name" size={15} /> : <Icon name="sparkles" size={15} />}
      </div>

      <div className="msg-col">
        <div className="msg-meta">
          <strong style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{isUser ? 'You' : 'Aurora Mind'}</strong>
          <span>{timeAgo(message.createdAt)}</span>
          {message.model && !isUser ? <span className="mono">{message.model}</span> : null}
          {typeof message.confidence === 'number' && !isUser && !live ? (
            <span className="badge" data-tone={confidenceTone(message.confidence)}>
              {Math.round(message.confidence * 100)}% confident
            </span>
          ) : null}
          {message.grounded === false && !isUser && !live ? (
            <span className="badge" data-tone="warn" title="Nothing in your knowledge base was relevant enough to ground this.">
              ungrounded
            </span>
          ) : null}
          {live ? (
            <span className="badge" data-tone="accent">
              <span className="status-dot" /> generating
            </span>
          ) : null}
        </div>

        {/* reasoning trace */}
        {!isUser && (thinking.length > 0 || plan.length > 0) ? (
          <div className="trace">
            <button
              type="button"
              className="trace-head"
              onClick={() => setTraceOpen((v) => !v)}
              aria-expanded={traceOpen}
              style={{ width: '100%', background: 'transparent', border: 0, textAlign: 'left' }}
            >
              <Icon name="chevR" size={11} className="chev" style={{ transform: traceOpen ? 'rotate(90deg)' : 'none' }} />
              <Icon name="brain" size={12} />
              <span>
                Reasoning trace · {thinking.length + plan.length} step{thinking.length + plan.length === 1 ? '' : 's'}
              </span>
              {message.intent ? <span className="mono" style={{ marginLeft: 'auto', opacity: 0.7 }}>{message.intent}</span> : null}
            </button>
            {traceOpen ? (
              <div className="trace-body">
                {plan.length > 0 ? (
                  <ol>
                    {plan.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ol>
                ) : null}
                {thinking.map((t, i) => (
                  <div key={i}>› {t}</div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* tool calls */}
        {!isUser && tools.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignSelf: 'stretch' }}>
            {tools.map((t, i) => {
              const key = `${message.id}:${t.name}:${i}`;
              const open = openTools[key] === true;
              return (
                <div className="toolcard" key={key}>
                  <button
                    type="button"
                    className="toolcard-head"
                    style={{ width: '100%', background: 'transparent', border: 0, textAlign: 'left' }}
                    onClick={() => setOpenTools((s) => ({ ...s, [key]: !open }))}
                    aria-expanded={open}
                  >
                    <span className="toolcard-icon">
                      <Icon name={toolIcon(t.name)} size={12} />
                    </span>
                    <span className="toolcard-name">{t.label}</span>
                    <span className="toolcard-sum">{t.ok ? t.summary : `failed — ${t.summary}`}</span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                      {t.ms}ms
                    </span>
                    <Icon name="chevR" size={11} className="chev" style={{ transform: open ? 'rotate(90deg)' : 'none' }} />
                  </button>
                  {open ? (
                    <div className="toolcard-body">
                      <div className="toolcard-args">
                        {t.name}({Object.entries(t.args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})
                      </div>
                      {t.detail ? <Markdown source={t.detail} /> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* body */}
        {editing ? (
          <div className="bubble" style={{ alignSelf: 'stretch' }}>
            <textarea
              className="textarea"
              value={draft}
              rows={Math.min(14, Math.max(3, draft.split('\n').length + 1))}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commitEdit();
                if (e.key === 'Escape') {
                  setDraft(message.content);
                  setEditing(false);
                }
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 7, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setDraft(message.content); setEditing(false); }}>
                Cancel
              </button>
              <button type="button" className="btn btn-sm btn-primary" onClick={commitEdit}>
                <Icon name="check" size={13} /> Save &amp; re-run
              </button>
            </div>
          </div>
        ) : (
          <div className="bubble">
            {message.error && !message.content ? (
              <div className="callout" data-tone="err" style={{ margin: 0 }}>
                <Icon name="alert" size={15} className="ico" />
                <div>
                  <strong>{message.error}</strong>
                  <div style={{ fontSize: 12, opacity: 0.85, marginTop: 3 }}>
                    Check the provider key and model in Settings, or switch back to the on-device engine.
                  </div>
                </div>
              </div>
            ) : (
              <Markdown
                source={message.content}
                citations={citeMap}
                onCite={citeClick}
                streaming={live}
              />
            )}
            {live ? <StreamingCaret /> : null}
          </div>
        )}

        {/* citations */}
        {!isUser && citations.length > 0 ? (
          <div className="cites">
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-faint)', alignSelf: 'center' }}>
              {citations.length} source{citations.length === 1 ? '' : 's'}
            </span>
            {citations.map((c) => (
              <button
                type="button"
                key={`${c.sourceId}-${c.index}`}
                className="cite-chip"
                onClick={() => onCiteJump(c)}
                title={`${c.title}\n\n${c.excerpt}`}
              >
                <span className="cite-num">{c.index}</span>
                <span>{c.title}</span>
                <span className="mono" style={{ fontSize: 9.5, opacity: 0.7 }}>
                  {Math.round(c.score * 100)}%
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {/* stats + actions */}
        <div className="msg-meta">
          {message.tokens ? (
            <span className="mono" title="prompt + completion tokens">
              {message.tokens.prompt + message.tokens.completion} tok
            </span>
          ) : null}
          {typeof message.latencyMs === 'number' ? (
            <span className="mono" title="Wall-clock latency for this turn">
              {(message.latencyMs / 1000).toFixed(2)}s
            </span>
          ) : null}
          {message.tokens && message.latencyMs ? (
            <span className="mono" title="Completion tokens per second">
              {(message.tokens.completion / Math.max(0.001, message.latencyMs / 1000)).toFixed(0)} tok/s
            </span>
          ) : null}
          <div className="msg-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCopy} title="Copy message">
              <Icon name={copied ? 'check' : 'copy'} size={13} />
            </button>
            {onFork && !live ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onFork(message.id)}
                title="Branch conversation from this message"
              >
                <Icon name="branch" size={13} />
              </button>
            ) : null}
            {!isUser ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onSpeak(message.content)}
                title={speaking ? 'Stop reading aloud' : 'Read aloud'}
              >
                <Icon name="volume" size={13} />
              </button>
            ) : null}
            {!isUser && !live ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRegenerate(message.id)} title="Regenerate">
                <Icon name="refresh" size={13} />
              </button>
            ) : null}
            {isUser ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
                title="Edit and re-run"
              >
                <Icon name="edit" size={13} />
              </button>
            ) : null}
            <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => onDelete(message.id)} title="Delete">
              <Icon name="trash" size={13} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
});
