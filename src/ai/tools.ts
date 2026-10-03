/**
 * Tool registry.
 *
 * These are the functions the engine (and the Agent view) can actually call.
 * Each tool declares a JSON-schema-style parameter list so the planner can
 * reason about arguments, and returns a structured result that the UI renders
 * as a card *and* the engine folds into its answer — so a calculation shows its
 * real value rather than a plausible-looking guess.
 */

import { AngleMode, evaluate, formatNumber, symbolicForm, spokenToExpression } from './expression';
import { ConversionError, convert, listCategories, unitsFor } from './units';
import { keywords, readabilityLabel, sentiment, summarize, textStats } from './analysis';
import { detectLanguage, estimateTokens, splitSentences, tokenize } from './tokenizer';
import { store } from './vectorStore';
import { KNOWLEDGE } from './knowledge';
import { hash32 } from './embeddings';

export interface ParamSpec {
  type: 'string' | 'number' | 'boolean' | 'enum';
  description: string;
  enum?: string[];
  default?: unknown;
  optional?: boolean;
}

export interface ToolResult {
  ok: boolean;
  /** One-line summary shown in the tool chip and used by the composer. */
  summary: string;
  /** Markdown body rendered in the tool card. */
  detail?: string;
  /** Structured payload for programmatic use. */
  data?: unknown;
  error?: string;
}

export interface ToolDef {
  name: string;
  label: string;
  description: string;
  icon: string;
  parameters: Record<string, ParamSpec>;
  required: string[];
  run: (args: Record<string, string | number | boolean>) => ToolResult | Promise<ToolResult>;
}

const str = (args: Record<string, unknown>, key: string): string => {
  const v = args[key];
  return v === undefined || v === null ? '' : String(v);
};
/**
 * Numeric argument coercion. The empty string must fall through to the default:
 * `Number('')` is 0, which silently produced "base 0" and "1 sentence" bugs.
 */
