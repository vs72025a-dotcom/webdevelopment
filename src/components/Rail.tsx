import { useRef } from 'react';
import { useStore } from '../store/appStore';
import { useTheme } from '../theme/ThemeContext';
import { Icon } from './Icons';

/**
 * Utility rail.
 *
 * Deliberately *not* a second copy of the view tabs — these are the actions you
 * reach for mid-task without moving the mouse to the top of the window: toggle
 * the panel, start a conversation, attach sources, and flip the appearance
 * controls that matter most after dark.
 */

function RailButton({
  icon,
  tip,
  onClick,
  current,
  active,
  danger,
}: {
  icon: string;
  tip: string;
  onClick: () => void;
  current?: boolean;
  active?: boolean;
  danger?: boolean;
}): JSX.Element {
  return (
    <button
      type="button"
      className="rail-btn"
      aria-current={current ? 'true' : undefined}
      aria-pressed={active}
      aria-label={tip}
      onClick={onClick}
      style={active ? { color: 'var(--accent)' } : danger ? { color: 'var(--err)' } : undefined}
    >
      <Icon name={icon} size={19} />
      <span className="rail-tip">{tip}</span>
    </button>
  );
}

export function Rail(): JSX.Element {
  const store = useStore();
  const { theme, choice, setChoice, motion, setMotion } = useTheme();
  const file = useRef<HTMLInputElement>(null);

  const cycleTheme = () => {
    const order = ['aurora', 'abyss', 'phosphor', 'eclipse', 'daylight', 'auto'] as const;
    const i = order.indexOf(choice as (typeof order)[number]);
    setChoice(order[(i + 1) % order.length]);
  };

  const cycleMotion = () => {
    const next = motion === 'full' ? 'reduced' : motion === 'reduced' ? 'off' : 'full';
    setMotion(next);
    store.toast('info', `Motion: ${next}`, next === 'off' ? 'All animation is disabled.' : 'Applies instantly, everywhere.');
  };

  const speechOn = store.settings.speech.enabled;

  return (
    <nav className="rail" aria-label="Quick actions">
      <input
        ref={file}
        type="file"
        multiple
        accept=".txt,.md,.markdown,.csv,.tsv,.json,.log,.py,.js,.ts,.tsx,.jsx,.css,.html,.xml,.yml,.yaml,.sql,.sh,.c,.cpp,.h,.java,.go,.rs,.rb,.php,.text/plain"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) {
            void store.addFiles(e.target.files).then((r) => {
              if (r.added) store.toast('ok', `Indexed ${r.added} file${r.added === 1 ? '' : 's'}`);
              if (r.failed) store.toast('warn', `${r.failed} file(s) skipped`, 'Only text-based files can be parsed in the browser.');
            });
          }
          e.target.value = '';
        }}
      />

      <RailButton
        icon={store.panelOpen ? 'menu' : 'menu'}
        tip={store.panelOpen ? 'Hide side panel' : 'Show side panel'}
        onClick={() => store.setPanelOpen(!store.panelOpen)}
        active={store.panelOpen}
      />
      <RailButton
        icon="plus"
        tip="New conversation"
        onClick={() => {
          store.setView('chat');
          store.newConversation();
        }}
      />
      <RailButton icon="search" tip="Search & commands  ⌘K" onClick={() => store.setPaletteOpen(true)} />
      <RailButton icon="upload" tip="Index files into the knowledge base" onClick={() => file.current?.click()} />

      <span className="rail-spacer" />

      <RailButton
        icon={speechOn ? 'mic' : 'micOff'}
        tip={speechOn ? 'Voice input on — click to mute' : 'Voice input off — click to enable'}
        active={speechOn}
        onClick={() => {
          store.updateSettings({ speech: { ...store.settings.speech, enabled: !speechOn } });
          store.toast('info', speechOn ? 'Voice input off' : 'Voice input on', 'The microphone button now appears in the composer.');
        }}
      />
      <RailButton
        icon={motion === 'off' ? 'eye' : motion === 'reduced' ? 'wave' : 'zap'}
        tip={`Motion: ${motion} — click to change`}
        active={motion !== 'full'}
        onClick={cycleMotion}
      />
      <RailButton
        icon={theme === 'daylight' ? 'sun' : 'moon'}
        tip={`Theme: ${theme}${choice === 'auto' ? ' (auto)' : ''} — click to cycle`}
        onClick={cycleTheme}
      />
      <RailButton
        icon="gear"
        tip="Settings"
        current={store.view === 'settings'}
        onClick={() => store.setView('settings')}
      />
    </nav>
  );
}
