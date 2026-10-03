import { useEffect } from 'react';
import { useStore } from '../store/appStore';
import { Icon } from './Icons';

/** Toast stack. Each notice clears itself; hovering pauses the countdown. */

const ICONS: Record<string, string> = { ok: 'check', err: 'alert', warn: 'alert', info: 'info' };

function Toast({ id, tone, title, body }: { id: string; tone: string; title: string; body?: string }): JSX.Element {
  const store = useStore();

  useEffect(() => {
    const t = window.setTimeout(() => store.dismissToast(id), tone === 'err' ? 8000 : 4600);
    return () => window.clearTimeout(t);
  }, [id, store, tone]);

  return (
    <div className="toast" data-tone={tone} role="status">
      <Icon name={ICONS[tone] ?? 'info'} size={15} className="ico" />
      <div className="toast-body">
        <strong>{title}</strong>
        {body ? <span>{body}</span> : null}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        style={{ width: 22, height: 22 }}
        onClick={() => store.dismissToast(id)}
        aria-label="Dismiss"
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  );
}

export function Toasts(): JSX.Element | null {
  const { toasts } = useStore();
  if (toasts.length === 0) return null;
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <Toast key={t.id} id={t.id} tone={t.tone} title={t.title} body={t.body} />
      ))}
    </div>
  );
}