const num = (args: Record<string, unknown>, key: string, fallback = 0): number => {
  const v = args[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const text = String(v ?? '').trim();
  if (!text) return fallback;
  const parsed = Number(text.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

function fail(message: string): ToolResult {
  return { ok: false, summary: message, error: message };
}

/**
 * Web Crypto only exists in a secure context (https / localhost). These guards
 * use typeof rather than truthiness so the fallbacks are genuinely reachable —
 * e.g. when the app is opened from a file:// URL.
 */
const hasRandomUUID = (): boolean => typeof globalThis.crypto?.randomUUID === 'function';
const hasGetRandomValues = (): boolean => typeof globalThis.crypto?.getRandomValues === 'function';
const hasSubtle = (): boolean => typeof globalThis.crypto?.subtle?.digest === 'function';

// ─────────────────────────────── tools ───────────────────────────────

const calculate: ToolDef = {
  name: 'calculate',
  label: 'Calculator',
  description:
    'Evaluate a mathematical expression with a real parser. Supports + - * / % ^, parentheses, factorial (!), percent, comparisons, ~50 functions (sin, cos, sqrt, log, gcd, ncr…) and constants (pi, e, tau, phi, c, g).',
  icon: 'calculator',
  parameters: {
    expression: { type: 'string', description: 'The expression to evaluate, e.g. "sqrt(2)^2 + 12% of 350"' },
    angle_mode: { type: 'enum', enum: ['rad', 'deg'], description: 'Angle unit for trig functions', default: 'rad' },
  },
  required: ['expression'],
  run: (args) => {
    const raw = str(args, 'expression');
    if (!raw.trim()) return fail('No expression supplied.');
    const expression = /[a-z]/i.test(raw) && !/[+\-*/^%]/.test(raw) ? spokenToExpression(raw) : raw;
    try {
      const res = evaluate(expression, { angleMode: (str(args, 'angle_mode') as AngleMode) || 'rad' });
      const symbolic = symbolicForm(res.value);
      const lines = [
        `**${expression}** = **${res.formatted}**`,
        symbolic ? `\nExact form: \`${symbolic}\`` : '',
        `\nRaw value: \`${res.value}\``,
        res.steps.length > 1 ? `\n\n**Steps**\n${res.steps.map((s, i) => `${i + 1}. \`${s}\``).join('\n')}` : '',
      ].filter(Boolean);
      return {
        ok: true,
        summary: `${expression} = ${res.formatted}`,
        detail: lines.join(''),
        data: { expression, value: res.value, formatted: res.formatted, symbolic, steps: res.steps },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return fail(`Could not evaluate "${expression}": ${msg}`);
    }
  },
};

const convertUnits: ToolDef = {
  name: 'convert_units',
  label: 'Unit converter',
  description:
    'Convert between units of length, mass, temperature, data, time, speed, area, volume, energy, power, pressure, angle and frequency.',
  icon: 'ruler',
  parameters: {
    value: { type: 'number', description: 'Numeric amount to convert' },
    from: { type: 'string', description: 'Source unit, e.g. km, lb, °C, GB, mph' },
    to: { type: 'string', description: 'Target unit. Omit to see a comparison table.', optional: true },
  },
  required: ['value', 'from'],
  run: (args) => {
    try {
      const res = convert(num(args, 'value'), str(args, 'from'), str(args, 'to') || undefined);
      const table = res.all.map((r) => `| \`${r.unit}\` | ${r.name} | ${r.text} |`).join('\n');
      return {
        ok: true,
        summary: res.formatted,
        detail: [
          `### ${res.formatted}`,
          res.note ? `> ${res.note}` : '',
          `\n**Other units in the same category** (${res.kind})\n\n| Unit | Name | Value |\n|---|---|---|\n${table}`,
        ].filter(Boolean).join('\n'),
        data: res,
      };
    } catch (e) {
      return fail(e instanceof ConversionError ? e.message : String(e));
    }
  },
};

const convertBase: ToolDef = {
  name: 'convert_base',
  label: 'Base converter',
  description: 'Convert an integer between bases 2–36 (binary, octal, decimal, hexadecimal…).',
  icon: 'hash',
  parameters: {
    value: { type: 'string', description: 'The number, optionally prefixed with 0x / 0b / 0o' },
    from_base: { type: 'number', description: 'Source base (2-36). Inferred from prefix when omitted.', optional: true },
    to_base: { type: 'number', description: 'Target base (2-36)', default: 10, optional: true },
  },
  required: ['value'],
  run: (args) => {
    const raw = str(args, 'value').trim().replace(/[\s_]/g, '');
    let base = num(args, 'from_base', NaN);
    let digits = raw;
    if (Number.isNaN(base)) {
      if (/^0x/i.test(raw)) { base = 16; digits = raw.slice(2); }
      else if (/^0b/i.test(raw)) { base = 2; digits = raw.slice(2); }
      else if (/^0o/i.test(raw)) { base = 8; digits = raw.slice(2); }
      else base = /^[01]+$/.test(raw) ? 2 : 10;
    }
    if (base < 2 || base > 36) return fail('Base must be between 2 and 36.');
    const negative = digits.startsWith('-');
    if (negative) digits = digits.slice(1);
    const value = parseInt(digits, base);
    if (Number.isNaN(value)) return fail(`"${digits}" is not valid base-${base}.`);
    const signed = negative ? -value : value;
    if (!Number.isSafeInteger(signed)) return fail('Value exceeds safe integer range (2^53-1).');
    const toBase = Math.min(36, Math.max(2, num(args, 'to_base', 10)));
    const rows = [2, 8, 10, 16, 36]
      .filter((b, i, arr) => arr.indexOf(b) === i)
      .map((b) => `| ${b} | \`${(negative ? '-' : '') + Math.abs(signed).toString(b).toUpperCase()}\` |`)
      .join('\n');
    const target = (negative ? '-' : '') + Math.abs(signed).toString(toBase).toUpperCase();
    return {
      ok: true,
      summary: `${raw} (base ${base}) = ${target} (base ${toBase})`,
      detail: `### ${signed} in several bases\n\n| Base | Value |\n|---|---|\n${rows}\n\nGrouped binary: \`${groupBinary(signed)}\``,
      data: { decimal: signed, base, target, toBase, hex: Math.abs(signed).toString(16).toUpperCase() },
    };
  },
};

function groupBinary(n: number): string {
  const b = Math.abs(n).toString(2);
  return (n < 0 ? '-' : '') + b.padStart(Math.ceil(b.length / 4) * 4, '0').replace(/(.{4})/g, '$1 ').trim();
}

const datetime: ToolDef = {
  name: 'datetime',
  label: 'Date & time',
  description: 'Report the current date and time, convert a Unix timestamp, or add/subtract a duration from a date.',
  icon: 'clock',
  parameters: {
    op: { type: 'enum', enum: ['now', 'from_timestamp', 'format'], description: 'Operation', default: 'now' },
    value: { type: 'string', description: 'Timestamp (seconds or ms) or ISO date, depending on op', optional: true },
    timezone: { type: 'string', description: 'IANA timezone, e.g. Asia/Kolkata. Defaults to the browser zone.', optional: true },
  },
  required: [],
  run: (args) => {
    const op = str(args, 'op') || 'now';
    const tz = str(args, 'timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
    let date = new Date();
    try {
      if (op === 'from_timestamp' && str(args, 'value')) {
        const raw = Number(str(args, 'value'));
        date = new Date(String(raw).length <= 11 ? raw * 1000 : raw);
      } else if (op === 'format' && str(args, 'value')) {
        date = new Date(str(args, 'value'));
      }
      if (Number.isNaN(date.getTime())) return fail('Could not parse that date or timestamp.');
      const fmt = (opts: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: tz }).format(date);
      const utc = date.toISOString();
      const rows = [
        ['Local date', fmt({ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })],
        ['Local time', fmt({ hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })],
        ['Timezone', `${tz} (UTC${offsetLabel(date, tz)})`],
        ['ISO 8601 (UTC)', utc],
        ['Unix seconds', String(Math.floor(date.getTime() / 1000))],
        ['Unix milliseconds', String(date.getTime())],
        ['Day of year', String(dayOfYear(date))],
        ['ISO week', `W${isoWeek(date)}`],
        ['Leap year', isLeap(date.getFullYear()) ? 'Yes' : 'No'],
      ];
      return {
        ok: true,
        summary: `${fmt({ year: 'numeric', month: 'short', day: '2-digit' })} ${fmt({ hour: '2-digit', minute: '2-digit', hour12: false })} ${tz}`,
        detail: `| Property | Value |\n|---|---|\n${rows.map(([k, v]) => `| ${k} | \`${v}\` |`).join('\n')}`,
        data: { iso: utc, epoch: date.getTime(), timezone: tz, rows: Object.fromEntries(rows) },
      };
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
  },
};

function offsetLabel(d: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(d);
  return parts.find((p) => p.type === 'timeZoneName')?.value.replace('GMT', '') || '';
}
function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86400000) + 1;
}
function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

const summarizeTool: ToolDef = {
  name: 'summarize',
  label: 'Summariser',
  description: 'Produce an extractive summary of text using salience, semantic centrality and MMR de-duplication.',
  icon: 'list',
  parameters: {
    text: { type: 'string', description: 'Text to summarise' },
    sentences: { type: 'number', description: 'Target summary length in sentences', default: 4, optional: true },
    query: { type: 'string', description: 'Optional focus — biases the summary toward this angle', optional: true },
  },
  required: ['text'],
  run: (args) => {
    const text = str(args, 'text');
    if (text.trim().length < 40) return fail('Need at least a couple of sentences to summarise.');
    const res = summarize(text, Math.max(1, num(args, 'sentences', 4)), str(args, 'query') || undefined);
    const stats = textStats(text);
    return {
      ok: true,
      summary: `Summarised ${stats.sentences} sentences → ${res.sentences.length} (${Math.round(res.ratio * 100)}% of original length)`,
      detail: [
        `### Summary`,
        res.summary,
        `\n> Method: ${res.method} · compression ${(100 - res.ratio * 100).toFixed(1)}%`,
        `\n**Key sentences by weight**`,
        ...res.sentences.map((s, i) => `${i + 1}. _(${s.score.toFixed(3)})_ ${s.text}`),
        `\n**Keywords:** ${keywords(text, 8).map((k) => `\`${k.term}\``).join(' ')}`,
      ].join('\n'),
      data: res,
    };
  },
};

const analyseText: ToolDef = {
  name: 'analyse_text',
  label: 'Text analytics',
  description: 'Compute word/sentence counts, readability scores, lexical diversity, reading time and keyword weights.',
  icon: 'chart',
  parameters: { text: { type: 'string', description: 'Text to analyse' } },
  required: ['text'],
  run: (args) => {
    const text = str(args, 'text');
    if (!text.trim()) return fail('Nothing to analyse.');
    const s = textStats(text);
    const mins = Math.max(1, Math.round(s.readingTimeSec / 60));
    const rows: Array<[string, string]> = [
      ['Words', s.words.toLocaleString()],
      ['Sentences', s.sentences.toLocaleString()],
      ['Paragraphs', s.paragraphs.toLocaleString()],
      ['Characters', `${s.chars.toLocaleString()} (${s.charsNoSpaces.toLocaleString()} without spaces)`],
      ['Unique words', `${s.uniqueWords.toLocaleString()} (${(s.lexicalDiversity * 100).toFixed(1)}% diversity)`],
      ['Avg sentence', `${s.avgSentenceLength.toFixed(1)} words`],
      ['Avg word', `${s.avgWordLength.toFixed(1)} characters`],
      ['Polysyllabic words', s.longWords.toLocaleString()],
      ['Flesch reading ease', `${s.fleschReadingEase.toFixed(1)} — ${readabilityLabel(s.fleschReadingEase)}`],
      ['Flesch-Kincaid grade', s.fleschKincaidGrade.toFixed(1)],
      ['Reading time', `~${mins} min (${s.readingTimeSec}s at 238 wpm)`],
      ['Speaking time', `~${Math.max(1, Math.round(s.speakingTimeSec / 60))} min at 150 wpm`],
      ['Estimated tokens', estimateTokens(text).toLocaleString()],
    ];
    return {
      ok: true,
      summary: `${s.words.toLocaleString()} words · ${s.sentences} sentences · Flesch ${s.fleschReadingEase.toFixed(0)} · ~${mins} min read`,
      detail: [
        `| Metric | Value |\n|---|---|\n${rows.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}`,
        `\n**Top keywords**\n\n${s.topKeywords
          .map((k) => `- \`${k.term}\` — ${k.count}× (weight ${k.weight.toFixed(3)})`)
          .join('\n')}`,
      ].join('\n'),
      data: s,
    };
  },
};

const sentimentTool: ToolDef = {
  name: 'sentiment',
  label: 'Sentiment',
  description: 'Lexicon-based polarity scoring with negation scopes, intensifiers and contrast handling.',
  icon: 'gauge',
  parameters: { text: { type: 'string', description: 'Text to score' } },
  required: ['text'],
  run: (args) => {
    const text = str(args, 'text');
    if (!text.trim()) return fail('Nothing to score.');
    const s = sentiment(text);
    const bar = (score: number) => {
      const filled = Math.round(((score + 1) / 2) * 20);
      return '█'.repeat(filled) + '░'.repeat(20 - filled);
    };
    const perSentence = splitSentences(text).slice(0, 8).map((sent, i) => {
      const r = sentiment(sent);
      return `${i + 1}. ${r.label === 'neutral' ? '○' : r.label === 'positive' ? '＋' : '−'} \`${r.score.toFixed(2)}\` ${sent}`;
    });
    return {
      ok: true,
      summary: `${s.label.toUpperCase()} (${s.score}) · confidence ${(s.confidence * 100).toFixed(0)}%`,
      detail: [
        `### ${s.label.toUpperCase()} — score ${s.score}`,
        `\`${bar(s.score)}\`  −1 ← 0 → +1`,
        s.positives.length ? `\n**Positive terms:** ${s.positives.map((t) => `\`${t}\``).join(' ')}` : '',
        s.negatives.length ? `\n**Negative terms:** ${s.negatives.map((t) => `\`${t}\``).join(' ')}` : '',
        s.negations ? `\n**Negations detected:** ${s.negations}` : '',
        perSentence.length > 1 ? `\n\n**Per sentence**\n${perSentence.join('\n')}` : '',
      ].filter(Boolean).join('\n'),
      data: s,
    };
  },
};

const regexTool: ToolDef = {
  name: 'regex_test',
  label: 'Regex tester',
  description: 'Run a regular expression against text and list every match with its capture groups and position.',
  icon: 'asterisk',
  parameters: {
    pattern: { type: 'string', description: 'Regular expression body (no slashes)' },
    text: { type: 'string', description: 'Subject text' },
    flags: { type: 'string', description: 'Regex flags', default: 'g', optional: true },
  },
  required: ['pattern', 'text'],
  run: (args) => {
    const pattern = str(args, 'pattern');
    const text = str(args, 'text');
    const flags = str(args, 'flags') || 'g';
    try {
      const re = new RegExp(pattern, flags.includes('g') ? flags : `${flags}g`);
      const matches: Array<{ match: string; index: number; groups: string[]; named: Record<string, string> }> = [];
      let m: RegExpExecArray | null;
      let guard = 0;
      while ((m = re.exec(text)) !== null && guard++ < 500) {
        matches.push({
          match: m[0],
          index: m.index,
          groups: m.slice(1).map((g) => g ?? ''),
          named: (m.groups ?? {}) as Record<string, string>,
        });
        if (m[0] === '') re.lastIndex++;
      }
      if (!matches.length) {
        return {
          ok: true,
          summary: `No matches for /${pattern}/${flags}`,
          detail: `The pattern \`/${pattern}/${flags}\` compiled successfully but matched nothing in ${text.length} characters of text.`,
          data: { pattern, flags, matches: [] },
        };
      }
      const table = matches
        .slice(0, 40)
        .map((x, i) => `| ${i + 1} | ${x.index} | \`${escMd(x.match)}\` | ${x.groups.length ? x.groups.map((g) => `\`${escMd(g)}\``).join(', ') : '—'} |`)
        .join('\n');
      return {
        ok: true,
        summary: `${matches.length} match${matches.length === 1 ? '' : 'es'} for /${pattern}/${flags}`,
        detail: [
          `**Pattern:** \`/${pattern}/${flags}\``,
          `\n| # | Index | Match | Groups |\n|---|---|---|---|\n${table}`,
          matches.length > 40 ? `\n_…and ${matches.length - 40} more._` : '',
          `\n**Replacements preview:** \`${escMd(text.replace(new RegExp(pattern, flags), '⟪$&⟫')).slice(0, 400)}\``,
        ].filter(Boolean).join('\n'),
        data: { pattern, flags, count: matches.length, matches },
      };
    } catch (e) {
      return fail(e instanceof Error ? `Invalid regular expression: ${e.message}` : String(e));
    }
  },
};

