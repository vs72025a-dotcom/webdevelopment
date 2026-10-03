/**
 * The on-device reasoning engine.
 *
 * This is a retrieval-augmented reasoning loop, deliberately *not* a pretend
 * language model. Its contract is simple: every factual claim in an answer must
 * come from a retrieved passage or a real tool execution, and anything it cannot
 * support is reported as a gap rather than invented.
 *
 *   classify intent → plan → retrieve/execute tools → compose → stream
 *
 * Events are emitted as it goes so the UI can show the actual work: the plan,
 * each tool call with its arguments and result, the citations, and the tokens.
 */

import { cosine, embed, hybridScore, rng } from './embeddings';
import { KNOWLEDGE } from './knowledge';
import { runTool, ToolResult, TOOL_MAP } from './tools';
import { store, Hit } from './vectorStore';
import {
  contentTerms, detectLanguage, estimateTokens, splitSentences, stem,
} from './tokenizer';
import { looksLikeMath, spokenToExpression } from './expression';
import { parseConversionRequest } from './units';
import { countSyllables, keywords, sentiment } from './analysis';

export type Intent =
  | 'math' | 'conversion' | 'base' | 'datetime' | 'uuid' | 'random' | 'hash'
  | 'regex' | 'json' | 'color' | 'summarize' | 'sentiment' | 'analyse'
  | 'code' | 'capability' | 'greeting' | 'creative' | 'doc_qa' | 'knowledge'
  | 'clarify' | 'conversation';

export type EnginePhase =
  | 'understanding' | 'routing' | 'retrieving' | 'reasoning' | 'composing' | 'streaming' | 'done';

export interface Citation {
  index: number;
  title: string;
  sourceId: string;
  excerpt: string;
  score: number;
  kind: 'knowledge' | 'document' | 'note' | 'tool';
}

export interface ToolCallRecord {
  id: string;
  name: string;
  label: string;
  args: Record<string, string | number | boolean>;
  result: ToolResult;
  ms: number;
}

export interface EngineEvent {
  type: 'phase' | 'plan' | 'tool_start' | 'tool_end' | 'citation' | 'token' | 'thought' | 'done' | 'error';
  phase?: EnginePhase;
  text?: string;
  call?: ToolCallRecord;
  toolName?: string;
  args?: Record<string, string | number | boolean>;
  citation?: Citation;
  plan?: string[];
  response?: EngineResponse;
}

