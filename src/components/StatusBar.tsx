import { useEffect, useState } from 'react';
import { useStore } from '../store/appStore';
import { db } from '../store/db';
import { PROVIDER_PRESETS } from '../ai/providers';
import { useTheme } from '../theme/ThemeContext';
import { Icon } from './Icons';

/**
 * Status bar — the instrument panel.
 *
 * Everything here is a real reading: which engine answered, what it is grounded
 * on, how much of your storage it occupies, and where the sun is.
 */

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function StatusBar(): JSX.Element {
  const store = useStore();
  const { meta, auto } = useTheme();
  const { settings, conversations, documents, indexStats, busy, ready } = store;

  const [usage, setUsage] = useState(0);
  useEffect(() => {
    let alive = true;
    const measure = () => {
      void db.estimate().then((u) => {
        if (alive) setUsage(u?.usage ?? 0);
      });
    };
    measure();
    const t = window.setInterval(measure, 8000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [conversations.length, documents.length]);

  const remote = settings.provider.kind !== 'offline' && settings.provider.model.trim() !== '';
  const preset =
    settings.provider.kind === 'offline'
      ? undefined
      : PROVIDER_PRESETS[settings.provider.kind as keyof typeof PROVIDER_PRESETS];
  const engineLabel = remote ? `${preset?.label ?? settings.provider.kind} · ${settings.provider.model}` : 'on-device engine';

  const messages = conversations.reduce((n, c) => n + c.messages.length, 0);

  return (
    <footer className="statusbar">
      <span className="status-item" title={remote ? 'Answers stream from your configured provider.' : 'All inference happens in this browser tab.'}>
        <span className="status-dot" style={busy ? { background: 'var(--accent)' } : undefined} />
        <Icon name={remote ? 'globe' : 'cpu'} size={12} />
        {ready ? engineLabel : 'starting…'}
      </span>

      <span className="status-sep" />

      <span className="status-item" title="Passages available to retrieval">
        <Icon name="db" size={12} />
        {indexStats.chunks.toLocaleString()} vectors · {indexStats.sources} sources
      </span>

      <span className="status-sep" />

      <span className="status-item" title="Persisted in IndexedDB on this device">
        <Icon name="save" size={12} />
        {conversations.length} chats · {messages} msgs · {bytes(usage)}
      </span>

      <span className="spacer" style={{ flex: 1 }} />

      {auto.active ? (
        <span className="status-item" title="Auto theme follows the sun at your location">
          <Icon name={auto.isDaylight ? 'sun' : 'moon'} size={12} />
          {auto.isDaylight ? 'day' : 'night'} · ↑{auto.sunrise} ↓{auto.sunset}
        </span>
      ) : null}

      <span className="status-item" title={meta.description}>
        <Icon name="palette" size={12} />
        {meta.label}
      </span>

      <span className="status-sep" />

      <span className="status-item">
        <kbd>⌘K</kbd> commands
      </span>
    </footer>
  );
}