function escMd(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, '⏎').replace(/`/g, "'");
}

const jsonTool: ToolDef = {
  name: 'json_format',
  label: 'JSON validator',
  description: 'Validate and pretty-print JSON, reporting the exact parse error position and a shape summary.',
  icon: 'braces',
  parameters: {
    json: { type: 'string', description: 'JSON text' },
    indent: { type: 'number', description: 'Indent width', default: 2, optional: true },
  },
  required: ['json'],
  run: (args) => {
    const raw = str(args, 'json');
    const indent = Math.min(8, Math.max(0, num(args, 'indent', 2)));
    try {
      const parsed = JSON.parse(raw);
      const pretty = JSON.stringify(parsed, null, indent);
      const shape = describeShape(parsed);
      return {
        ok: true,
        summary: `Valid JSON · ${pretty.length.toLocaleString()} characters · ${shape}`,
        detail: `**Valid JSON.** Shape: ${shape}\n\n\`\`\`json\n${pretty.length > 6000 ? `${pretty.slice(0, 6000)}\n… truncated …` : pretty}\n\`\`\``,
        data: { valid: true, shape, formatted: pretty },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const posMatch = msg.match(/position (\d+)/);
      const pos = posMatch ? Number(posMatch[1]) : -1;
      const context = pos >= 0 ? `\n\n\`\`\`\n${raw.slice(Math.max(0, pos - 40), pos)}⟪HERE⟫${raw.slice(pos, pos + 40)}\n\`\`\`` : '';
      return {
        ok: false,
        summary: `Invalid JSON — ${msg}`,
        error: msg,
        detail: `**Parse error:** ${msg}${context}`,
        data: { valid: false, position: pos },
      };
    }
  },
};

