import { memo, useCallback, useEffect, useRef } from 'react';
import { renderMarkdown } from '../ai/markdown';
import { Icon } from './Icons';
import { emit, EVENTS } from '../lib/bus';

/**
 * Markdown surface.
 *
 * The HTML comes from our own escape-first renderer, so `dangerouslySetInnerHTML`
 * is safe here. Copy buttons are emitted as plain markup and wired with a single
 * delegated listener on the container — that is cheaper than a React component
 * per code block and survives re-renders while streaming.
 */
export const Markdown = memo(function Markdown({
  source,
  citations,
  onCite,
  streaming,
}: {
  source: string;
  citations?: Array<{ index: number; title: string }>;
  onCite?: (index: number) => void;
  streaming?: boolean;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const html = renderMarkdown(source);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      const labBtn = target.closest<HTMLButtonElement>('[data-codelab]');
      if (labBtn) {
        const block = labBtn.closest('.codeblock');
        const code = block?.querySelector('code')?.textContent ?? '';
        const lang = (block as HTMLElement)?.dataset.lang ?? 'typescript';
        emit(EVENTS.codeSample, { label: 'Chat snippet', lang, code });
        window.dispatchEvent(new CustomEvent('am:open-codelab'));
        return;
      }

      const copyBtn = target.closest<HTMLButtonElement>('[data-copy]');
      if (copyBtn) {
        const block = copyBtn.closest('.codeblock');
        const code = block?.querySelector('code')?.textContent ?? '';
        void navigator.clipboard
          ?.writeText(code)
          .then(() => {
            copyBtn.textContent = 'Copied';
            copyBtn.dataset.copied = 'true';
            window.setTimeout(() => {
              copyBtn.textContent = 'Copy';
              delete copyBtn.dataset.copied;
            }, 1600);
          })
          .catch(() => {
            copyBtn.textContent = 'Press ⌘C';
          });
        return;
      }

      const cite = target.closest<HTMLElement>('sup.cite');
      if (cite && onCite) {
        onCite(Number(cite.dataset.cite));
        return;
      }

      // Clicking a link with a target already opens externally; nothing to do.
    };

    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cite = target.closest<HTMLElement>('sup.cite');
      if (!cite || !citations) return;
      const idx = Number(cite.dataset.cite);
      const found = citations.find((c) => c.index === idx);
      cite.title = found ? found.title : `Source ${idx}`;
    };

    el.addEventListener('click', onClick);
    el.addEventListener('mouseover', onOver);
    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('mouseover', onOver);
    };
  }, [citations, onCite]);

  return (
    <div
      className={`markdown msg-body${streaming ? ' is-streaming' : ''}`}
      ref={ref}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

/** A live caret appended while tokens are still arriving. */
export function StreamingCaret(): JSX.Element {
  return <span className="caret" aria-hidden="true" />;
}

/** Small inline copy-to-clipboard button used outside markdown. */
export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }): JSX.Element {
  const onCopy = useCallback(() => {
    void navigator.clipboard?.writeText(text).catch(() => undefined);
  }, [text]);
  return (
    <button type="button" className="btn btn-ghost btn-sm" onClick={onCopy} title="Copy to clipboard">
      <Icon name="copy" size={13} /> {label}
    </button>
  );
}