export interface EngineResponse {
  content: string;
  intent: Intent;
  intentConfidence: number;
  citations: Citation[];
  toolCalls: ToolCallRecord[];
  confidence: number;
  thinking: string[];
  tokens: { prompt: number; completion: number };
  latencyMs: number;
  model: string;
  grounded: boolean;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface EngineOptions {
  history?: ChatTurn[];
  useDocuments?: boolean;
  useKnowledge?: boolean;
  streamDelay?: number;
  signal?: { aborted: boolean };
  onEvent?: (e: EngineEvent) => void;
}

export const ENGINE_MODEL_ID = 'aurora-neuro-1 (on-device)';

/** Corpus bootstrapping: index the built-in knowledge base once. */
let bootstrapped = false;
export function bootstrapKnowledge(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  for (const entry of KNOWLEDGE) {
    // Body only. The title travels in `sourceTitle` (and is used by the
    // retrieval re-rank), so the composer never mistakes a title fragment such
    // as "Hallucination in language models." for an answer sentence.
    store.addSource(
      { id: `kb:${entry.id}`, title: entry.title, kind: 'knowledge', addedAt: 0, meta: { tags: entry.tags.join(',') } },
      entry.body,
      { target: 1400, overlap: 0 },
    );
  }
}

// ─────────────────────────────── intent classification ───────────────────────────────

interface IntentScore {
  intent: Intent;
  score: number;
  why: string;
}

const PATTERNS: Array<{ intent: Intent; re: RegExp; weight: number }> = [
  { intent: 'greeting', re: /^\s*(hi|hii+|hey|hello|yo|good (morning|afternoon|evening)|howdy|namaste|thanks|thank you|cheers|bye|goodbye|see ya)\b[\s!.]*$/i, weight: 3 },
  { intent: 'capability', re: /\b(what can you do|who are you|what are you|your name|help me|what do you do|your (features|abilities|capabilit)|how do (you|i) use|what('| a)re your tools|tell me about yourself|what is this (app|site|place))\b/i, weight: 3 },
  { intent: 'conversion', re: /\b(convert|conversion|how many|how much is|in terms of)\b.*\b(km|mi|kg|lb|pound|inch|feet|foot|celsius|fahrenheit|kelvin|gb|mb|tb|mph|kph|litre|gallon|acre|hectare)\b/i, weight: 2.4 },
  { intent: 'conversion', re: /\b\d+(\.\d+)?\s*(°?\s*(c|f|k)|km|mi|kg|lb|ft|in|cm|mm|gb|mb|kb|tb|mph|km\/h|kph|hours?|minutes?|days?|weeks?|years?)\b.*\b(to|in|into)\b/i, weight: 2.2 },
  { intent: 'base', re: /\b(binary|hex(adecimal)?|octal|base\s*\d{1,2}|0x[0-9a-f]+)\b/i, weight: 2 },
  { intent: 'datetime', re: /\b(what(?:'s|\u2019s| is|s)?\s*(?:the\s*)?(?:current\s*)?(time|date|day)|current (time|date)|today'?s date|what day is it|unix timestamp|epoch time|right now|what time)\b/i, weight: 2.6 },
  { intent: 'uuid', re: /\b(uuids?|guids?|unique (?:id|ids|identifier|identifiers))\b/i, weight: 2.6 },
  { intent: 'random', re: /\b(random (?:number|numbers|integer|value|values)|pick a (?:number|card)|roll (?:a|the|\d+)?\s*(?:die|dice|d\d{1,3})|generate \d+ random|shuffle)\b/i, weight: 2.6 },
  { intent: 'hash', re: /\b(sha-?(1|256|512)|hash (this|of|the)|md5|digest|checksum)\b/i, weight: 2.6 },
  { intent: 'regex', re: /\b(regex|regular expression|regexp)\b/i, weight: 2.4 },
  { intent: 'json', re: /\b(validate json|format json|pretty print|is this json|json (is )?(valid|broken))\b/i, weight: 2.4 },
  { intent: 'color', re: /\b(hex colou?r|rgba?\b|hsla?\b|oklch|contrast ratio|colou?r code|colou?r palette)\b/i, weight: 2.2 },
  { intent: 'color', re: /#[0-9a-fA-F]{3,8}\b/, weight: 2.6 },
  { intent: 'color', re: /\b(contrast|luminance)\b.*#[0-9a-fA-F]{3,8}|#[0-9a-fA-F]{3,8}.*\b(contrast|luminance|colour|color)\b/i, weight: 2.2 },
  { intent: 'summarize', re: /^\s*(summar(y|ise|ize)|tl;?dr|condense|shorten this|give me the gist)\b/i, weight: 2.8 },
  { intent: 'sentiment', re: /\b(sentiment|tone|positive or negative|how does this (sound|read)|emotional)\b/i, weight: 2.4 },
  { intent: 'analyse', re: /\b(word count|how many words|reading time|readability|flesch|lexical diversity|text stats)\b/i, weight: 2.6 },
  { intent: 'code', re: /\b(explain|review|refactor|debug|fix|optimi[sz]e|what does this)\b.*\b(code|function|script|snippet|class|component)\b/i, weight: 2.2 },
  { intent: 'creative', re: /^\s*(write|compose|make|create|give me)\b.*\b(poem|haiku|sonnet|story|limerick|joke|song|rap|slogan|tagline)\b/i, weight: 2.6 },
];

const CODE_FENCE = /```[\s\S]+?```/;

export interface ClassifyContext {
  docsIndexed: boolean;
  /** Intent of the previous turn — used to resolve bare follow-ups. */
  lastIntent?: Intent;
}

export function classifyIntent(input: string, ctx: ClassifyContext): {
  intent: Intent;
  confidence: number;
  scores: IntentScore[];
} {
  const { docsIndexed: hasDocs } = ctx;
  const text = input.trim();
  const lower = text.toLowerCase();
  const scores: IntentScore[] = [];

  const bump = (intent: Intent, score: number, why: string) => {
    if (score <= 0) return;
    const existing = scores.find((s) => s.intent === intent);
    if (existing) {
      existing.score += score;
      existing.why += `; ${why}`;
    } else scores.push({ intent, score, why });
  };

  for (const p of PATTERNS) {
    if (p.re.test(text)) bump(p.intent, p.weight, `pattern ${p.re.source.slice(0, 28)}`);
  }

  if (CODE_FENCE.test(text)) bump('code', 2.6, 'contains a code fence');
  if (looksLikeMath(text) || /^\s*(calculate|compute|evaluate|solve|what is|whats|what's)\b.*[\d]/i.test(text)) {
    const candidate = spokenToExpression(text);
    if (/[+\-*/^%]/.test(candidate)) bump('math', 2.8, 'expression detected');
  }
  const conv = parseConversionRequest(text);
  if (conv) bump('conversion', conv.to ? 2.8 : 1.6, 'unit pattern parsed');

  if (lower.length < 40 && /\?$/.test(text) && hasDocs) bump('doc_qa', 0.8, 'short question with docs indexed');
  if (hasDocs) bump('doc_qa', 0.55, 'user documents are indexed');

  // Very short, low-information turns are usually conversational — but only
  // when they carry no content word of their own. "why?" and "thanks" are
  // conversational; "and in metres?" is a follow-up that means something.
  const words = text.split(/\s+/).filter(Boolean);
  const carriesContent = contentTerms(text).length > 0;
  if (words.length <= 3 && !/[\d]/.test(text) && !CODE_FENCE.test(text) && !carriesContent) {
    bump('conversation', 0.9, 'very short turn');
  }

  scores.sort((a, b) => b.score - a.score);

  // Continuity: a *terse* follow-up ("and in java?", "why?", "in binary?")
  // usually stays on the previous route. A fully-formed question of five words
  // or more carries its own intent signal and must not inherit the last turn's
  // route — otherwise asking about RAG straight after a calculation gets
  // classified as arithmetic and fed to the expression parser.
  const leading = scores[0];
  const terse = words.length <= 4;
  const strongOwnSignal = (leading?.score ?? 0) >= 1.6;
  if (
    terse &&
    !strongOwnSignal &&
    ctx.lastIntent &&
    !['greeting', 'conversation'].includes(ctx.lastIntent)
  ) {
    bump(ctx.lastIntent, 0.7, `follows previous ${ctx.lastIntent} turn`);
  }
  const top = scores[0];
  if (!top) {
    return { intent: 'knowledge', confidence: 0.35, scores };
  }
  const runnerUp = scores[1]?.score ?? 0;
  const margin = top.score - runnerUp;
  const confidence = Math.min(0.97, 0.45 + top.score * 0.14 + margin * 0.06);
  return { intent: top.intent, confidence, scores };
}

// ─────────────────────────────── retrieval ───────────────────────────────

interface RetrievalResult {
  hits: Hit[];
  docHits: Hit[];
  kbHits: Hit[];
  topScore: number;
  expandedQuery: string;
}

/** Query expansion: add stemmed synonyms so "llm" also finds "language model". */
const EXPANSIONS: Record<string, string[]> = {
  llm: ['language model', 'large language'],
  ai: ['artificial intelligence', 'machine learning'],
  ml: ['machine learning'],
  js: ['javascript'],
  ts: ['typescript'],
  py: ['python'],
  db: ['database'],
  ui: ['interface', 'design'],
  ux: ['experience', 'design'],
  nlp: ['natural language processing'],
  cv: ['computer vision'],
  rag: ['retrieval augmented generation'],
  api: ['interface', 'http', 'endpoint'],
  perf: ['performance'],
  a11y: ['accessibility'],
  i18n: ['internationalisation'],
  dark: ['night', 'theme'],
  'dark mode': ['night mode', 'theme'],
  config: ['configuration', 'settings'],
  auth: ['authentication', 'authorization', 'security'],
  crypto: ['cryptographic', 'hash', 'encryption'],
  math: ['mathematics', 'calculation'],
  env: ['environment'],
  dep: ['dependency'],
  func: ['function'],
  var: ['variable'],
};

export function expandQuery(query: string): string {
  const terms = [...new Set(contentTerms(query))];
  const extra: string[] = [];
  for (const t of terms) {
    const key = t;
    if (EXPANSIONS[key]) extra.push(...EXPANSIONS[key]);
    for (const [k, v] of Object.entries(EXPANSIONS)) {
      if (k.includes(' ') && k.split(' ').every((p) => terms.includes(p) || stem(p) === t)) extra.push(...v);
    }
  }
  return [...new Set([...terms, ...extra])].join(' ');
}

/**
 * Retrieval with a title/tag re-rank.
 *
 * Corpus titles are the most information-dense statement of what a passage is
 * about, so a passage whose *title* shares terms with the query is almost
 * always the right answer even when its body is out-scored by a longer passage
 * that merely mentions the same words. Without this, "what is lora" ranked the
 * RLHF entry first because that body happens to contain more overlapping terms.
 */
function retrieve(query: string, opts: { useDocuments: boolean; useKnowledge: boolean }): RetrievalResult {
  const expanded = expandQuery(query);
  const combined = `${query}. ${expanded}`;
  const kinds: Array<'knowledge' | 'document' | 'note'> = [];
  if (opts.useKnowledge) kinds.push('knowledge');
  if (opts.useDocuments) kinds.push('document', 'note');

  const raw = kinds.length ? store.search(combined, 14, kinds, 0.02) : [];
  const qTerms = new Set(contentTerms(query));

  const hits = raw
    .map((h) => {
      const src = store.getSource(h.chunk.sourceId);
      const tagText = String(src?.meta?.tags ?? '').replace(/,/g, ' ');
      const titleTerms = new Set(contentTerms(`${h.chunk.sourceTitle} ${tagText}`));
      let overlap = 0;
      for (const t of titleTerms) if (qTerms.has(t) || qTerms.has(stem(t))) overlap++;
      const bonus = titleTerms.size ? 0.22 * (overlap / Math.min(titleTerms.size, Math.max(1, qTerms.size))) : 0;
      return { ...h, score: h.score + bonus };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const docHits = hits.filter((h) => !h.chunk.sourceId.startsWith('kb:'));
  const kbHits = hits.filter((h) => h.chunk.sourceId.startsWith('kb:'));
  const topScore = hits[0]?.score ?? 0;
  return { hits, docHits, kbHits, topScore, expandedQuery: expanded };
}

/**
 * Remove a leading instruction ("hash this text: X" → "X").
 * Anchored and non-greedy — the earlier greedy version ate the payload.
 */
function stripLeadVerb(query: string, verb: RegExp): string {
  const re = new RegExp(`^\\s*(?:please\\s+|can you\\s+|could you\\s+)?(?:${verb.source})[^:|\\n]*[:|\\-]?\\s*`, 'i');
  const stripped = query.replace(re, '').trim();
  return stripped.length >= 2 ? stripped : query.trim();
}

/** Pick the sentence inside a passage that best answers the query. */
function bestSentence(passage: string, query: string): string {
  const sentences = splitSentences(passage);
  if (!sentences.length) return passage;
  if (sentences.length === 1) return sentences[0];
  const qv = embed(query);
  const terms = new Set(contentTerms(query));
  let best = sentences[0];
  let bestScore = -Infinity;
  sentences.forEach((s, i) => {
    const semantic = cosine(qv, embed(s));
    const overlap = [...new Set(contentTerms(s))].filter((t) => terms.has(t)).length;
    const position = i === 0 ? 0.16 : 0;
    const length = Math.min(1, s.split(/\s+/).length / 18);
    const score = semantic + overlap * 0.09 + position + length * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  });
  return best;
}

// ─────────────────────────────── composition ───────────────────────────────

const REFUSAL_LINES = [
  "I couldn't find anything in my on-device corpus that supports an answer to that.",
  'That one is outside what I can verify offline, so I would rather flag the gap than guess.',
];

function composeGrounded(
  query: string,
  hits: Hit[],
  intent: Intent,
  opts: { useDocuments: boolean },
): { content: string; citations: Citation[]; confidence: number } {
  const citations: Citation[] = [];
  const used = new Map<string, number>();

  const pushCitation = (h: Hit): number => {
    const key = h.chunk.sourceId;
    const existing = used.get(key);
    if (existing !== undefined) return existing;
    const idx = citations.length + 1;
    used.set(key, idx);
    citations.push({
      index: idx,
      title: h.chunk.sourceTitle,
      sourceId: h.chunk.sourceId,
      excerpt: h.chunk.text.slice(0, 240),
      score: h.score,
      kind: h.chunk.sourceId.startsWith('kb:') ? 'knowledge' : 'document',
    });
    return idx;
  };

  const top = hits[0];
  const lead = bestSentence(top.chunk.text, query);
  const leadRef = pushCitation(top);

  const parts: string[] = [];
  parts.push(`${lead} [${leadRef}]`);

  // Supporting passages must earn their place. Two gates, because relevance
  // score alone let through off-topic filler ("hallucination" pulled in a
  // diffusion-models passage): the passage must be within 74% of the top score
  // AND share at least one content term with the query.
  const floor = top.score * 0.74;
  const qTerms = new Set(contentTerms(query));
  const sharesTerm = (text: string) => contentTerms(text).some((t) => qTerms.has(t) || qTerms.has(stem(t)));
  const support = hits
    .slice(1, intent === 'doc_qa' ? 5 : 4)
    .filter((h) => h.score >= floor && sharesTerm(h.chunk.text));
  if (support.length) {
    const bullets: string[] = [];
    for (const h of support) {
      if (cosine(embed(h.chunk.text), embed(top.chunk.text)) > 0.82) continue;
      const ref = pushCitation(h);
      const sentence = bestSentence(h.chunk.text, query);
      if (sentence.replace(/[^a-z0-9]/gi, '') === lead.replace(/[^a-z0-9]/gi, '')) continue;
      if (!sharesTerm(sentence)) continue;
      bullets.push(`- ${sentence} [${ref}]`);
    }
    if (bullets.length) {
      parts.push('', 'Supporting detail:', '', ...bullets);
    }
  }

  // Quote the most relevant document chunk verbatim when doing document Q&A,
  // because users want to see the actual source text, not a paraphrase.
  if (intent === 'doc_qa' && opts.useDocuments) {
    const docHit = hits.find((h) => !h.chunk.sourceId.startsWith('kb:'));
    if (docHit) {
      const ref = pushCitation(docHit);
      parts.push('', `> ${docHit.chunk.text.length > 600 ? `${docHit.chunk.text.slice(0, 600)}…` : docHit.chunk.text}`, '', `_[${ref}] ${docHit.chunk.sourceTitle}, chunk ${docHit.chunk.index + 1}_`);
    }
  }

  const confidence = clamp01(top.score * 1.15);
  if (confidence < 0.42) {
    parts.push(
      '',
      `> **Confidence ${(confidence * 100).toFixed(0)}%** — the retrieved passages are only loosely related to your question, so treat this as a starting point rather than a settled answer.`,
    );
  } else {
    parts.push('', `_Retrieved ${hits.length} passage${hits.length === 1 ? '' : 's'} · top relevance ${(top.score * 100).toFixed(0)}% · grounded answer_`);
  }

  return { content: parts.join('\n'), citations, confidence };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function composeUngrounded(query: string, opts: { docsIndexed: boolean }): { content: string; confidence: number } {
  const hints: string[] = [];
  if (!opts.docsIndexed) hints.push('drop a document into **Documents** and I will answer from it with citations');
  hints.push('add a provider key in **Settings** to route this to a frontier model');
  hints.push('rephrase with more specific keywords — my retriever is lexical + semantic');
  return {
    content: [
      REFUSAL_LINES[hash32mod(query, REFUSAL_LINES.length)],
      '',
      `Nothing in the indexed corpus scored above the relevance floor for **"${query}"**. I won't invent an answer, because a confident fabrication is worse than an honest gap.`,
      '',
      '**What would work:**',
      ...hints.map((h) => `- ${h}`),
      '',
      `_Nearest topics I do know: ${nearestTopics(query)}_`,
    ].join('\n'),
    confidence: 0.08,
  };
}

function hash32mod(s: string, n: number): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % n;
}

function nearestTopics(query: string): string {
  const hits = store.search(query, 3, ['knowledge'], -1);
  if (!hits.length) return 'none';
  return hits.map((h) => `${h.chunk.sourceTitle} (${(h.score * 100).toFixed(0)}%)`).join(', ');
}

// ─────────────────────────────── creative generation ───────────────────────────────

const HAIKU_BANK: Record<string, string[]> = {
  default: ['silent', 'distant', 'quiet', 'silver', 'hollow', 'gentle', 'fading', 'endless', 'crimson', 'patient'],
  nature: ['river', 'cedar', 'meadow', 'willow', 'harbour', 'glacier', 'orchid', 'thicket', 'lagoon', 'summit'],
  tech: ['circuit', 'signal', 'kernel', 'latency', 'compiler', 'vector', 'protocol', 'buffer', 'cipher', 'daemon'],
  night: ['moonlit', 'starfield', 'midnight', 'eclipse', 'shadow', 'lantern', 'duskfall', 'nocturne', 'twilight', 'umbra'],
  sea: ['tidewater', 'current', 'abyssal', 'brine', 'lighthouse', 'undertow', 'kelp', 'harbour', 'squall', 'fathom'],
};

function topicBank(topic: string): string[] {
  const t = topic.toLowerCase();
  const topicWords = topic
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 2);
  const base = /night|moon|dark|star|dream|sleep/.test(t) ? HAIKU_BANK.night
    : /sea|ocean|water|wave|deep|tide/.test(t) ? HAIKU_BANK.sea
    : /code|tech|machine|data|comput|\bai\b|neural|model/.test(t) ? HAIKU_BANK.tech
    : /tree|forest|river|mountain|flower|nature|garden|leaf/.test(t) ? HAIKU_BANK.nature
    : HAIKU_BANK.default;
  return [...new Set([...topicWords, ...base, ...HAIKU_BANK.default])];
}

const FILLERS = ['of', 'in', 'the', 'a', 'and', 'where', 'while', 'as', 'over', 'under', 'through'];

/**
 * Syllable-exact line builder.
 *
 * Every candidate is filtered by "fits in the remaining budget", so a line can
 * never overshoot its target — an earlier version let connective words through
 * unchecked and produced 5-7-6. Words are consumed from a shared `used` set so
 * a haiku never repeats a content word.
 */
function buildLine(target: number, bank: string[], rand: () => number, used: Set<string>): string {
  const bySyll = new Map<number, string[]>();
  for (const w of bank) {
    const n = countSyllables(w);
    if (!bySyll.has(n)) bySyll.set(n, []);
    bySyll.get(n)!.push(w);
  }
  const fresh = (n: number) => (bySyll.get(n) ?? []).filter((w) => !used.has(w));

  const words: string[] = [];
  let remaining = target;
  let guard = 0;
  while (remaining > 0 && guard++ < 60) {
    // Prefer an exact fit; otherwise the largest word that still fits.
    let word = fresh(remaining)[Math.floor(rand() * Math.max(1, fresh(remaining).length))];
    if (!word) {
      for (let n = remaining - 1; n >= 1 && !word; n--) word = fresh(n)[Math.floor(rand() * Math.max(1, fresh(n).length))];
    }
    if (!word) {
      // Bank exhausted — fall back to a connective that fits the budget.
      const f = FILLERS.filter((x) => countSyllables(x) <= remaining);
      const chosen = f.length ? f[Math.floor(rand() * f.length)] : 'a';
      words.push(chosen);
      remaining -= countSyllables(chosen);
      continue;
    }
    // Occasionally lead with a connective, but only when it cannot overshoot.
    if (words.length === 0 && remaining >= 3 && rand() < 0.3) {
      const f = FILLERS.filter((x) => countSyllables(x) <= remaining - 1);
      if (f.length) {
        const chosen = f[Math.floor(rand() * f.length)];
        words.push(chosen);
        remaining -= countSyllables(chosen);
        continue;
      }
    }
    used.add(word);
    words.push(word);
    remaining -= countSyllables(word);
  }
  return words.join(' ');
}

/**
 * Syllable-exact haiku. The 5-7-5 constraint is *verified* by the same syllable
 * counter the readability metrics use, so the form is real rather than
 * approximately-shaped prose.
 */
/** Per-call nonce so asking twice in a row does not return the identical poem. */
let creativeNonce = 0;

function composeHaiku(topic: string): { content: string; note: string } {
  const rand = rng(`${topic}:${Date.now()}:${creativeNonce++}`);
  const bank = topicBank(topic);
  const used = new Set<string>();
  const lines = [5, 7, 5].map((n) => capitaliseFirst(buildLine(n, bank, rand, used)));
  const counts = lines.map((l) =>
    l.split(/\s+/).filter(Boolean).reduce((a, w) => a + countSyllables(w), 0),
  );
  const exact = counts[0] === 5 && counts[1] === 7 && counts[2] === 5;
  const note = `Syllable pattern ${counts.join('-')} ${exact ? '✓ verified 5-7-5' : '✗ off-form'} · counted by the same syllable estimator used for Flesch readability.`;
  const title = topic.trim()
    ? topic.trim().slice(0, 40).replace(/\b\w/g, (c) => c.toUpperCase())
    : 'Untitled';
  return { content: `### ${title} — a haiku\n\n${lines.map((l) => `> ${l}`).join('\n>\n')}\n\n_${note}_`, note };
}

function capitaliseFirst(line: string): string {
  return line.charAt(0).toUpperCase() + line.slice(1);
}

const JOKE_TEMPLATES = [
  'Why do programmers prefer dark mode? Because light attracts bugs.',
  'I told my computer I needed a break, and it said "no problem — I will go to sleep."',
  'There are 10 kinds of people: those who understand binary and those who do not.',
  'A SQL query walks into a bar, approaches two tables and asks: "may I join you?"',
  'Why did the developer go broke? Because he used up all his cache.',
  'Debugging: being the detective in a crime movie where you are also the murderer.',
  'My code does not have bugs. It has undocumented features with attitude.',
];

function composeCreative(kind: string, topic: string): string {
  const rand = rng(`${kind}:${topic}`);
  if (/haiku/.test(kind)) return composeHaiku(topic).content;
  if (/joke/.test(kind)) {
    return JOKE_TEMPLATES[Math.floor(rand() * JOKE_TEMPLATES.length)];
  }
  if (/poem|sonnet|verse/.test(kind)) {
    const bank = topicBank(topic);
    const stanzas = Array.from({ length: 2 }, () =>
      Array.from({ length: 4 }, (_, i) => {
        const w1 = bank[Math.floor(rand() * bank.length)];
        const w2 = bank[Math.floor(rand() * bank.length)];
        const shapes = [
          `the ${w1} keeps its ${w2} where no one looks,`,
          `and ${w1} learns the grammar of ${w2},`,
          `we measure ${w1} by the ${w2} it leaves,`,
          `between the ${w1} and the ${w2}, a door.`,
        ];
        return shapes[i];
      }).join('\n'),
    );
    return `### ${topic || 'Untitled'}\n\n${stanzas.join('\n\n')}\n\n_Generated from a seeded template bank — deterministic for the same topic and seed._`;
  }
  if (/slogan|tagline/.test(kind)) {
    const shapes = [
      `${topic}, without the wait.`,
      `Built for ${topic}. Made for people.`,
      `${topic} — the short way round.`,
      `Think ${topic}. Ship it tonight.`,
    ];
    return shapes.map((s) => `- ${s}`).join('\n');
  }
  return `I can write haiku (syllable-verified), short verse, jokes and slogans offline. Say the word "haiku", "poem", "joke" or "tagline" followed by a topic.`;
}

// ─────────────────────────────── code intelligence ───────────────────────────────

function composeCodeExplanation(code: string, languageHint?: string): { content: string; analysis: ToolResult; kb: Hit[] } {
  const language = detectLanguage(code, languageHint);
  const lines = code.split('\n');
  const analysis = TOOL_MAP.get('code_analyze')!.run({ code, language }) as ToolResult;
  const data = analysis.data as { complexity: number; functions: number; codeLines: number; smells: Array<{ level: string; text: string }> };

  const kb = store.search(`${language} programming best practices patterns`, 2, ['knowledge'], 0.02);

  // Walk the code and narrate what each significant construct does.
  const narration: string[] = [];
  const constructs: Array<[RegExp, string]> = [
    [/\b(?:import|require|from)\b.*$/, 'Imports a dependency, so this unit is not self-contained.'],
    [/\b(?:export)\b\s+(?:default\s+)?(?:function|class|const|interface|type)/, 'Exports a public symbol — this is part of the module contract.'],
    [/\b(?:async)\b.*\bfunction\b|=>\s*\{?[\s\S]*?\bawait\b|\basync\s*\(/, 'Declares asynchronous work; callers must await it or handle the promise.'],
    [/\b(?:function|const|let)\s+(\w+)\s*[=(][^;]*=>|\bfunction\s+(\w+)/, 'Defines a callable unit.'],
    [/\b(?:class|interface|type)\s+(\w+)/, 'Declares a type or class shape.'],
    [/\b(?:if|else if|elif|switch)\b/, 'Branches — each branch is a path your tests should cover.'],
    [/\b(?:for|while|forEach|map|filter|reduce)\b/, 'Iterates or transforms a collection.'],
    [/\b(?:try|catch|except)\b/, 'Handles errors; check that the catch does not silently swallow them.'],
    [/\b(?:return)\b/, 'Returns a value — the observable output of this unit.'],
    [/\b(?:useState|useEffect|useMemo|useCallback|useRef)\b/, 'React hook: ties this component into the render lifecycle.'],
    [/\b(?:SELECT|INSERT|UPDATE|DELETE|JOIN|WHERE)\b/i, 'SQL statement — the WHERE clause decides whether an index can be used.'],
  ];
  const seen = new Set<string>();
  lines.forEach((line, i) => {
    for (const [re, text] of constructs) {
      if (re.test(line) && !seen.has(text)) {
        seen.add(text);
        narration.push(`- **Line ${i + 1}** — ${text} \n  \`${line.trim().slice(0, 96)}\``);
        break;
      }
    }
  });

  const parts = [
    `### What this ${language} code does`,
    '',
    `${data.codeLines} line${data.codeLines === 1 ? '' : 's'} of ${language}, ${data.functions} callable scope${data.functions === 1 ? '' : 's'}, estimated cyclomatic complexity **${data.complexity}**.`,
    '',
    narration.length ? '**Structure, in order of first appearance:**' : '',
    ...narration,
    '',
    analysis.detail ?? '',
  ];

  if (kb.length) {
    parts.push('', '### Relevant guidance from the built-in corpus', '');
    kb.forEach((h, i) => {
      parts.push(`**${h.chunk.sourceTitle}** _(relevance ${(h.score * 100).toFixed(0)}%)_`, '', `> ${bestSentence(h.chunk.text, language)} `, '');
      void i;
    });
  }

  return { content: parts.filter((p) => p !== undefined).join('\n'), analysis, kb };
}

// ─────────────────────────────── main entry point ───────────────────────────────

export async function generate(
  input: string,
  options: EngineOptions = {},
): Promise<EngineResponse> {
  bootstrapKnowledge();
  const started = performance.now();
  const emit = options.onEvent ?? (() => {});
  const signal = options.signal ?? { aborted: false };
  const history = options.history ?? [];
  const thinking: string[] = [];
  const toolCalls: ToolCallRecord[] = [];
  const citations: Citation[] = [];

  const note = (line: string) => {
    thinking.push(line);
    emit({ type: 'thought', text: line });
  };

  const phase = (p: EnginePhase) => emit({ type: 'phase', phase: p });
  const sleep = (ms: number) =>
    new Promise<void>((res) => setTimeout(res, options.streamDelay === 0 ? 0 : ms));

  const callTool = async (
    name: string,
    args: Record<string, string | number | boolean>,
  ): Promise<ToolResult> => {
    const t0 = performance.now();
    emit({ type: 'tool_start', toolName: name, args });
    const result = await runTool(name, args);
    const record: ToolCallRecord = {
      id: `${name}-${toolCalls.length}`,
      name,
      label: TOOL_MAP.get(name)?.label ?? name,
      args,
      result,
      ms: Math.round(performance.now() - t0),
    };
    toolCalls.push(record);
    emit({ type: 'tool_end', call: record });
    return result;
  };

  phase('understanding');
  // Resolve bare follow-ups ("why?", "more", "and java?") against the last turn.
  let query = input.trim();
  const isFollowUp = query.split(/\s+/).length <= 3 && !/[?]/.test(query) && history.length > 0;
  if (isFollowUp && history.length) {
    const last = [...history].reverse().find((t) => t.role === 'user');
    if (last) {
      query = `${last.content} ${query}`.trim();
      note(`Follow-up detected — expanded query against previous turn: "${query.slice(0, 90)}"`);
    }
  }

  phase('routing');
  const docsIndexed = store.listSources().some((s) => s.kind === 'document' || s.kind === 'note');
  const lastUserIdx = history.map((h) => h.role).lastIndexOf('user');
  const lastIntent = history[lastUserIdx]
    ? classifyIntent(history[lastUserIdx].content, { docsIndexed }).intent
    : undefined;
  const { intent, confidence: intentConfidence, scores } = classifyIntent(query, { docsIndexed, lastIntent });
  note(
    `Intent: ${intent} (${(intentConfidence * 100).toFixed(0)}%)` +
      (scores.length > 1 ? ` · runner-up ${scores[1].intent} ${scores[1].score.toFixed(1)}` : ''),
  );
  emit({ type: 'plan', plan: planFor(intent, query) });

  let content = '';
  let confidence = intentConfidence;
  let grounded = false;

  const finish = async (): Promise<EngineResponse> => {
    phase('composing');
    await sleep(40);
    phase('streaming');
    await streamText(content, emit, sleep, signal);
    phase('done');
    const latencyMs = Math.round(performance.now() - started);
    const response: EngineResponse = {
      content,
      intent,
      intentConfidence,
      citations,
      toolCalls,
      confidence,
      thinking,
      tokens: { prompt: estimateTokens(query), completion: estimateTokens(content) },
      latencyMs,
      model: ENGINE_MODEL_ID,
      grounded,
    };
    emit({ type: 'done', response });
    return response;
  };

  switch (intent) {
    case 'greeting': {
      const hour = new Date().getHours();
      const tod = hour < 5 ? 'still up' : hour < 12 ? 'good morning' : hour < 18 ? 'good afternoon' : 'good evening';
      content = [
        `${tod[0].toUpperCase()}${tod.slice(1)} — Aurora Mind is running locally, no network required.`,
        '',
        'Try one of these:',
        '- `calculate (12% of 480) * 3 + sqrt(2)^10`',
        '- `convert 100 km/h to mph`',
        '- "how does retrieval augmented generation work?"',
        '- "explain this code:" followed by a snippet',
        '- "write a haiku about the deep sea"',
        '',
        '_Or open **Agents** to watch me decompose a goal into tool calls._',
      ].join('\n');
      confidence = 0.9;
      break;
    }

    case 'capability': {
      const entries = ['app-overview', 'app-tools', 'app-engine', 'app-nightmode', 'app-privacy']
        .map((id) => KNOWLEDGE.find((k) => k.id === id))
        .filter(Boolean) as typeof KNOWLEDGE;
      const asked = query.toLowerCase();
      const focus = (id: string) => entries.find((e) => e.id === id)!;
      const filtered = /night|theme|dark|aurora|phosphor/.test(asked)
        ? [focus('app-nightmode'), focus('app-overview')]
        : /privacy|data|stor|safe|secure/.test(asked)
          ? [focus('app-privacy'), focus('app-overview')]
          : /how.*(work|engine)|offline|local|retriev/.test(asked)
            ? [focus('app-engine'), focus('app-overview')]
            : [focus('app-overview'), focus('app-tools'), focus('app-engine')];
      const parts: string[] = [];
      filtered.forEach((e) => {
        citations.push({
          index: citations.length + 1,
          title: e.title,
          sourceId: `kb:${e.id}`,
          excerpt: e.body.slice(0, 240),
          score: 1,
          kind: 'knowledge',
        });
        const ref = citations.length;
        // The body already opens with a definition, so quote it once.
        parts.push(`### ${e.title} [${ref}]`, '', e.body, '');
      });
      content = parts.join('\n');
      grounded = true;
      confidence = 0.95;
      note('Capability question — answered from the app documentation entries in the corpus.');
      break;
    }

    case 'math': {
      // Always normalise first: "what is 2+2" and "calculate 2+2" both need the
      // leading verbs removed before the parser sees them.
      const spoken = spokenToExpression(query);
      const expr = /[+\-*/^%]/.test(spoken) ? spoken : query;
      note(`Math route — parsed expression: \`${expr}\``);
      const res = await callTool('calculate', { expression: expr, angle_mode: /degree|deg\b/.test(query) ? 'deg' : 'rad' });
      content = res.ok
        ? `${res.detail}\n\n_Computed by the built-in parser — a recursive-descent evaluator, not \`eval()\`, so nothing in your input is executed as code._`
        : `I could not evaluate that. ${res.error ?? ''}\n\nTry a form like \`12 * (3 + 4) / 5\` or \`sqrt(144) + 5!\`.`;
      confidence = res.ok ? 0.99 : 0.2;
      grounded = res.ok;
      break;
    }

    case 'conversion': {
      const parsed = parseConversionRequest(query);
      if (parsed) {
        note(`Conversion route — ${parsed.value} ${parsed.from}${parsed.to ? ` → ${parsed.to}` : ''}`);
        const res = await callTool('convert_units', {
          value: parsed.value,
          from: parsed.from,
          ...(parsed.to ? { to: parsed.to } : {}),
        });
        content = res.ok ? `${res.detail}` : `Conversion failed: ${res.error}`;
        confidence = res.ok ? 0.98 : 0.2;
        grounded = res.ok;
      } else {
        const res = await callTool('list_units', { category: '' });
        content = `I could not parse a unit conversion out of that. Here is what I can convert:\n\n${res.detail}`;
        confidence = 0.4;
      }
      break;
    }

    case 'base': {
      const m = query.match(/(-?\w+)\s*(?:to|in|into|as)\s*(binary|hex(?:adecimal)?|octal|decimal|base\s*(\d{1,2}))/i)
        ?? query.match(/\b(binary|hex(?:adecimal)?|octal|decimal|base\s*(\d{1,2}))\s*(?:of|for)\s*(-?\w+)/i);
      let value = '';
      let toBase = 10;
      if (m) {
        const named = (m[2] ?? m[1] ?? '').toLowerCase();
        value = (m[2] ? m[1] : m[3]) ?? '';
        toBase = named.startsWith('bin') ? 2 : named.startsWith('hex') ? 16 : named.startsWith('oct') ? 8 : named.startsWith('dec') ? 10 : Number(named.replace(/\D/g, '')) || 10;
      } else {
        const any = query.match(/\b(0x[0-9a-f]+|0b[01]+|\d+)\b/i);
        value = any?.[1] ?? '';
      }
      note(`Base conversion route — value "${value}" → base ${toBase}`);
      const res = await callTool('convert_base', { value, to_base: toBase });
      content = res.ok ? `${res.detail}\n\n_Converted with \`parseInt\`/\`toString(radix)\` and validated against the safe-integer range._` : `I could not read a number out of that. ${res.error ?? ''}`;
      confidence = res.ok ? 0.98 : 0.2;
      grounded = res.ok;
      break;
    }

    case 'datetime': {
      const hasTs = query.match(/\b(1?\d{9,13})\b/);
      note(hasTs ? `Timestamp route — ${hasTs[1]}` : 'Clock route — reporting local and UTC time');
      const res = await callTool('datetime', hasTs ? { op: 'from_timestamp', value: hasTs[1] } : { op: 'now' });
      content = res.ok
        ? `${res.detail}\n\n_Read from your browser's clock and the IANA timezone database via \`Intl\` — no network call._`
        : `Could not resolve that date/time. ${res.error ?? ''}`;
      confidence = res.ok ? 0.99 : 0.2;
      grounded = res.ok;
      break;
    }

    case 'uuid': {
      const count = Math.min(50, Number(query.match(/\b(\d{1,2})\b/)?.[1] ?? 1) || 1);
      const res = await callTool('make_uuid', { count });
      content = `${res.detail}\n\n_RFC 4122 v4 — 122 bits of entropy from \`crypto.getRandomValues\`._`;
      confidence = 0.99;
      grounded = true;
      break;
    }

    case 'random': {
      const nums = [...query.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));
      const countMatch = query.match(/\b(\d{1,3})\s+(?:random\s+)?(?:numbers?|values?|draws?|rolls?)/i);
      const args: Record<string, string | number | boolean> = {};
      if (nums.length >= 2) {
        args.min = Math.min(...nums);
        args.max = Math.max(...nums);
      } else if (nums.length === 1) {
        args.min = 1;
        args.max = nums[0];
      } else {
        args.min = 1;
        args.max = 100;
      }
      args.count = countMatch ? Math.min(200, Number(countMatch[1])) : 1;
      if (/dice|die|d6|d20|roll/i.test(query)) {
        args.min = 1;
        args.max = /d20/i.test(query) ? 20 : 6;
      }
      if (/float|decimal|real/i.test(query)) args.integer = false;
      note(`Random route — [${args.min}, ${args.max}] × ${args.count}`);
      const res = await callTool('random_number', args);
      content = res.detail ?? res.summary;
      confidence = 0.99;
      grounded = true;
      break;
    }

    case 'hash': {
      const algo = /sha-?512/i.test(query) ? 'SHA-512' : /sha-?1\b/i.test(query) ? 'SHA-1' : 'SHA-256';
      const target = stripLeadVerb(query, /\b(?:hash|digest|checksum)\b/);
      note(`Hash route — ${algo}`);
      const res = await callTool('hash_text', { text: target, algorithm: algo });
      content = res.detail ?? res.summary;
      confidence = 0.99;
      grounded = true;
      break;
    }

    case 'regex': {
      const pm = query.match(/\/(.+?)\/([gimsuy]*)/) ?? query.match(/pattern\s*[:=]\s*(.+?)(?:\s+(?:against|on|in)\s+(.+))?$/i);
      const text = CODE_FENCE.test(query) ? query.match(CODE_FENCE)![0].replace(/```/g, '').replace(/^\w+\n/, '') : '';
      if (pm && (pm[2] || text)) {
        note('Regex route — compiling and executing the pattern');
        const res = await callTool('regex_test', { pattern: pm[1], text: text || query, flags: (pm as RegExpMatchArray)[2] ?? 'g' });
        content = res.detail ?? res.summary;
        confidence = res.ok ? 0.97 : 0.3;
        grounded = res.ok;
      } else {
        const hits = store.search('regular expression syntax', 2, ['knowledge'], 0.02);
        content = hits.length
          ? `Give me a pattern and some text and I will run it for real.\n\n${hits.map((h) => `**${h.chunk.sourceTitle}**\n\n${h.chunk.text}`).join('\n\n')}`
          : 'Give me a pattern (e.g. `/\\b\\w+@\\w+\\.\\w+/g`) and some text to run it against.';
        citations.push(...hits.map((h, i) => ({ index: i + 1, title: h.chunk.sourceTitle, sourceId: h.chunk.sourceId, excerpt: h.chunk.text.slice(0, 200), score: h.score, kind: 'knowledge' as const })));
        confidence = 0.5;
      }
      break;
    }

    case 'json': {
      const fence = query.match(/```(?:json)?\s*([\s\S]*?)```/);
      const payload = fence ? fence[1] : query.replace(/^[^{[]*/, '').replace(/[^}\]]*$/, '');
      note('JSON route — validating and pretty-printing');
      const res = await callTool('json_format', { json: payload || query });
      content = res.detail ?? res.summary;
      confidence = res.ok ? 0.99 : 0.6;
      grounded = true;
      break;
    }

    case 'color': {
      const cm = query.match(/(#[0-9a-f]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\)|\b[a-z]+\b(?=\s*(colour|color)))/i);
      note('Colour route — converting spaces and computing WCAG contrast');
      const res = await callTool('convert_color', { color: cm?.[1] ?? query });
      content = res.ok ? res.detail ?? res.summary : `Could not parse a colour. ${res.error ?? ''}\n\nTry \`#7c8cff\`, \`rgb(124 140 255)\` or \`oklch\`.`;
      confidence = res.ok ? 0.99 : 0.3;
      grounded = res.ok;
      break;
    }

    case 'summarize': {
      const body = extractBody(query);
      if (!body || body.trim().length < 80) {
        content = docsIndexed
          ? 'Paste the text you want summarised, or index a document in **Documents** and ask me to summarise it — I will use query-biased extractive summarisation with a compression ratio.'
          : 'Paste the text you want summarised and I will compress it with MMR-based extractive summarisation.';
        confidence = 0.4;
        break;
      }
      const n = Number(query.match(/\b(\d)\s*(?:sentences|lines|points|bullets)\b/i)?.[1] ?? 4);
      note(`Summarisation route — target ${n} sentences over ${body.length} characters`);
      const res = await callTool('summarize', { text: body, sentences: n });
      content = res.detail ?? res.summary;
      confidence = res.ok ? 0.95 : 0.3;
      grounded = res.ok;
      break;
    }

    case 'sentiment': {
      const body = extractBody(query);
      if (!body) {
        content = 'Give me the text to score, e.g. "sentiment: the UI is lovely but the API is slow".';
        confidence = 0.4;
        break;
      }
      const res = await callTool('sentiment', { text: body });
      content = res.detail ?? res.summary;
      confidence = res.ok ? 0.9 : 0.3;
      grounded = res.ok;
      break;
    }

    case 'analyse': {
      const body = extractBody(query);
      if (!body) {
        content = 'Paste some text and I will report word/sentence counts, Flesch reading ease, grade level, lexical diversity, reading time and keyword weights.';
        confidence = 0.4;
        break;
      }
      const res = await callTool('analyse_text', { text: body });
      content = res.detail ?? res.summary;
      confidence = res.ok ? 0.97 : 0.3;
      grounded = res.ok;
      break;
    }

    case 'code': {
      const fence = query.match(/```(\w*)\n?([\s\S]*?)```/);
      const code = fence ? fence[2] : query.replace(/^(explain|review|refactor|debug|fix|what does this code do)[:\s]*/i, '');
      if (!code || code.trim().length < 12) {
        content = 'Paste the code (a fenced block works best) and I will detect the language, map its structure, estimate cyclomatic complexity, flag smells and pull relevant guidance from the corpus.';
        confidence = 0.4;
        break;
      }
      note(`Code route — ${detectLanguage(code, fence?.[1])} detected, ${code.split('\n').length} lines`);
      const composed = composeCodeExplanation(code, fence?.[1]);
      content = composed.content;
      citations.push(
        ...composed.kb.map((h, i) => ({
          index: i + 1,
          title: h.chunk.sourceTitle,
          sourceId: h.chunk.sourceId,
          excerpt: h.chunk.text.slice(0, 200),
          score: h.score,
          kind: 'knowledge' as const,
        })),
      );
      toolCalls.push({
        id: `code_analyze-0`,
        name: 'code_analyze',
        label: 'Code analysis',
        args: { code: `${code.slice(0, 60)}…`, language: detectLanguage(code, fence?.[1]) },
        result: composed.analysis,
        ms: 0,
      });
      confidence = 0.86;
      grounded = true;
      break;
    }

    case 'creative': {
      const kind = (query.match(/\b(haiku|poem|sonnet|verse|joke|limerick|slogan|tagline|story|song|rap)\b/i)?.[1] ?? 'poem').toLowerCase();
      const topic = query
        .replace(/^\s*(write|compose|make|create|give me)\b/i, '')
        .replace(new RegExp(`\\b(me\\s+)?(a|an|the)?\\s*${kind}\\b`, 'i'), '')
        .replace(/\b(about|on|for)\b/i, '')
        .replace(/[?.!]/g, '')
        .trim() || 'the quiet hours';
      note(`Creative route — ${kind} about "${topic}"`);
      content = composeCreative(kind, topic);
      confidence = 0.8;
      grounded = false;
      break;
    }

    case 'conversation':
    case 'clarify': {
      content = composeConversational(query, history);
      confidence = 0.6;
      break;
    }

    default: {
      // doc_qa / knowledge — the retrieval path.
      phase('retrieving');
      const useDocs = options.useDocuments !== false;
      const useKb = options.useKnowledge !== false;
      const ret = retrieve(query, { useDocuments: useDocs, useKnowledge: useKb });
      note(
        `Retrieved ${ret.hits.length} passage(s) · top ${(ret.topScore * 100).toFixed(0)}% · doc ${ret.docHits.length} / kb ${ret.kbHits.length}`,
      );

      // Document Q&A takes priority when the user has indexed files and they match.
      const docTop = ret.docHits[0];
      const preferDocs = docTop && docTop.score > 0.3 && (!ret.kbHits[0] || docTop.score > ret.kbHits[0].score);
      const effectiveIntent: Intent = preferDocs ? 'doc_qa' : 'knowledge';

      if (ret.hits.length && ret.topScore >= 0.2) {
        const hits = preferDocs ? [...ret.docHits.slice(0, 4), ...ret.kbHits.slice(0, 2)] : ret.hits.slice(0, 5);
        const composed = composeGrounded(query, hits, effectiveIntent, { useDocuments: useDocs });
        content = composed.content;
        citations.push(...composed.citations);
        for (const c of citations) emit({ type: 'citation', citation: c });
        confidence = composed.confidence;
        grounded = true;
        note(`Composed a grounded answer from ${citations.length} source(s), confidence ${(confidence * 100).toFixed(0)}%`);
      } else {
        phase('reasoning');
        const ungrounded = composeUngrounded(query, { docsIndexed });
        content = ungrounded.content;
        confidence = ungrounded.confidence;
        note('Relevance floor not met — declining to guess and reporting the gap instead.');
      }
      break;
    }
  }

  return finish();
}

function planFor(intent: Intent, query: string): string[] {
  const base = [`Parse intent from "${query.slice(0, 60)}${query.length > 60 ? '…' : ''}" → ${intent}`];
  switch (intent) {
    case 'math': return [...base, 'Tokenise the expression', 'Parse into an AST', 'Evaluate with exact arithmetic', 'Format and check for a symbolic form'];
    case 'conversion': return [...base, 'Resolve source and target units', 'Convert via the canonical base unit', 'Emit comparison table'];
    case 'code': return [...base, 'Detect language', 'Static analysis (complexity, smells)', 'Map structure line by line', 'Retrieve relevant guidance'];
    case 'summarize': return [...base, 'Split into sentences', 'Score by salience and centrality', 'MMR selection to remove redundancy'];
    case 'doc_qa': return [...base, 'Embed the query', 'Hybrid retrieval over your documents', 'Rank and de-duplicate', 'Compose with citations'];
    case 'knowledge': return [...base, 'Embed and expand the query', 'Hybrid retrieval over the corpus', 'Pick the best sentence per passage', 'Compose with citations'];
    case 'creative': return [...base, 'Seed a deterministic PRNG from the topic', 'Compose within the requested form', 'Verify constraints (e.g. syllables)'];
    default: return [...base, 'Select the matching tool', 'Execute', 'Format the result'];
  }
}

/** Strip an instruction prefix so "summarize: <text>" yields <text>. */
function extractBody(query: string): string {
  const fence = query.match(/```(?:\w*)\n?([\s\S]*?)```/);
  if (fence) return fence[1];
  const afterColon = query.match(/^\s*(?:please\s+)?(?:summar(?:ise|ize|y)|tl;?dr|sentiment|analy[sz]e|analyse)\b[^:]*:\s*([\s\S]+)$/i);
  if (afterColon) return afterColon[1].trim();
  const afterVerb = query.replace(/^\s*(?:please\s+)?(?:can you|could you)?\s*(?:summar(?:ise|ize|y)|tl;?dr|check the sentiment of|analy[sz]e)\s+(?:this|the following|it)?\s*/i, '');
  return afterVerb.trim().length > 40 ? afterVerb.trim() : '';
}

function composeConversational(query: string, history: ChatTurn[]): string {
  const lower = query.toLowerCase();
  const topics = keywords(query, 3).map((k) => k.term);
  if (/^(yes|yeah|yep|ok|okay|sure|no|nope|thanks|thank you|cool|nice|great)\b/.test(lower)) {
    return 'Anything else you want me to work through? I can calculate, convert units, analyse or summarise text, explain code, search the corpus, or plan a multi-step agent task.';
  }
  if (/\?$/.test(query.trim()) && topics.length) {
    const hits = store.search(query, 3, ['knowledge', 'document', 'note'], 0.05);
    if (hits.length) {
      const composed = composeGrounded(query, hits, 'knowledge', { useDocuments: true });
      return composed.content;
    }
  }
  return [
    `I read that as ${history.length ? `a continuation of our thread` : `an open remark`} — the strongest signals were ${topics.length ? topics.map((t) => `\`${t}\``).join(', ') : 'too faint to extract'}.`,
    '',
    'To get a grounded answer from me, try being specific:',
    '- Ask a question I can look up: "how does quantisation affect model quality?"',
    '- Give me something to compute: `calculate 1.08^30 * 5000`',
    '- Paste text or code and name the operation: "summarize: …", "explain this code: …"',
    '',
    `_Sentiment of your message reads ${sentiment(query).label} (${sentiment(query).score})._`,
  ].join('\n');
}

/** Stream composed text in word groups with human-ish timing. */
async function streamText(
  text: string,
  emit: (e: EngineEvent) => void,
  sleep: (ms: number) => Promise<void>,
  signal: { aborted: boolean },
): Promise<void> {
  const chunks = text.match(/\S+\s*|\s+/g) ?? [text];
  let buffer = '';
  let group = 0;
  const rand = rng(text.length * 31 + 7);
  for (const chunk of chunks) {
    if (signal.aborted) return;
    buffer += chunk;
    if (++group % 3 === 0 || /[.!?:]\s$/.test(buffer) || buffer.length > 24) {
      emit({ type: 'token', text: buffer });
      buffer = '';
      const pause = 8 + rand() * 16;
      if (pause > 4) await sleep(pause);
    }
  }
  if (buffer) emit({ type: 'token', text: buffer });
}

/** Quick relevance probe used by the Documents view for "does this corpus know X?" */
export function relevanceProbe(query: string): number {
  bootstrapKnowledge();
  const hits = store.search(query, 1, ['knowledge', 'document', 'note'], -1);
  return hits[0]?.score ?? 0;
}

export { hybridScore };