function describeShape(v: unknown, depth = 0): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) {
    const inner = v.length ? describeShape(v[0], depth + 1) : 'empty';
    return `array[${v.length}] of ${inner}`;
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v as object);
    if (depth > 1) return `object{${keys.length} keys}`;
    return `object{${keys.slice(0, 6).join(', ')}${keys.length > 6 ? ', …' : ''}}`;
  }
  return typeof v;
}

const hashTool: ToolDef = {
  name: 'hash_text',
  label: 'Cryptographic hash',
  description: 'Compute a SHA-1, SHA-256 or SHA-512 digest using the Web Crypto API.',
  icon: 'shield',
  parameters: {
    text: { type: 'string', description: 'Input text' },
    algorithm: { type: 'enum', enum: ['SHA-256', 'SHA-1', 'SHA-512'], description: 'Digest algorithm', default: 'SHA-256', optional: true },
  },
  required: ['text'],
  run: async (args) => {
    const text = str(args, 'text');
    const algorithm = (str(args, 'algorithm') || 'SHA-256').toUpperCase().replace('_', '-');
    const algo = ['SHA-1', 'SHA-256', 'SHA-512'].includes(algorithm) ? algorithm : 'SHA-256';
    try {
      if (!hasSubtle()) throw new Error('Web Crypto unavailable');
      const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
      const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      const grouped = hex.replace(/(.{8})/g, '$1 ').trim();
      return {
        ok: true,
        summary: `${algo}: ${hex.slice(0, 16)}… (${hex.length * 4} bits)`,
        detail: `**${algo}** of ${text.length} characters\n\n\`\`\`\n${grouped}\n\`\`\`\n\nBase64: \`${btoa(String.fromCharCode(...new Uint8Array(buf)))}\``,
        data: { algorithm: algo, hex, base64: btoa(String.fromCharCode(...new Uint8Array(buf))) },
      };
    } catch {
      // Deterministic non-cryptographic fallback (e.g. file:// without secure context).
      const h = hash32(text).toString(16).padStart(8, '0');
      return {
        ok: true,
        summary: `Web Crypto unavailable — FNV-style fingerprint ${h}`,
        detail: `> ⚠️ \`crypto.subtle\` requires a secure context (https or localhost), so a non-cryptographic fingerprint was produced instead.\n\n\`\`\`\n${h.repeat(4)}\n\`\`\``,
        data: { algorithm: 'fallback-fnv32', hex: h.repeat(4) },
      };
    }
  },
};

