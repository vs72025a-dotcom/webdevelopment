/**
 * Tokenizer + text normalisation utilities.
 *
 * The on-device engine does not ship a 50k-token BPE table (that would bloat
 * the bundle for no measurable gain in retrieval quality). Instead it uses a
 * linguistically-motivated splitter that keeps contractions, camelCase,
 * snake_case, numbers, URLs and code identifiers intact, which is what the
 * hashing embedder downstream actually cares about.
 */

export interface Token {
  /** Lower-cased surface form used for features. */
  value: string;
  /** Original surface form. */
  raw: string;
  /** Character offset in the source string. */
  start: number;
  kind: TokenKind;
}

export type TokenKind = 'word' | 'number' | 'punct' | 'space' | 'code';

/** Languages we can detect and highlight. */
export const LANGUAGES = [
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'html',
  'css',
  'json',
  'bash',
  'sql',
  'go',
  'rust',
  'java',
  'c',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'yaml',
  'markdown',
  'text',
] as const;

export type Language = (typeof LANGUAGES)[number];

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'all', 'also', 'am', 'an', 'and', 'any', 'are', 'as',
  'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can',
  'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me',
  'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only',
  'or', 'other', 'our', 'ours', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such',
  'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'would', 'you',
  'your', 'yours',
]);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word);
}

/** Unicode-aware lower case + accent folding. */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Naive but effective English stemmer: strips common inflectional suffixes.
 * Deliberately conservative so "universe" does not collapse into "univers".
 */
export function stem(word: string): string {
  let w = word;
  if (w.length <= 3) return w;
  const rules: Array<[RegExp, string]> = [
    [/(ization|isations)$/, 'ize'],
    [/(iveness|fulness|ousness)$/, (w.match(/(iveness|fulness|ousness)$/)?.[1] ?? '').slice(0, -4)],
    [/(ational|alism|aliti)$/, 'al'],
    [/(ement|ance|ence|ment)$/, ''],
    [/(ies)$/, 'y'],
    [/(sses)$/, 'ss'],
    [/(shes|ches|xes|zes)$/, w.slice(0, -2)],
    [/(ing|edly)$/, ''],
    [/(edly|ied)$/, ''],
    [/(ness|less)$/, ''],
    [/(able|ible)$/, ''],
    [/(ly)$/, ''],
    [/(er|est)$/, ''],
    [/(s)$/, ''],
  ];
  for (const [re, rep] of rules) {
    if (re.test(w)) {
      const next = typeof rep === 'string' ? w.replace(re, rep) : rep;
      if (next.length >= 3) return next;
    }
  }
  return w;
}

