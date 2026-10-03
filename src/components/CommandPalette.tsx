import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { THEMES, type ThemeChoice } from '../theme/themes';
import { useTheme } from '../theme/ThemeContext';
import { useStore, type ViewId } from '../store/appStore';
import { queuePrompt } from '../lib/bus';
import { Icon } from './Icons';

/**
 * Command palette (⌘K / Ctrl+K).
 *
 * Every action in the app is reachable from here, and typing also searches your
 * conversations and indexed documents — so it doubles as global search.
 */

interface Command {
  id: string;
  group: string;
  title: string;
  hint?: string;
  icon: string;
  keywords?: string;
  run: () => void;
}

/** Subsequence fuzzy score; higher is better, -1 means no match. */
function score(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t.includes(q)) return 120 - t.indexOf(q);
  let i = 0;
  let s = 0;
  let streak = 0;
  for (const ch of q) {
    const at = t.indexOf(ch, i);
    if (at === -1) return -1;
    streak = at === i ? streak + 1 : 0;
    s += 6 + streak * 3;
    i = at + 1;
  }
  return s;
}

const ASK_IDEAS = [
  'How does retrieval-augmented generation reduce hallucination?',
  'Explain mixture-of-experts routing',
  'What is LoRA fine-tuning and when should I use it?',
  'Compare quantisation strategies for inference',
  'Write a haiku about a compiler at midnight',
  'Plan a two-week migration to a modular architecture',
];