const uuidTool: ToolDef = {
  name: 'make_uuid',
  label: 'UUID generator',
  description: 'Generate RFC 4122 version 4 identifiers.',
  icon: 'key',
  parameters: { count: { type: 'number', description: 'How many to generate (1-50)', default: 1, optional: true } },
  required: [],
  run: (args) => {
    const count = Math.min(50, Math.max(1, num(args, 'count', 1)));
    const make = (): string => {
      if (hasRandomUUID()) return crypto.randomUUID();
      const bytes = new Uint8Array(16);
      if (hasGetRandomValues()) crypto.getRandomValues(bytes);
      else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };
    const ids = Array.from({ length: count }, make);
    return {
      ok: true,
      summary: ids.length === 1 ? ids[0] : `${ids.length} UUIDv4 identifiers generated`,
      detail: `\`\`\`\n${ids.join('\n')}\n\`\`\``,
      data: { ids },
    };
  },
};

const randomTool: ToolDef = {
  name: 'random_number',
  label: 'Random numbers',
  description: 'Draw cryptographically-seeded uniform random integers or floats in a range.',
  icon: 'dice',
  parameters: {
    min: { type: 'number', description: 'Lower bound (inclusive)', default: 0, optional: true },
    max: { type: 'number', description: 'Upper bound (inclusive)', default: 100, optional: true },
    count: { type: 'number', description: 'How many draws (1-200)', default: 1, optional: true },
    integer: { type: 'boolean', description: 'Integers only', default: true, optional: true },
  },
  required: [],
  run: (args) => {
    const min = num(args, 'min', 0);
    const max = num(args, 'max', 100);
    if (min >= max) return fail('min must be less than max.');
    const count = Math.min(200, Math.max(1, Math.round(num(args, 'count', 1))));
    const integer = args.integer !== false && args.integer !== 'false';
    const bytes = new Uint32Array(count);
    if (hasGetRandomValues()) crypto.getRandomValues(bytes);
    else for (let i = 0; i < count; i++) bytes[i] = Math.floor(Math.random() * 2 ** 32);
    const draws = [...bytes].map((b) => {
      const u = b / 2 ** 32;
      return integer ? Math.floor(min + u * (max - min + 1)) : Number((min + u * (max - min)).toFixed(6));
    });
    const sum = draws.reduce((a, b) => a + b, 0);
    const mean = sum / draws.length;
    const sd = Math.sqrt(draws.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, draws.length - 1));
    return {
      ok: true,
      summary: draws.length === 1 ? String(draws[0]) : `${draws.length} draws in [${min}, ${max}] · mean ${mean.toFixed(2)}`,
      detail: [
        `**Range** [${min}, ${max}] · **${integer ? 'integer' : 'float'}** · **${draws.length}** draw(s) · source: \`${hasGetRandomValues() ? 'crypto.getRandomValues' : 'Math.random'}\``,
        `\n\`\`\`\n${draws.join(draws.length > 20 ? ', ' : '\n')}\n\`\`\``,
        draws.length > 1 ? `\nSum ${formatNumber(sum)} · mean ${mean.toFixed(4)} · std dev ${sd.toFixed(4)} · min ${Math.min(...draws)} · max ${Math.max(...draws)}` : '',
      ].filter(Boolean).join('\n'),
      data: { draws, min, max, mean, sd },
    };
  },
};

