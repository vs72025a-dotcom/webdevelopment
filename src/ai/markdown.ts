/**
 * Markdown renderer.
 *
 * Security model: the *entire* source is HTML-escaped before any parsing
 * happens, so no authored or model-produced markup can ever reach the DOM as
 * markup. This module then re-introduces only its own tags. Link targets are
 * checked against a protocol allowlist — `javascript:`, `data:` and friends are
 * rendered as inert text.
 *
 * Code spans are lifted out into placeholders before inline parsing so their
 * contents can never be re-interpreted as emphasis or links.
 */

import { detectLanguage, Language } from './tokenizer';
import { escapeHtml, highlight } from './highlight';

export interface MarkdownOptions {
  /** Render `[1]` as a citation chip instead of a link. */
  citations?: boolean;
  /** Force a language for every fence that has no hint. */
  defaultLang?: Language;
}

const SAFE_PROTOCOL = /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i;

/** A parked piece of finished HTML, addressed by index in `spans`. */
interface CodeSpan {
  html: string;
}

/** Undo the document-level escape so a fence can be highlighted from raw source. */
function unescapeHtml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&'); // last, so &amp;lt; does not collapse to <
}

function safeHref(raw: string): string | null {
  const decoded = raw.replace(/&amp;/g, '&').trim();
  if (!decoded) return null;
  if (/^\s*(javascript|data|vbscript|file):/i.test(decoded)) return null;
  if (!SAFE_PROTOCOL.test(decoded)) return null;
  return raw;
}

/** Turn a fence hint into a known Language. */
function resolveLang(hint: string, code: string, fallback?: Language): Language {
  if (hint) {
    const h = hint.toLowerCase().trim();
    const map: Record<string, Language> = {
      js: 'javascript', javascript: 'javascript', node: 'javascript',
      ts: 'typescript', typescript: 'typescript',
      jsx: 'jsx', tsx: 'tsx', react: 'jsx',
      py: 'python', python: 'python', python3: 'python',
      sh: 'bash', bash: 'bash', shell: 'bash', zsh: 'bash', console: 'bash', terminal: 'bash',
      html: 'html', xml: 'html', svg: 'html', vue: 'html',
      css: 'css', scss: 'css', less: 'css',
      json: 'json', jsonc: 'json',
      sql: 'sql', mysql: 'sql', postgres: 'sql', psql: 'sql',
      go: 'go', golang: 'go', rust: 'rust', rs: 'rust',
      java: 'java', kotlin: 'java', swift: 'java',
      c: 'c', h: 'c', cpp: 'cpp', 'c++': 'cpp', cc: 'cpp', cxx: 'cpp',
      cs: 'csharp', csharp: 'csharp', 'c#': 'csharp',
      php: 'php', rb: 'ruby', ruby: 'ruby',
      yaml: 'yaml', yml: 'yaml', md: 'markdown', markdown: 'markdown',
    };
    if (map[h]) return map[h];
  }
  return fallback ?? detectLanguage(code);
}

// ─────────────────────────────── inline ───────────────────────────────

/**
 * Inline rendering.
 *
 * Order matters. Anything that produces an anchor or a code element is lifted
 * into a placeholder *before* the remaining passes run, otherwise the autolink
 * pass re-wraps URLs it just emitted (nested <a>) and emphasis rules corrupt
 * underscores inside hrefs. Placeholders are restored at the very end.
 */
function renderInline(text: string, spans: CodeSpan[], opts: MarkdownOptions): string {
  const hold = (html: string): string => `\u0000C${pushSpan(spans, html)}\u0000`;
  let s = text;

  // 1. Inline code spans (already escaped at document level).
  s = s.replace(/`([^`\n]+)`/g, (_m, code: string) => hold(`<code class="inline">${code}</code>`));

  // 2. Images — same bracket syntax as links, so they go first.
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_m, alt: string, src: string, title: string) => {
    const href = safeHref(src);
    if (!href) return alt;
    return hold(`<img src="${href}" alt="${alt}"${title ? ` title="${title}"` : ''} loading="lazy" />`);
  });

  // 3. Citation chips: [1] → superscript marker.
  if (opts.citations) {
    s = s.replace(/\[(\d{1,3})\]/g, (_m, n: string) => hold(`<sup class="cite" data-cite="${n}">${n}</sup>`));
  }

  // 4. Inline links.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_m, label: string, href: string, title: string) => {
    const safe = safeHref(href);
    if (!safe) return label;
    const external = /^https?:/i.test(unescapeHtml(safe));
    return hold(
      `<a href="${safe}"${title ? ` title="${title}"` : ''}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`,
    );
  });

  // 5. Bare autolinks — now safe, because real anchors are already parked.
  s = s.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<)"']+[a-zA-Z0-9\/_])/g, (_m, pre: string, url: string) => {
    const href = url.startsWith('www.') ? `https://${url}` : url;
    return `${pre}${hold(`<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`)}`;
  });

  // 6. Emphasis, strongest first.
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
  s = s.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^\w*])\*([^*\n]+?)\*(?![\w*])/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^\w_])_([^_\n]+?)_(?![\w_])/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+?)~~/g, '<del>$1</del>');
  s = s.replace(/==([^=]+?)==/g, '<mark>$1</mark>');

  // 7. Inline maths shown verbatim (no TeX engine bundled).
  s = s.replace(/\$\$([^$]+)\$\$/g, '<span class="math block">$1</span>');
  s = s.replace(/(?<![\\\w])\$([^$\n]+)\$(?!\d)/g, '<span class="math">$1</span>');

  // 8. Line breaks: explicit two-space, plus GFM-style single newlines in prose.
  s = s.replace(/ {2,}\n/g, '<br />\n').replace(/\n/g, '<br />\n');

  return s;
}