const TOKEN_RE =
  /([A-Za-z]+(?:['\u2019][A-Za-z]+)*)|(\d+(?:[.,]\d+)*(?:%|px|em|rem|s|ms|kg|km|mb|gb|tb)?)|([^\sA-Za-z0-9])|(\s+)/g;

/** Split text into tokens with offsets, preserving code-ish identifiers. */
export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    const raw = m[0];
    const start = m.index;
    let kind: TokenKind = 'punct';
    if (m[1]) kind = 'word';
    else if (m[2]) kind = 'number';
    else if (m[4]) kind = 'space';
    out.push({ value: raw.toLowerCase(), raw, start, kind });
    if (raw.length > 14 && kind === 'word') {
      // Very long words are split on camelCase boundaries so identifiers match.
      const parts = raw.split(/(?=[A-Z])/);
      if (parts.length > 1) out.pop();
      for (const p of parts) {
        if (p) out.push({ value: p.toLowerCase(), raw: p, start, kind: 'code' });
      }
    }
  }
  return out;
}

/**
 * Fold British/American spelling variants onto one form.
 *
 * The corpus is written in British English ("quantisation", "normalise") while
 * users type either. Without folding, a query for "quantization" lost its best
 * match entirely — character n-grams alone were not enough to recover it.
 */
export function foldSpelling(word: string): string {
  return word
    .replace(/isation$/,'ization').replace(/isations$/,'izations')
    .replace(/ised$/,'ized').replace(/ising$/,'izing').replace(/ises$/,'izes')
    .replace(/ise$/,'ize')
    .replace(/ysed$/,'yzed').replace(/ysing$/,'yzing').replace(/yse$/,'yze')
    .replace(/colour/g,'color').replace(/behaviour/g,'behavior')
    .replace(/favour/g,'favor').replace(/honour/g,'honor').replace(/labour/g,'labor')
    .replace(/neighbour/g,'neighbor').replace(/humour/g,'humor')
    .replace(/centre$/,'center').replace(/metre$/,'meter').replace(/litre$/,'liter')
    .replace(/programme$/,'program').replace(/catalogue$/,'catalog')
    .replace(/defence$/,'defense').replace(/licence$/,'license')
    .replace(/practise$/,'practice').replace(/organis(ation|e)/g,'organiz$1');
}

/** Content words only: no stopwords, no punctuation, stemmed, spelling-folded. */
export function contentTerms(text: string): string[] {
  const terms: string[] = [];
  for (const t of tokenize(text)) {
    if (t.kind !== 'word' && t.kind !== 'number' && t.kind !== 'code') continue;
    const v = foldSpelling(t.value.replace(/[^a-z0-9']/g, ''));
    if (!v || v.length < 2 || isStopword(v)) continue;
    terms.push(v);
    const s = stem(v);
    if (s !== v) terms.push(s);
  }
  return terms;
}

/** Approximate BPE-style token count, used for cost/telemetry estimates. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // ~4 chars per token for English, but code and long words skew higher.
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(words, Math.round(text.length / 3.9));
}

/** Split prose into sentences (handles abbreviations and decimals). */
export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const abbrev = /(\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|e\.g|i\.e|Inc|Ltd|Fig|No|Vol|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec))\./gi;
  const guarded = clean.replace(abbrev, '$1<DOT>');
  const parts = guarded.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(\[])/);
  return parts.map((p) => p.replace(/<DOT>/g, '.').trim()).filter(Boolean);
}

/** Detect the most likely language of a code snippet. */
export function detectLanguage(code: string, hint?: string): Language {
  if (hint) {
    const h = hint.toLowerCase().trim();
    const aliases: Record<string, Language> = {
      js: 'javascript', node: 'javascript', mjs: 'javascript',
      ts: 'typescript', mts: 'typescript',
      py: 'python', python3: 'python',
      sh: 'bash', shell: 'bash', zsh: 'bash', console: 'bash',
      'c++': 'cpp', cc: 'cpp', hpp: 'cpp',
      cs: 'csharp', 'c#': 'csharp', dotnet: 'csharp',
      yml: 'yaml', md: 'markdown', golang: 'go', rs: 'rust',
      html5: 'html', xml: 'html', svg: 'html', vue: 'html',
      scss: 'css', sass: 'css', less: 'css',
      rb: 'ruby', pl: 'text',
    };
    if ((LANGUAGES as readonly string[]).includes(h)) return h as Language;
    if (aliases[h]) return aliases[h];
  }
  const c = code.trim();
  // React is decisive: hooks and JSX expressions cannot appear in plain HTML.
  const jsxHooks = /\b(useState|useEffect|useMemo|useCallback|useRef|useContext|React\.\w+|createRoot|render\()\b/.test(c);
  const jsxTags = /<[A-Z]\w*[\s/>]/.test(c) || (/<[a-z][\w-]*[\s/>][\s\S]*?\{\s*[\w.'"[(]/.test(c));
  const jsxAttr = /\b(className|onClick|onChange|onSubmit|htmlFor|tabIndex)\b/.test(c);
  const jsx = jsxHooks || jsxTags || jsxAttr;
  const tsSyntax = /:\s*(string|number|boolean|any|unknown|void)\b/.test(c) || /\binterface\s+\w+\s*{/.test(c) || /\btype\s+\w+\s*=/.test(c) || /\bas\s+const\b/.test(c) || /<\w+(\[\])?>\s*\(/.test(c);

  const score: Array<[Language, number]> = [
    ['json', /^\s*[{[][\s\S]*[}\]]\s*$/.test(c) && /"\w+"\s*:/.test(c) ? 6 : 0],
    ['html', !jsx && /<\/?[a-z][\s\S]*>/i.test(c) && /<(div|span|section|html|body|head|p|a|img|button|ul|li|table|svg)\b/i.test(c) ? 6 : 0],
    // CSS declarations must not be confused with TS annotations: a stylesheet
    // never contains const/let/function/interface/import, and never uses `=>`.
    ['css', /[{}]\s*$/.test(c) && /[-a-z]+\s*:[^;]+;/.test(c)
      && !/=>|\b(const|let|var|function|interface|type|class|import|export|return)\b/.test(c) ? 5 : 0],
    ['python', /\bdef\s+\w+\s*\(.*\)\s*:/.test(c) || /\bimport\s+\w+$/.test(c) || /^\s*(if|for|while)\s+.*:\s*$/m.test(c) ? 6 : 0],
    ['sql', /^\s*(select|insert|update|delete|create\s+table|with)\b/i.test(c) ? 6 : 0],
    ['bash', /^\s*(#!\/bin\/(ba)?sh|\$\s|sudo\s|apt(-get)?\s|npm\s|git\s|cd\s|ls\s|echo\s)/m.test(c) ? 4 : 0],
    ['typescript', !jsx && tsSyntax ? 6 : 0],
    ['javascript', /\bfunction\b|\bconst\b|\blet\b|=>|\bconsole\.log\b/.test(c) ? 3 : 0],
    // React markup outranks both plain HTML and plain TS once JSX is detected.
    ['tsx', jsx && tsSyntax ? 9 : 0],
    ['jsx', jsx ? 8 : 0],
    ['rust', /\bfn\s+\w+\s*\(/.test(c) || /\blet\s+mut\b/.test(c) || /impl\s+\w+/.test(c) ? 6 : 0],
    ['go', /\bfunc\s+\w*\s*\(/.test(c) || /\bpackage\s+main\b/.test(c) || /:=/.test(c) ? 6 : 0],
    ['java', /\bpublic\s+(static\s+)?(void|class)\b/.test(c) || /System\.out\.println/.test(c) ? 6 : 0],
    ['csharp', /\busing\s+System\b/.test(c) || /\bnamespace\s+\w+/.test(c) ? 5 : 0],
    ['cpp', /#include\s*<\w+>/.test(c) || /std::/.test(c) ? 6 : 0],
    ['c', /#include\s*<stdio\.h>/.test(c) || /\bprintf\s*\(/.test(c) ? 5 : 0],
    ['php', /<\?php/.test(c) ? 8 : 0],
    ['ruby', /\bdef\s+\w+\s*$/.test(c) || /\bputs\s+["']/.test(c) || /\bend\b/.test(c) ? 3 : 0],
    ['yaml', /^[\w.-]+:\s*$/m.test(c) && /^\s*-\s+/m.test(c) && !/[{};]/.test(c) ? 4 : 0],
  ];
  score.sort((a, b) => b[1] - a[1]);
  return score[0][1] > 0 ? score[0][0] : 'text';
}