const searchKnowledge: ToolDef = {
  name: 'search_knowledge',
  label: 'Knowledge search',
  description: 'Semantic retrieval over the built-in corpus and any documents you have indexed. Returns ranked passages with scores.',
  icon: 'search',
  parameters: {
    query: { type: 'string', description: 'What to look for' },
    k: { type: 'number', description: 'How many passages to return (1-12)', default: 5, optional: true },
    scope: { type: 'enum', enum: ['all', 'knowledge', 'documents'], description: 'Restrict the search corpus', default: 'all', optional: true },
  },
  required: ['query'],
  run: (args) => {
    const query = str(args, 'query');
    if (!query.trim()) return fail('Empty query.');
    const k = Math.min(12, Math.max(1, num(args, 'k', 5)));
    const scope = str(args, 'scope') || 'all';
    const kinds =
      scope === 'knowledge' ? (['knowledge'] as const) : scope === 'documents' ? (['document', 'note'] as const) : (['knowledge', 'document', 'note'] as const);
    const hits = store.search(query, k, [...kinds] as never);
    if (!hits.length) {
      return {
        ok: false,
        summary: `No passages matched "${query}"`,
        error: 'empty-index',
        detail: `Nothing in the ${scope} index scored above the relevance threshold for **${query}**.`,
      };
    }
    const rows = hits
      .map((h, i) => ({
        rank: i + 1,
        title: h.chunk.sourceTitle,
        score: h.score,
        semantic: h.semantic,
        text: h.chunk.text,
        sourceId: h.chunk.sourceId,
      }));
    return {
      ok: true,
      summary: `${hits.length} passage(s) · top score ${(hits[0].score * 100).toFixed(0)}% · "${hits[0].chunk.sourceTitle}"`,
      detail: hits
        .map(
          (h, i) =>
            `**${i + 1}. ${h.chunk.sourceTitle}** · relevance ${(h.score * 100).toFixed(1)}% (semantic ${(h.semantic * 100).toFixed(0)}%)\n> ${h.chunk.text.length > 500 ? `${h.chunk.text.slice(0, 500)}…` : h.chunk.text}`,
        )
        .join('\n\n'),
      data: rows,
    };
  },
};

