import { Suspense, lazy, useCallback, useEffect } from 'react';
import { Backdrop } from './theme/Backdrop';
import { StoreProvider, useStore, type ViewId } from './store/appStore';
import { ThemeProvider } from './theme/ThemeContext';
import { TopBar } from './components/TopBar';
import { Rail } from './components/Rail';
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { CommandPalette } from './components/CommandPalette';
import { Toasts } from './components/Toasts';
import { ChatView } from './views/ChatView';

/*
 * Every view beyond Chat is loaded on demand. Chat is the landing surface and
 * already pulls the engine, so it stays in the initial chunk; Code Lab, Studio
 * and Settings drag in the analyser, the art renderer and the provider layer
 * respectively, none of which anyone needs before they navigate there.
 */
const view = <T extends Record<string, unknown>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((m) => ({ default: m[name] as unknown as React.ComponentType })));

const DocumentsView = view(() => import('./views/DocumentsView'), 'DocumentsView');
const CodeLabView = view(() => import('./views/CodeLabView'), 'CodeLabView');
const StudioView = view(() => import('./views/StudioView'), 'StudioView');
const AgentView = view(() => import('./views/AgentView'), 'AgentView');
const SettingsView = view(() => import('./views/SettingsView'), 'SettingsView');

/** Shown for the fraction of a second a view chunk is in flight. */
function ViewLoading({ label }: { label: string }): JSX.Element {
  return (
    <div className="view">
      <div className="wrap">
        <div className="card card-pad" aria-live="polite">
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <span className="boot-ring" aria-hidden="true" />
            <div>
              <div className="card-title">Loading {label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>
                Fetching this view&rsquo;s code — the rest of the app is already running.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The shell: a fixed grid of top bar / rail / contextual panel / main surface /
 * status bar, with the animated backdrop layered underneath and the command
 * palette and toasts floating above.
 */

const VIEW_ORDER: ViewId[] = ['chat', 'documents', 'codelab', 'studio', 'agents'];

function Workspace(): JSX.Element {
  const store = useStore();
  const { view, panelOpen, setPanelOpen, setPaletteOpen, setView, stop, busy } = store;

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable === true);

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!store.paletteOpen);
        return;
      }
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setPanelOpen(!panelOpen);
        return;
      }
      if (mod && e.key === 'Escape') {
        e.preventDefault();
        if (busy) stop();
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setView('chat');
        store.newConversation();
        return;
      }
      if (mod && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        setView(VIEW_ORDER[Number(e.key) - 1]);
        return;
      }
      if (mod && e.key === '6') {
        e.preventDefault();
        setView('settings');
        return;
      }
      // Slash focuses the composer when not already typing.
      if (e.key === '/' && !typing && !mod) {
        e.preventDefault();
        setView('chat');
        window.setTimeout(() => {
          const el = document.querySelector<HTMLTextAreaElement>('.composer-text');
          el?.focus();
        }, 30);
      }
    },
    [busy, panelOpen, setPaletteOpen, setPanelOpen, setView, stop, store],
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  useEffect(() => {
    const onLab = () => setView('codelab');
    window.addEventListener('am:open-codelab', onLab);
    return () => window.removeEventListener('am:open-codelab', onLab);
  }, [setView]);

  // Close the drawer when the viewport shrinks past the breakpoint.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 860px)');
    const onChange = () => {
      if (mq.matches) setPanelOpen(false);
    };
    mq.addEventListener('change', onChange);
    onChange();
    return () => mq.removeEventListener('change', onChange);
  }, [setPanelOpen]);

  return (
    <>
      <Backdrop />

      <div className="app-shell" data-panel={panelOpen ? 'open' : 'closed'}>
        <TopBar />
        <Rail />
        <Sidebar />

        <main className="main">
          {view === 'chat' ? (
            <ChatView />
          ) : (
            <Suspense fallback={<ViewLoading label={VIEW_LABELS[view]} />}>
              {view === 'documents' ? <DocumentsView /> : null}
              {view === 'codelab' ? <CodeLabView /> : null}
              {view === 'studio' ? <StudioView /> : null}
              {view === 'agents' ? <AgentView /> : null}
              {view === 'settings' ? <SettingsView /> : null}
            </Suspense>
          )}
        </main>

        <StatusBar />
      </div>

      {panelOpen ? (
        <div
          className="panel-scrim"
          onClick={() => setPanelOpen(false)}
          role="presentation"
          aria-hidden="true"
        />
      ) : null}

      <CommandPalette />
      <Toasts />

      {!store.ready ? (
        <div className="boot-veil" role="status" aria-live="polite">
          <span className="boot-ring" />
          <span>Indexing your knowledge base…</span>
        </div>
      ) : null}
    </>
  );
}

const VIEW_LABELS: Record<ViewId, string> = {
  chat: 'chat',
  documents: 'the knowledge base',
  codelab: 'Code Lab',
  studio: 'Prompt Studio',
  agents: 'Agents',
  settings: 'Settings',
};

export default function App(): JSX.Element {
  return (
    <ThemeProvider>
      <StoreProvider>
        <Workspace />
      </StoreProvider>
    </ThemeProvider>
  );
}