function pushSpan(spans: CodeSpan[], html: string): number {
  spans.push({ html });
  return spans.length - 1;
}

function restoreSpans(html: string, spans: CodeSpan[]): string {
  return html.replace(/\u0000C(\d+)\u0000/g, (_m, i: string) => spans[Number(i)]?.html ?? '');
}

// ─────────────────────────────── blocks ───────────────────────────────

interface TableSpec {
  head: string[];
  align: Array<'left' | 'center' | 'right' | null>;
  rows: string[][];
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let cur = '';
  let escaped = false;
  for (const ch of trimmed) {
    if (escaped) {
      cur += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '|') {
      cells.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function parseTable(lines: string[], start: number): { table: TableSpec; next: number } | null {
  const headLine = lines[start];
  const sepLine = lines[start + 1];
  if (!headLine || !sepLine || !headLine.includes('|')) return null;
  if (!/^\s*\|?[\s:|-]+\|?\s*$/.test(sepLine) || !sepLine.includes('-')) return null;
  const head = splitRow(headLine);
  const align = splitRow(sepLine).map((c) => {
    const l = c.startsWith(':');
    const r = c.endsWith(':');
    return l && r ? 'center' : r ? 'right' : l ? 'left' : null;
  });
  const rows: string[][] = [];
  let i = start + 2;
  while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
    rows.push(splitRow(lines[i]));
    i++;
  }
  return { table: { head, align, rows }, next: i };
}

interface ListItem {
  indent: number;
  ordered: boolean;
  start?: number;
  task?: 'open' | 'done';
  text: string;
  children: ListItem[];
}

function parseList(lines: string[], start: number): { items: ListItem[]; next: number } {
  const itemRe = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
  const items: ListItem[] = [];
  let i = start;
  while (i < lines.length) {
    const m = lines[i].match(itemRe);
    if (!m) break;
    const [, indentStr, marker, rest] = m;
    const ordered = /\d/.test(marker);
    let text = rest;
    let task: ListItem['task'];
    const taskMatch = text.match(/^\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      task = taskMatch[1].toLowerCase() === 'x' ? 'done' : 'open';
      text = taskMatch[2];
    }
    items.push({
      indent: indentStr.length,
      ordered,
      start: ordered ? Number(marker.replace(/\D/g, '')) : undefined,
      task,
      text,
      children: [],
    });
    i++;
    // Continuation lines (indented, not a new item) join the current item.
    while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !itemRe.test(lines[i])) {
      items[items.length - 1].text += `\n${lines[i].trim()}`;
      i++;
    }
  }
  return { items: nestList(items), next: i };
}

function nestList(flat: ListItem[]): ListItem[] {
  const root: ListItem[] = [];
  const stack: ListItem[] = [];
  for (const item of flat) {
    while (stack.length && stack[stack.length - 1].indent > item.indent) stack.pop();
    if (stack.length && stack[stack.length - 1].indent < item.indent) {
      stack[stack.length - 1].children.push(item);
      stack.push(item);
    } else {
      root.push(item);
      stack.length = 0;
      stack.push(item);
    }
  }
  return root;
}

function renderList(items: ListItem[], spans: CodeSpan[], opts: MarkdownOptions): string {
  if (!items.length) return '';
  const ordered = items[0].ordered;
  const tasks = items.some((i) => i.task);
  const tag = ordered ? 'ol' : 'ul';
  const start = ordered && items[0].start && items[0].start !== 1 ? ` start="${items[0].start}"` : '';
  const inner = items
    .map((item) => {
      const cls = item.task ? ` class="task${item.task === 'done' ? ' done' : ''}"` : '';
      const box = item.task
        ? `<span class="checkbox" aria-hidden="true">${item.task === 'done' ? '✓' : ''}</span>`
        : '';
      const text = renderInline(item.text, spans, opts);
      const kids = item.children.length ? renderList(item.children, spans, opts) : '';
      return `<li${cls}>${box}<span>${text}</span>${kids}</li>`;
    })
    .join('');
  return `<${tag}${start}${tasks ? ' class="tasklist"' : ''}>${inner}</${tag}>`;
}

const BLOCK_START = /^(#{1,6}\s|```|~~~|>\s?|\s*([-*+]|\d{1,9}[.)])\s|(\s*[-*_]){3,}\s*$|\|)/;

export function renderMarkdown(source: string, options: MarkdownOptions = {}): string {
  const opts: MarkdownOptions = { citations: true, ...options };
  const spans: CodeSpan[] = [];
  // Escape everything up front. From here on, nothing in `source` is markup.
  const lines = escapeHtml(source.replace(/\r\n?/g, '\n')).split('\n');
  const out: string[] = [];
  let i = 0;
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const body = paragraph.join('\n').trim();
    if (body) out.push(`<p>${renderInline(body, spans, opts)}</p>`);
    paragraph = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code
    const fence = line.match(/^\s*(```|~~~)\s*([\w+#-]*)\s*$/);
    if (fence) {
      flushParagraph();
      const close = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${close}\\s*$`).test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      // `buf` is escaped text; highlight() escapes what it emits, so hand it the
      // raw source or everything comes out double-encoded (&amp;lt;).
      const raw = unescapeHtml(buf.join('\n'));
      const lang = resolveLang(fence[2], raw, opts.defaultLang);
      const html = highlight(raw, lang);
      out.push(
        `<div class="codeblock" data-lang="${lang}"><div class="codebar"><span class="codelang">${lang}</span><div class="codebar-actions"><button class="copybtn" type="button" data-codelab title="Open snippet in Code Lab">Code Lab</button><button class="copybtn" type="button" data-copy>Copy</button></div></div><pre><code>${html}\n</code></pre></div>`,
      );
      continue;
    }

    // Heading
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length;
      const text = heading[2].replace(/\s+#+\s*$/, '');
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.push(`<h${level} id="${id}">${renderInline(text, spans, opts)}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/.test(line)) {
      flushParagraph();
      out.push('<hr />');
      i++;
      continue;
    }

    // Blockquote (recursive)
    if (/^\s{0,3}&gt;\s?/.test(line)) {
      flushParagraph();
      const buf: string[] = [];
      while (i < lines.length && (/^\s{0,3}&gt;\s?/.test(lines[i]) || (buf.length && lines[i].trim() && !BLOCK_START.test(lines[i])))) {
        buf.push(lines[i].replace(/^\s{0,3}&gt;\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'), options)}</blockquote>`);
      continue;
    }

    // Table
    if (line.includes('|') && lines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const parsed = parseTable(lines, i);
      if (parsed) {
        flushParagraph();
        const { table } = parsed;
        const alignAttr = (idx: number) => {
          const a = table.align[idx];
          return a ? ` style="text-align:${a}"` : '';
        };
        const thead = `<thead><tr>${table.head.map((h, idx) => `<th${alignAttr(idx)}>${renderInline(h, spans, opts)}</th>`).join('')}</tr></thead>`;
        const tbody = table.rows.length
          ? `<tbody>${table.rows.map((r) => `<tr>${table.head.map((_, idx) => `<td${alignAttr(idx)}>${renderInline(r[idx] ?? '', spans, opts)}</td>`).join('')}</tr>`).join('')}</tbody>`
          : '';
        out.push(`<div class="tablewrap"><table>${thead}${tbody}</table></div>`);
        i = parsed.next;
        continue;
      }
    }

    // List
    if (/^\s*([-*+]|\d{1,9}[.)])\s+/.test(line)) {
      flushParagraph();
      const parsed = parseList(lines, i);
      out.push(renderList(parsed.items, spans, opts));
      i = parsed.next;
      continue;
    }

    // Blank line closes a paragraph
    if (!line.trim()) {
      flushParagraph();
      i++;
      continue;
    }

    paragraph.push(line);
    i++;
  }
  flushParagraph();
  return restoreSpans(out.join('\n'), spans);
}

/** Strip markdown to plain text — used for previews, search and TTS. */
export function markdownToText(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*([-*+]|\d{1,9}[.)])\s+/gm, '')
    .replace(/[*_~`=|]/g, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}
