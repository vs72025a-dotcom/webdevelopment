import { useEffect, useState } from 'react';
import { useStore, type ViewId } from '../store/appStore';
import { getActivity, onActivity, type ActivityKind } from '../theme/themes';
import { useTheme } from '../theme/ThemeContext';
import { Icon, Logo } from './Icons';

/**
 * Top bar: brand, the view tabs, and a live activity meter.
 *
 * The meter is not decoration — it reads the same bus that drives the canvas
 * backdrop, so what you see pulsing here is what the aurora is responding to.
 */

const TABS: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: 'chat', label: 'Chat', icon: 'chat' },
  { id: 'documents', label: 'Documents', icon: 'doc' },
  { id: 'codelab', label: 'Code Lab', icon: 'code' },
  { id: 'studio', label: 'Studio', icon: 'palette' },
  { id: 'agents', label: 'Agents', icon: 'bot' },
];

const PHASE_LABEL: Record<string, string> = {
  understanding: 'parsing intent',
  routing: 'routing',
  retrieving: 'retrieving',
  reasoning: 'reasoning',
  composing: 'composing',
  streaming: 'streaming',
  done: 'done',
  planning: 'planning',
  running: 'running step',
  reporting: 'writing report',
  rendering: 'rendering',
  analysing: 'analysing',
  indexing: 'indexing',
  embedding: 'embedding',
};

function ActivityMeter({ phase }: { phase: string | null }): JSX.Element {
  const [state, setState] = useState<{ level: number; kind: ActivityKind }>(() => getActivity());

  useEffect(() => {
    const off = onActivity((level, kind) => setState({ level, kind }));
    // The bus only fires on events; poll lightly so the decay is visible.
    const t = window.setInterval(() => setState(getActivity()), 120);
    return () => {
      off();
      window.clearInterval(t);
    };
  }, []);

  const bars = [0, 1, 2, 3, 4, 5];
  const lit = Math.round(state.level * bars.length);

  return (
    <div className="activity" data-state={state.kind} title={`Engine activity: ${(state.level * 100).toFixed(0)}%`}>
      <span className="activity-orb" />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {phase ? (PHASE_LABEL[phase] ?? phase) : state.kind === 'idle' ? 'idle' : state.kind}
      </span>
      <span className="activity-bars" aria-hidden="true">
        {bars.map((i) => (
          <i
            key={i}
            style={{
              height: `${4 + i * 1.6}px`,
              opacity: i < lit ? 0.95 : 0.22,
            }}
          />
        ))}
      </span>
    </div>
  );
}

export function TopBar(): JSX.Element {
  const store = useStore();
  const { theme, choice, setChoice } = useTheme();
  const { view, setView, busy, phase, setPaletteOpen, newConversation } = store;

  const cycleTheme = () => {
    const order: Array<typeof choice> = ['aurora', 'abyss', 'phosphor', 'eclipse', 'daylight', 'auto'];
    const i = order.indexOf(choice);
    setChoice(order[(i + 1) % order.length]);
  };

  return (
    <header className="topbar">
      <div className="brand">
        <Logo size={26} />
        <span className="brand-name">Aurora Mind</span>
        <span className="brand-sub">AI Workspace</span>
      </div>

      <nav className="tabs" role="tablist" aria-label="Workspace views">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="tab"
            role="tab"
            aria-selected={view === t.id}
            onClick={() => setView(t.id)}
            title={t.label}
          >
            <Icon name={t.icon} size={15} />
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      <span className="topbar-spacer" />

      <ActivityMeter phase={phase} />

      <button
        type="button"
        className="btn btn-ghost btn-icon"
        onClick={() => setPaletteOpen(true)}
        title="Command palette (⌘K / Ctrl+K)"
        aria-label="Command palette"
      >
        <Icon name="command" size={16} />
      </button>

      <button
        type="button"
        className="btn btn-ghost btn-icon"
        onClick={cycleTheme}
        title={`Theme: ${theme}${choice === 'auto' ? ' (auto by sunrise/sunset)' : ''} — click to cycle`}
        aria-label="Cycle theme"
      >
        <Icon name={theme === 'daylight' ? 'sun' : 'moon'} size={16} />
      </button>

      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => {
          setView('chat');
          newConversation();
        }}
        disabled={busy && view === 'chat'}
        title="New conversation"
      >
        <Icon name="plus" size={14} /> New
      </button>
    </header>
  );
}