const codeAnalyze: ToolDef = {
  name: 'code_analyze',
  label: 'Code analysis',
  description: 'Static analysis of a snippet: language detection, line breakdown, complexity estimate, structure and common smell detection.',
  icon: 'code',
  parameters: {
    code: { type: 'string', description: 'Source code' },
    language: { type: 'string', description: 'Language hint (auto-detected when omitted)', optional: true },
  },
  required: ['code'],
  run: (args) => {
    const code = str(args, 'code');
    if (!code.trim()) return fail('No code supplied.');
    const language = detectLanguage(code, str(args, 'language') || undefined);
    const lines = code.split('\n');
    const blank = lines.filter((l) => !l.trim()).length;
    const commentRe = /^\s*(\/\/|#(?!include|define)|\/\*|\*|--|<!--)/;
    const comment = lines.filter((l) => commentRe.test(l)).length;
    const codeLines = lines.length - blank - comment;

    // Cyclomatic complexity: decision points + 1 per function-like scope.
    const decisionRe = /\b(if|else if|elif|for|while|case|catch|except)\b|\?\?|\?\.|\|\||&&|\?(?![.:])/g;
    const decisions = (code.match(decisionRe) ?? []).length;
    // Counting callable scopes. Note there is deliberately no leading \b in
    // front of the whole group: `=>` is not preceded by a word character, so a
    // global \b made every arrow function invisible. Control keywords are
    // excluded by name so `if (x) {` is not counted as a function.
    const fnRe = new RegExp(
      [
        '\\bfunction\\s*\\*?\\s*[\\w$]*',
        '\\b(?:const|let|var)\\s+[\\w$]+\\s*=\\s*(?:async\\s*)?(?:\\([^)]*\\)|[\\w$]+)\\s*=>',
        '\\bdef\\s+[\\w]+',
        '\\bfn\\s+[\\w]+',
        '\\bfunc\\s+(?:\\([^)]*\\)\\s*)?[\\w]+',
        '\\bclass\\s+[\\w]+',
        '\\binterface\\s+[\\w]+',
        '\\btype\\s+[\\w]+\\s*=',
        '\\b(?!if\\b|for\\b|while\\b|switch\\b|catch\\b|return\\b|else\\b|do\\b|try\\b|with\\b|using\\b|await\\b|typeof\\b|new\\b)([\\w$]+)\\s*\\([^)]*\\)\\s*(?:=>|\\{)',
        '=>',
      ].join('|'),
      'g',
    );
    const functions = (code.match(fnRe) ?? []).length;
    const complexity = 1 + decisions;
    const maxLineLen = lines.reduce((a, l) => Math.max(a, l.length), 0);
    const avgLineLen = codeLines ? code.length / codeLines : 0;

    const smells: Array<{ level: 'warn' | 'info' | 'good'; text: string }> = [];
    const push = (level: 'warn' | 'info' | 'good', text: string) => smells.push({ level, text });
    if (/\bvar\s/.test(code) && /javascript|typescript|jsx|tsx/.test(language)) push('warn', 'Uses `var`; prefer `const`/`let` for block scoping.');
    if (/[^=!<>]==[^=]/.test(code) && /javascript|typescript|php/.test(language)) push('warn', 'Loose equality `==` coerces types — use `===`.');
    if (/console\.log|print\(|System\.out|fmt\.Println/.test(code)) push('info', 'Debug output left in the source.');
    if (/TODO|FIXME|HACK|XXX/.test(code)) push('info', `${(code.match(/TODO|FIXME|HACK|XXX/g) ?? []).length} TODO/FIXME marker(s).`);
    if (/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/.test(code)) push('warn', 'Empty catch block swallows errors silently.');
    if (/\beval\s*\(|new Function\(/.test(code)) push('warn', '`eval`/`new Function` executes arbitrary strings — a code-injection risk.');
    if (maxLineLen > 120) push('info', `Longest line is ${maxLineLen} characters; consider wrapping for readability.`);
    if (complexity > 20) push('warn', `Estimated cyclomatic complexity ${complexity} — this unit is hard to test exhaustively.`);
    if (lines.some((l) => l.length > 0 && l.trim().length === 0)) push('info', 'Lines contain trailing whitespace.');
    if (!smells.length) push('good', 'No obvious smells detected in the heuristics covered.');

    const ids = [...new Set(tokenize(code).filter((t) => t.kind === 'word').map((t) => t.value))];
    return {
      ok: true,
      summary: `${language} · ${codeLines} code lines · complexity ≈${complexity} · ${functions} callable(s) · ${smells.filter((s) => s.level === 'warn').length} warning(s)`,
      detail: [
        `### Static analysis — ${language}`,
        `| Metric | Value |\n|---|---|\n` +
          `| Language | ${language} |\n` +
          `| Lines | ${lines.length} (${codeLines} code, ${comment} comment, ${blank} blank) |\n` +
          `| Characters | ${code.length.toLocaleString()} |\n` +
          `| Avg line length | ${avgLineLen.toFixed(1)} |\n` +
          `| Max line length | ${maxLineLen} |\n` +
          `| Decision points | ${decisions} |\n` +
          `| Cyclomatic complexity | ≈ ${complexity} |\n` +
          `| Callable scopes | ${functions} |\n` +
          `| Distinct identifiers | ${ids.length} |\n` +
          `| Est. tokens | ${estimateTokens(code)} |`,
        `\n**Findings**\n${smells.map((s) => `- ${s.level === 'warn' ? '⚠️' : s.level === 'good' ? '✅' : 'ℹ️'} ${s.text}`).join('\n')}`,
      ].join('\n'),
      data: { language, lines: lines.length, codeLines, comment, blank, complexity, functions, smells, maxLineLen, avgLineLen },
    };
  },
};

const colorTool: ToolDef = {
  name: 'convert_color',
  label: 'Colour converter',
  description: 'Convert a colour between hex, rgb, hsl and oklch, and report its WCAG contrast against black and white.',
  icon: 'palette',
  parameters: { color: { type: 'string', description: 'Colour as #hex, rgb(), hsl() or a CSS name' } },
  required: ['color'],
  run: (args) => {
    const input = str(args, 'color').trim();
    const rgb = parseColor(input);
    if (!rgb) return fail(`Could not parse "${input}" as a colour. Try #7c8cff, rgb(124 140 255) or "violet".`);
    const hex = `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
    const hsl = rgbToHsl(rgb);
    const oklch = rgbToOklch(rgb);
    const lum = relativeLuminance(rgb);
    const contrastW = (1.05) / (lum + 0.05);
    const contrastB = (lum + 0.05) / 0.05;
    const wcag = (ratio: number) =>
      `${ratio.toFixed(2)}:1 ${ratio >= 7 ? '(AAA)' : ratio >= 4.5 ? '(AA)' : ratio >= 3 ? '(AA large text only)' : '(fail)'}`;
    return {
      ok: true,
      summary: `${hex} · hsl(${hsl[0].toFixed(0)} ${hsl[1].toFixed(0)}% ${hsl[2].toFixed(0)}%) · contrast vs white ${contrastW.toFixed(2)}:1`,
      detail: [
        `| Space | Value |\n|---|---|\n` +
          `| HEX | \`${hex}\` |\n` +
          `| RGB | \`rgb(${rgb.map((v) => Math.round(v)).join(' ')})\` |\n` +
          `| HSL | \`hsl(${hsl[0].toFixed(1)} ${hsl[1].toFixed(1)}% ${hsl[2].toFixed(1)}%)\` |\n` +
          `| OKLCH | \`oklch(${(oklch[0] * 100).toFixed(2)}% ${oklch[1].toFixed(4)} ${oklch[2].toFixed(2)})\` |\n` +
          `| Relative luminance | ${lum.toFixed(4)} |`,
        `\n**Contrast**\n- vs white: ${wcag(contrastW)}\n- vs black: ${wcag(contrastB)}`,
        `\n**Tints & shades**\n\`${shades(rgb).join('  ')}\``,
      ].join('\n'),
      data: { hex, rgb, hsl, oklch, luminance: lum, contrastWhite: contrastW, contrastBlack: contrastB },
    };
  },
};

function shades(rgb: number[]): string[] {
  return [0.1, 0.25, 0.4, 0.6, 0.8, 1, 1.2, 1.4].map((f) => {
    const c = rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * f))));
    return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  });
}

