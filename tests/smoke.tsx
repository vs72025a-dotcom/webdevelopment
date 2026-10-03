import { win as w } from './setup';

/* eslint-disable @typescript-eslint/no-var-requires */
// Loaded *after* the DOM shims above, because react-dom inspects `document`
// during module initialisation.
const React = require('react');
const { createRoot } = require('react-dom/client');
const { act } = require('react-dom/test-utils');
const App = require('../src/App').default;

let failures = 0;
function check(name: string, cond: boolean, extra = ''): void {
  if (cond) {
    process.stdout.write(`  ✓ ${name}\n`);
  } else {
    failures++;
    process.stdout.write(`  ✗ ${name} ${extra}\n`);
  }
}

const q = (sel: string): Element | null => w.document.querySelector(sel);
const qa = (sel: string): Element[] => Array.from(w.document.querySelectorAll(sel));
const text = (sel: string): string => q(sel)?.textContent ?? '';

async function settle(ms = 60): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

function click(el: Element | null): void {
  if (!el) throw new Error('click: element missing');
  act(() => {
    el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

async function typeInto(el: Element, value: string): Promise<void> {
  const input = el as HTMLTextAreaElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      input instanceof w.HTMLTextAreaElement ? w.HTMLTextAreaElement.prototype : w.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new w.Event('input', { bubbles: true }));
  });
}