export function CommandPalette(): JSX.Element | null {
  const store = useStore();
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  const close = useCallback(() => store.setPaletteOpen(false), [store]);

  const downloadConversation = useCallback(
    (format: 'md' | 'json') => {
      const id = store.active?.id;
      if (!id) {
        store.toast('warn', 'No conversation open', 'Start one in Chat first.');
        return;
      }
      const text = store.exportConversation(id, format);
      const blob = new Blob([text], { type: format === 'md' ? 'text/markdown' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(store.active?.title ?? 'conversation').replace(/\W+/g, '-').toLowerCase()}.${format}`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    },
    [store],
  );

  const commands = useMemo<Command[]>(() => {
    const views: Array<{ id: ViewId; label: string; icon: string }> = [
      { id: 'chat', label: 'Chat', icon: 'chat' },
      { id: 'documents', label: 'Documents', icon: 'doc' },
      { id: 'codelab', label: 'Code Lab', icon: 'code' },
      { id: 'studio', label: 'Prompt Studio', icon: 'palette' },
      { id: 'agents', label: 'Agents', icon: 'bot' },
      { id: 'settings', label: 'Settings', icon: 'gear' },
    ];

    const list: Command[] = [
      ...views.map((v) => ({
        id: `view-${v.id}`,
        group: 'Go to',
        title: v.label,
        icon: v.icon,
        keywords: 'navigate switch tab open',
        run: () => store.setView(v.id),
      })),
      {
        id: 'new-chat',
        group: 'Actions',
        title: 'New conversation',
        hint: 'Starts a fresh thread',
        icon: 'plus',
        keywords: 'create new chat',
        run: () => {
          store.setView('chat');
          store.newConversation();
        },
      },
      {
        id: 'toggle-panel',
        group: 'Actions',
        title: store.panelOpen ? 'Hide side panel' : 'Show side panel',
        icon: 'menu',
        keywords: 'sidebar collapse',
        run: () => store.setPanelOpen(!store.panelOpen),
      },
      {
        id: 'stop',
        group: 'Actions',
        title: 'Stop generating',
        hint: store.busy ? 'A turn is in flight' : 'Nothing running',
        icon: 'stop',
        keywords: 'abort cancel',
        run: () => store.stop(),
      },
      {
        id: 'export-md',
        group: 'Actions',
        title: 'Export conversation as Markdown',
        icon: 'download',
        keywords: 'save share md',
        run: () => downloadConversation('md'),
      },
      {
        id: 'export-json',
        group: 'Actions',
        title: 'Export conversation as JSON',
        icon: 'download',
        keywords: 'save data',
        run: () => downloadConversation('json'),
      },
      {
        id: 'copy-last',
        group: 'Actions',
        title: 'Copy the last answer',
        icon: 'copy',
        keywords: 'clipboard',
        run: () => {
          const last = [...(store.active?.messages ?? [])].reverse().find((m) => m.role === 'assistant');
          if (!last) {
            store.toast('warn', 'Nothing to copy', 'No answer in this conversation yet.');
            return;
          }
          void navigator.clipboard?.writeText(last.content).then(
            () => store.toast('ok', 'Answer copied'),
            () => store.toast('err', 'Clipboard blocked', 'Your browser refused the copy request.'),
          );
        },
      },
      {
        id: 'clear-chats',
        group: 'Actions',
        title: 'Delete all conversations',
        hint: `${store.conversations.length} stored on this device`,
        icon: 'trash',
        keywords: 'reset remove wipe',
        run: () => {
          if (window.confirm('Delete every conversation on this device?')) void store.clearConversations();
        },
      },
      {
        id: 'wipe',
        group: 'Actions',
        title: 'Erase everything (data, index, settings)',
        icon: 'shield',
        keywords: 'privacy reset factory',
        run: () => {
          if (window.confirm('Erase all conversations, documents, renders and settings?')) void store.wipe();
        },
      },
      ...THEMES.map((t) => ({
        id: `theme-${t.id}`,
        group: 'Appearance',
        title: `Theme: ${t.label}`,
        hint: t.tagline,
        icon: t.night ? 'moon' : 'sun',
        keywords: 'night dark mode color appearance',
        run: () => theme.setChoice(t.id as ThemeChoice),
      })),
      {
        id: 'theme-auto',
        group: 'Appearance',
        title: 'Theme: Auto (follow the sun)',
        hint: `↑ ${theme.auto.sunrise} · ↓ ${theme.auto.sunset}`,
        icon: 'globe',
        keywords: 'sunset sunrise automatic',
        run: () => theme.setChoice('auto'),
      },
      {
        id: 'motion-reduced',
        group: 'Appearance',
        title: `Motion: ${theme.motion === 'reduced' ? 'full' : 'reduced'}`,
        icon: 'wave',
        keywords: 'animation accessibility',
        run: () => theme.setMotion(theme.motion === 'reduced' ? 'full' : 'reduced'),
      },
      {
        id: 'motion-off',
        group: 'Appearance',
        title: `Motion: ${theme.motion === 'off' ? 'full' : 'off'}`,
        hint: 'Freezes the backdrop entirely',
        icon: 'eye',
        keywords: 'static accessibility',
        run: () => theme.setMotion(theme.motion === 'off' ? 'full' : 'off'),
      },
      {
        id: 'density',
        group: 'Appearance',
        title: `Density: ${theme.density === 'cosy' ? 'compact' : 'cosy'}`,
        icon: 'layers',
        keywords: 'spacing compact',
        run: () => theme.setDensity(theme.density === 'cosy' ? 'compact' : 'cosy'),
      },
      ...ASK_IDEAS.map((q, i) => ({
        id: `ask-${i}`,
        group: 'Ask',
        title: q,
        icon: 'sparkles',
        keywords: 'prompt question example',
        run: () => {
          store.setView('chat');
          store.newConversation(q.slice(0, 42));
          queuePrompt(q);
        },
      })),
      ...store.conversations.slice(0, 40).map((c) => ({
        id: `conv-${c.id}`,
        group: 'Conversations',
        title: c.title,
        hint: `${c.messages.length} messages`,
        icon: 'chat',
        keywords: c.messages.slice(-3).map((m) => m.content.slice(0, 60)).join(' '),
        run: () => store.selectConversation(c.id),
      })),
      ...store.documents.slice(0, 40).map((d) => ({
        id: `doc-${d.id}`,
        group: 'Documents',
        title: d.title,
        hint: `${d.chunks.length} chunks`,
        icon: d.kind === 'note' ? 'quote' : 'doc',
        keywords: d.text.slice(0, 200),
        run: () => {
          store.setView('documents');
          store.setPanelOpen(true);
        },
      })),
    ];
    return list;
  }, [downloadConversation, store, theme]);

  const results = useMemo(() => {
    const q = query.trim();
    const scored = commands
      .map((c) => ({ c, s: Math.max(score(q, c.title), score(q, c.keywords ?? ''), score(q, c.hint ?? '')) }))
      .filter((r) => r.s >= 0)
      .sort((a, b) => b.s - a.s);
    return scored.slice(0, 40).map((r) => r.c);
  }, [commands, query]);

  useEffect(() => {
    if (store.paletteOpen) {
      setQuery('');
      setCursor(0);
      window.setTimeout(() => input.current?.focus(), 20);
    }
  }, [store.paletteOpen]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!store.paletteOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(results.length - 1, c + 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = results[cursor];
        if (cmd) {
          cmd.run();
          close();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, cursor, results, store.paletteOpen]);

  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!store.paletteOpen) return null;

  let lastGroup = '';

  return (
    <div className="overlay" onClick={close} role="presentation">
      <div
        className="palette-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <input
          ref={input}
          className="palette-input"
          placeholder="Search commands, themes, conversations, documents…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        <div className="palette-list" ref={list}>
          {results.length === 0 ? (
            <div className="empty">
              <Icon name="search" className="ico" />
              <strong>Nothing matches</strong>
              <p>Try “theme”, “export”, “studio”, or the title of a conversation.</p>
            </div>
          ) : (
            results.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              return (
                <div key={c.id}>
                  {header ? <div className="palette-group">{header}</div> : null}
                  <div
                    className="palette-item"
                    data-active={i === cursor}
                    data-idx={i}
                    onClick={() => {
                      c.run();
                      close();
                    }}
                    onMouseEnter={() => setCursor(i)}
                    role="option"
                    aria-selected={i === cursor}
                  >
                    <Icon name={c.icon} size={16} className="ico" />
                    <span className="t">
                      <strong>{c.title}</strong>
                      {c.hint ? <span>{c.hint}</span> : null}
                    </span>
                    {i === cursor ? (
                      <kbd style={{ flex: 'none' }}>↵</kbd>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="palette-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> run
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
          <span style={{ marginLeft: 'auto' }}>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}