const CSS_COLORS: Record<string, string> = {
  black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', lime: '#00ff00',
  blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', silver: '#c0c0c0',
  gray: '#808080', grey: '#808080', maroon: '#800000', olive: '#808000', purple: '#800080',
  teal: '#008080', navy: '#000080', orange: '#ffa500', pink: '#ffc0cb', brown: '#a52a2a',
  violet: '#ee82ee', indigo: '#4b0082', gold: '#ffd700', coral: '#ff7f50', salmon: '#fa8072',
  crimson: '#dc143c', turquoise: '#40e0d0', plum: '#dda0dd', orchid: '#da70d6', khaki: '#f0e68c',
};

function parseColor(input: string): [number, number, number] | null {
  let s = input.trim().toLowerCase();
  if (CSS_COLORS[s]) s = CSS_COLORS[s];
  if (s.startsWith('#')) {
    const h = s.slice(1);
    if (h.length === 3) return h.split('').map((c) => parseInt(c + c, 16)) as [number, number, number];
    if (h.length === 6) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
    if (h.length === 8) return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
    return null;
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(/[\s,/]+/).filter(Boolean).map((p) => (p.endsWith('%') ? (parseFloat(p) / 100) * 255 : parseFloat(p)));
    if (parts.length >= 3) return parts.slice(0, 3) as [number, number, number];
    return null;
  }
  const h = s.match(/hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/);
  if (h) return hslToRgb(Number(h[1]), Number(h[2]), Number(h[3]));
  return null;
}

function hslToRgb(hIn: number, sIn: number, lIn: number): [number, number, number] {
  const h = ((hIn % 360) + 360) % 360 / 360;
  const s = Math.min(100, Math.max(0, sIn)) / 100;
  const l = Math.min(100, Math.max(0, lIn)) / 100;
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

function rgbToHsl([r, g, b]: number[]): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance([r, g, b]: number[]): number {
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function rgbToOklch([r, g, b]: number[]): [number, number, number] {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const C = Math.sqrt(A * A + B * B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, H];
}

const unitInfo: ToolDef = {
  name: 'list_units',
  label: 'Unit reference',
  description: 'List the unit categories and the units recognised by the converter.',
  icon: 'book',
  parameters: { category: { type: 'string', description: 'Optional category filter, e.g. length', optional: true } },
  required: [],
  run: (args) => {
    const cat = str(args, 'category').toLowerCase();
    const cats = listCategories();
    const selected = cat && (cats as string[]).includes(cat) ? [cat as (typeof cats)[number]] : cats;
    const body = selected
      .map((c) => `**${c}** — ${unitsFor(c).map((u) => `\`${u.id}\``).join(' ')}`)
      .join('\n\n');
    return {
      ok: true,
      summary: `${selected.length} categor${selected.length === 1 ? 'y' : 'ies'} · ${selected.reduce((a, c) => a + unitsFor(c).length, 0)} units`,
      detail: body,
      data: { categories: selected.map((c) => ({ kind: c, units: unitsFor(c) })) },
    };
  },
};

export const TOOLS: ToolDef[] = [
  calculate,
  convertUnits,
  convertBase,
  datetime,
  summarizeTool,
  analyseText,
  sentimentTool,
  regexTool,
  jsonTool,
  hashTool,
  uuidTool,
  randomTool,
  searchKnowledge,
  codeAnalyze,
  colorTool,
  unitInfo,
];

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

export async function runTool(name: string, args: Record<string, string | number | boolean>): Promise<ToolResult> {
  const tool = TOOL_MAP.get(name);
  if (!tool) return fail(`Unknown tool "${name}".`);
  const missing = tool.required.filter((r) => {
    const v = args[r];
    return v === undefined || v === null || String(v).trim() === '';
  });
  if (missing.length) return fail(`Tool "${name}" needs: ${missing.join(', ')}`);
  try {
    return await tool.run(args);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

/** Serialise tool schemas for a provider function-calling request. */
export function toolSchemasForProviders(): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return TOOLS.filter((t) => t.name !== 'list_units').map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([k, v]) => [
            k,
            {
              type: v.type === 'enum' ? 'string' : v.type,
              description: v.description,
              ...(v.enum ? { enum: v.enum } : {}),
            },
          ]),
        ),
        required: t.required,
      },
    },
  }));
}

export { KNOWLEDGE };