async function main(): Promise<void> {
  process.stdout.write('\nAurora Mind — runtime smoke test\n\n');

  const host = w.document.getElementById('root')!;
  const root = createRoot(host);

  await act(async () => {
    root.render(React.createElement(App));
  });
  await settle(400);

  process.stdout.write('Shell\n');
  check('app-shell mounted', !!q('.app-shell'));
  check('topbar + brand', text('.brand-name') === 'Aurora Mind');
  check('rail rendered', qa('.rail-btn').length >= 7);
  check('statusbar shows engine', /on-device engine/.test(text('.statusbar')));
  check('backdrop present', !!q('.backdrop'));
  check('5 view tabs', qa('.tab').length === 5);
  check('side panel open', q('.app-shell')?.getAttribute('data-panel') === 'open');

  process.stdout.write('\nChat\n');
  check('hero shown on empty thread', !!q('.hero'));
  check('hero starter cards', qa('.hero-card').length === 6);
  check('composer present', !!q('.composer-text'));

  const composer = q('.composer-text') as HTMLTextAreaElement;
  await typeInto(composer, 'What is 12% of 4860 plus sqrt(2025)?');
  await settle();
  const send = q('.send-btn');
  check('send button enabled', !(send as HTMLButtonElement)?.disabled);
  click(send);
  await settle(1800);

  const msgs = qa('.msg');
  check('user + assistant messages rendered', msgs.length >= 2, `(got ${msgs.length})`);
  const answer = qa('.msg[data-role="assistant"] .bubble').map((b) => b.textContent ?? '').join(' ');
  check('assistant answered with a number', /\d/.test(answer), `→ ${answer.slice(0, 90)}`);
  check('answer contains 628.2 (12% of 4860 = 583.2, + sqrt(2025) = 45)', answer.includes('628.2'), `→ ${answer.slice(0, 160)}`);
  check('tool card shown for the calculation', qa('.toolcard').length >= 1);
  check('message stats rendered', /tok|s$/.test(qa('.msg-meta').map((m) => m.textContent).join(' ')));
  check('conversation appears in panel', qa('.conv-row').length >= 1);
  check('statusbar counted the conversation', /1 chats/.test(text('.statusbar')));

  process.stdout.write('\nRetrieval + citations\n');
  await typeInto(q('.composer-text')!, 'How does retrieval-augmented generation reduce hallucination?');
  click(q('.send-btn'));
  await settle(2200);
  check('citations rendered', qa('.cite-chip').length >= 1, `(got ${qa('.cite-chip').length})`);
  check('reasoning trace rendered', qa('.trace').length >= 1);
  const cites = qa('.cite-chip').map((c) => c.textContent ?? '').join(' | ');
  check('citation carries a relevance score', /%/.test(cites), `→ ${cites.slice(0, 120)}`);

  process.stdout.write('\nViews\n');
  const tabs = qa('.tab');
  click(tabs[1]);
  await settle(220);
  check('Documents view', text('.view-title') === 'Knowledge base' && !!q('.dropzone'));
  check('retrieval tester present', !!q('.wrap-wide input[placeholder^="e.g."]'));
  await typeInto(q('.wrap-wide input[placeholder^="e.g."]')!, 'quantisation');
  await settle(500);
  check('retrieval tester returned hits', qa('.doc-row').length >= 1 || /No passage/.test(text('.empty strong')));

  click(tabs[2]);
  await settle(220);
  check('Code Lab view', text('.view-title') === 'Code Lab' && !!q('.editor-input'));
  check('gutter line numbers', (q('.editor-gutter')?.textContent ?? '').includes('1'));
  click(qa('.editor-bar .btn')[0]);
  await settle(700);
  check('static analysis produced output', /Static analysis/.test(text('.card-title')));
  check('analysis output is non-trivial', (q('.card-pad .markdown')?.textContent ?? '').length > 80);

  click(tabs[3]);
  await settle(500);
  check('Studio view', text('.view-title') === 'Prompt Studio');
  check('canvas rendered', !!q('.canvas-frame canvas'));
  check('8 style buttons', qa('.style-btn').length === 8);
  check('10 palette swatches', qa('.palette-swatch').length === 10);
  check('compiled prompt text', (q('.mono')?.textContent ?? '').length > 10);
  const overlay = text('.canvas-overlay');
  check('render stats in overlay', /elements/.test(overlay) && /ms/.test(overlay), `→ ${overlay}`);
  click(qa('.style-btn')[3]);
  await settle(400);
  check('style switch re-renders', /topographic/.test(text('.canvas-overlay')));

  click(tabs[4]);
  await settle(220);
  check('Agents view', text('.view-title') === 'Agents');
  check('agent example chips', qa('.chip').length >= 5);
  click(qa('.chip')[1]);
  await settle(120);
  click(qa('.card-pad .btn-primary')[0]);
  await settle(2600);
  check('plan steps rendered', qa('.step').length >= 1, `(got ${qa('.step').length})`);
  check(
    'report written',
    qa('.card-title').some((t) => /Report/.test(t.textContent ?? '')),
  );
  check('report has content', (qa('.card-pad .markdown').pop()?.textContent ?? '').length > 60);

  process.stdout.write('\nSettings\n');
  click(qa('.rail-btn')[qa('.rail-btn').length - 1]);
  await settle(300);
  check('Settings view', text('.view-title') === 'Settings');
  check('5 theme cards + auto', qa('.theme-card').length === 6);
  check('accent choices', qa('.chip').length >= 7);
  click(qa('.theme-card')[2]);
  await settle(260);
  check('phosphor theme applied', w.document.documentElement.getAttribute('data-theme') === 'phosphor');
  check('CRT overlay present', !!q('.crt-scanlines, .crt'));
  click(qa('.theme-card')[0]);
  await settle(200);
  check('aurora restored', w.document.documentElement.getAttribute('data-theme') === 'aurora');

  click(qa('.view-head .btn')[0]);
  await settle(4000);
  const rows = qa('tbody tr');
  check('diagnostics ran', rows.length >= 6, `(got ${rows.length})`);
  const failedRows = rows.filter((r) => r.querySelector('svg[style*="--err"]'));
  check(
    'all diagnostics passed',
    failedRows.length === 0,
    failedRows.map((r) => `\n      → ${(r.textContent ?? '').slice(0, 140)}`).join(''),
  );

  process.stdout.write('\nCommand palette\n');
  await act(async () => {
    w.dispatchEvent(
      new w.KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
    );
  });
  await settle(200);
  check('palette opened', !!q('.palette-panel'));
  check('palette has results', qa('.palette-item').length > 5);
  await typeInto(q('.palette-input')!, 'abyss');
  await settle(240);
  check('palette input took the query', (q('.palette-input') as HTMLInputElement)?.value === 'abyss');
  check('palette filters to the theme', qa('.palette-item').length >= 1 && /Abyssal/.test(q('.palette-item')?.textContent ?? ''));
  click(q('.palette-item'));
  await settle(300);
  check('palette action applied theme', w.document.documentElement.getAttribute('data-theme') === 'abyss');
  check('palette closed after run', !q('.palette-panel'));

  process.stdout.write('\nPersistence\n');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 300));
  });
  const { db: idb, STORE } = require('../src/store/db');
  const convs = await idb.getAll(STORE.conversations);
  check('conversations persisted to IndexedDB', convs.length >= 1, `(got ${convs.length})`);
  check('persisted conversation has messages', (convs[0]?.messages ?? []).length >= 2);

  if (qa('.theme-card')[0]) {
    click(qa('.theme-card')[0]);
    await settle(150);
    check('theme restored to aurora', w.document.documentElement.getAttribute('data-theme') === 'aurora');
  }

  process.stdout.write(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stdout.write(`\nSMOKE TEST CRASHED: ${e?.stack ?? e}\n`);
  process.exit(2);
});
