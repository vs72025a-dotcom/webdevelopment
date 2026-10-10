import { useEffect } from 'react';
import { Icon } from './Icons';

interface ShortcutGroup {
  name: string;
  items: Array<{ key: string; label: string }>;
}

const GROUPS: ShortcutGroup[] = [
  {
    name: 'Global',
    items: [
      { key: '⌘ K', label: 'Command palette & search' },
      { key: '⌘ B', label: 'Toggle side panel' },
      { key: '?', label: 'Open shortcuts cheat sheet' },
      { key: '/', label: 'Focus chat input' },
      { key: 'Esc', label: 'Close modal / stop generation' },
    ],
  },
  {
    name: 'Navigation',
    items: [
      { key: '⌘ 1', label: 'Chat workspace' },
      { key: '⌘ 2', label: 'Knowledge base & documents' },
      { key: '⌘ 3', label: 'Code Lab static analysis' },
      { key: '⌘ 4', label: 'Prompt Studio' },
      { key: '⌘ 5', label: 'Agents planner' },
      { key: '⌘ 6', label: 'Settings & telemetry' },
    ],
  },
  {
    name: 'Chat & Editing',
    items: [
      { key: 'Enter', label: 'Send prompt' },
      { key: '⇧ Enter', label: 'Insert newline' },
      { key: '↑', label: 'Recall last prompt (empty input)' },
      { key: '⌘ ⇧ O', label: 'Start fresh conversation' },
      { key: '⌘ Enter', label: 'Run in Code Lab / Agents' },
    ],
  },
];

export function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): JSX.Element | null {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="overlay" onClick={onClose} role="presentation">
      <div
        className="palette-panel"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="command" size={16} />
            <strong style={{ fontSize: 14 }}>Keyboard Shortcuts</strong>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label="Close shortcuts"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {GROUPS.map((g) => (
            <div key={g.name}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 650,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-faint)',
                  marginBottom: 6,
                }}
              >
                {g.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 6 }}>
                {g.items.map((it) => (
                  <div
                    key={it.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 'var(--radius-xs)',
                      background: 'var(--surface-2)',
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: 'var(--text-dim)', fontSize: 11.5 }}>{it.label}</span>
                    <kbd style={{ flex: 'none', marginLeft: 8 }}>{it.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div
          className="palette-foot"
          style={{
            borderTop: '1px solid var(--border-soft)',
            padding: '10px 18px',
            fontSize: 11,
            color: 'var(--text-faint)',
          }}
        >
          <span>Tip: Modifiers use <kbd>Ctrl</kbd> on Windows/Linux</span>
          <span style={{ marginLeft: 'auto' }}>
            <kbd>Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}
