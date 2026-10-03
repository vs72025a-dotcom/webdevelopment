/**
 * Text analysis primitives used by the engine and by the Code Lab / Documents
 * views. Every function here is a genuine algorithm — no mock data.
 */

import { contentTerms, isStopword, splitSentences, tokenize } from './tokenizer';
import { embed, cosine } from './embeddings';

export interface TextStats {
  chars: number;
  charsNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  uniqueWords: number;
  lexicalDiversity: number;
  avgWordLength: number;
  avgSentenceLength: number;
  readingTimeSec: number;
  speakingTimeSec: number;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  longWords: number;
  topKeywords: Array<{ term: string; count: number; weight: number }>;
}

/** Heuristic English syllable counter (good to ~95% on prose). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let count = 0;
  let prevVowel = false;
  const vowels = 'aeiouy';
  for (let i = 0; i < w.length; i++) {
    const isVowel = vowels.includes(w[i]);
    if (isVowel && !prevVowel) count++;
    prevVowel = isVowel;
  }
  if (w.endsWith('e') && !w.endsWith('le') && count > 1) count--;
  if (w.endsWith('ed') && count > 1 && !/[td]ed$/.test(w)) count--;
  return Math.max(1, count);
}

export function textStats(text: string): TextStats {
  const trimmed = text.trim();
  const tokens = tokenize(trimmed).filter((t) => t.kind !== 'space');
  const words = tokens.filter((t) => t.kind === 'word' || t.kind === 'number' || t.kind === 'code');
  const sentences = splitSentences(trimmed);
  const paragraphs = trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const syllables = words.reduce((a, w) => a + countSyllables(w.value), 0);

  const freq = new Map<string, number>();
  for (const w of words) {
    const v = w.value.replace(/[^a-z0-9']/g, '');
    if (!v || v.length < 2) continue;
    freq.set(v, (freq.get(v) ?? 0) + 1);
  }
  const total = words.length || 1;
  const ranked = [...freq.entries()]
    .filter(([t]) => !isStopword(t))
    .map(([term, count]) => ({ term, count, weight: (count / total) * Math.log1p(count) }))
    .sort((a, b) => b.weight - a.weight);

  const wCount = words.length || 1;
  const sCount = sentences.length || 1;
  const flesch = 206.835 - 1.015 * (wCount / sCount) - 84.6 * (syllables / wCount);
  const grade = 0.39 * (wCount / sCount) + 11.8 * (syllables / wCount) - 15.59;

  return {
    chars: text.length,
    charsNoSpaces: text.replace(/\s/g, '').length,
    words: words.length,
    sentences: sentences.length,
    paragraphs,
    uniqueWords: freq.size,
    lexicalDiversity: freq.size / wCount,
    avgWordLength: words.reduce((a, w) => a + w.value.length, 0) / wCount,
    avgSentenceLength: wCount / sCount,
    readingTimeSec: Math.round((words.length / 238) * 60),
    speakingTimeSec: Math.round((words.length / 150) * 60),
    fleschReadingEase: clamp(flesch, 0, 120),
    fleschKincaidGrade: Math.max(0, grade),
    longWords: words.filter((w) => countSyllables(w.value) >= 3).length,
    topKeywords: ranked.slice(0, 12),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

export function readabilityLabel(score: number): string {
  if (score >= 90) return 'Very easy (5th grade)';
  if (score >= 80) return 'Easy (6th grade)';
  if (score >= 70) return 'Fairly easy (7th grade)';
  if (score >= 60) return 'Standard (8th–9th grade)';
  if (score >= 50) return 'Fairly difficult (10th–12th)';
  if (score >= 30) return 'Difficult (college)';
  return 'Very difficult (graduate)';
}

export interface SummaryResult {
  summary: string;
  sentences: Array<{ text: string; score: number; index: number }>;
  ratio: number;
  method: string;
}

/**
 * Extractive summarisation.
 *
 * Sentence scoring blends four signals:
 *   1. term salience  — sum of position-normalised term frequencies
 *   2. semantic centrality — mean cosine similarity to every other sentence
 *   3. position — lead and recency bias (journalistic inverted pyramid)
 *   4. length — penalise fragments, penalise runaway sentences
 *
 * Then a greedy MMR pass removes redundancy so the output is not repetitive.
 */
export function summarize(text: string, targetSentences = 4, query?: string): SummaryResult {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return { summary: '', sentences: [], ratio: 0, method: 'empty' };
  }
  if (sentences.length <= targetSentences) {
    return {
      summary: sentences.join(' '),
      sentences: sentences.map((s, i) => ({ text: s, score: 1, index: i })),
      ratio: 1,
      method: 'full-text (already concise)',
    };
  }

  const termFreq = new Map<string, number>();
  const perSentence: string[][] = sentences.map((s) => contentTerms(s));
  for (const terms of perSentence) {
    for (const t of terms) termFreq.set(t, (termFreq.get(t) ?? 0) + 1);
  }
  let maxFreq = 1;
  for (const f of termFreq.values()) maxFreq = Math.max(maxFreq, f);

  const vectors = sentences.map((s) => embed(s));
  const n = sentences.length;
  const queryVec = query ? embed(query) : null;

  const scored = sentences.map((sentence, i) => {
    const terms = perSentence[i];
    let salience = 0;
    for (const t of terms) salience += (termFreq.get(t) ?? 0) / maxFreq;
    salience /= Math.sqrt(terms.length || 1);

    let centrality = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      centrality += cosine(vectors[i], vectors[j]);
    }
    centrality /= Math.max(1, n - 1);

    const positionBias = i === 0 ? 1.35 : i === 1 ? 1.15 : i === n - 1 ? 1.05 : 1 - (i / n) * 0.35;
    const words = sentence.split(/\s+/).length;
    const lengthPenalty = words < 5 ? 0.4 : words > 45 ? 0.75 : 1;
    const queryBoost = queryVec ? 0.6 * Math.max(0, cosine(vectors[i], queryVec)) : 0;

    const score = (0.42 * salience + 0.28 * centrality + queryBoost) * positionBias * lengthPenalty;
    return { text: sentence, score, index: i };
  });

  // Maximal marginal relevance selection.
  const chosen: typeof scored = [];
  const pool = [...scored].sort((a, b) => b.score - a.score);
  const lambda = 0.72;
  while (chosen.length < targetSentences && pool.length) {
    let bestIdx = 0;
    let best = -Infinity;
    pool.forEach((cand, i) => {
      let maxSim = 0;
      for (const sel of chosen) maxSim = Math.max(maxSim, cosine(vectors[cand.index], vectors[sel.index]));
      const mmr = lambda * cand.score - (1 - lambda) * maxSim;
      if (mmr > best) {
        best = mmr;
        bestIdx = i;
      }
    });
    chosen.push(pool.splice(bestIdx, 1)[0]);
  }

  chosen.sort((a, b) => a.index - b.index);
  const summary = chosen.map((c) => c.text).join(' ');
  return {
    summary,
    sentences: chosen,
    ratio: summary.length / text.length,
    method: query ? 'query-biased MMR extractive' : 'MMR extractive (salience + centrality)',
  };
}

/** TF-IDF keywords across the document's own sentences. */
export function keywords(text: string, k = 8): Array<{ term: string; count: number; score: number }> {
  const sentences = splitSentences(text);
  const docs = (sentences.length ? sentences : [text]).map((s) => contentTerms(s));
  const df = new Map<string, number>();
  const tf = new Map<string, number>();
  for (const terms of docs) {
    const unique = new Set(terms);
    for (const t of unique) df.set(t, (df.get(t) ?? 0) + 1);
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  const N = docs.length || 1;
  return [...tf.entries()]
    .map(([term, count]) => ({
      term,
      count,
      score: (1 + Math.log(count)) * Math.log(1 + N / (df.get(term) ?? 1)),
    }))
    .filter((x) => x.term.length > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

const POSITIVE = new Set([
  'good', 'great', 'excellent', 'amazing', 'awesome', 'wonderful', 'fantastic', 'love', 'loved',
  'best', 'happy', 'joy', 'beautiful', 'brilliant', 'perfect', 'superb', 'nice', 'delightful',
  'impressive', 'fast', 'easy', 'helpful', 'clear', 'elegant', 'fun', 'win', 'won', 'success',
  'positive', 'recommend', 'recommended', 'smooth', 'solid', 'strong', 'thanks', 'thank',
]);

const NEGATIVE = new Set([
  'bad', 'terrible', 'awful', 'horrible', 'hate', 'hated', 'worst', 'sad', 'angry', 'broken',
  'bug', 'bugs', 'buggy', 'slow', 'confusing', 'difficult', 'hard', 'ugly', 'poor', 'wrong',
  'error', 'errors', 'fail', 'failed', 'failure', 'crash', 'crashed', 'annoying', 'frustrating',
  'negative', 'disappointing', 'useless', 'messy', 'weak', 'problem', 'issues', 'issue', 'risk',
]);

const INTENSIFIERS: Record<string, number> = {
  very: 1.6, really: 1.6, extremely: 2.0, incredibly: 1.9, so: 1.4, totally: 1.5,
  absolutely: 1.9, quite: 1.2, somewhat: 0.7, slightly: 0.6, barely: 0.4,
};

export interface SentimentResult {
  score: number;
  label: 'positive' | 'neutral' | 'negative';
  confidence: number;
  positives: string[];
  negatives: string[];
  negations: number;
}

/** Lexicon-based sentiment with negation scopes and intensifiers. */
export function sentiment(text: string): SentimentResult {
  const words = tokenize(text)
    .filter((t) => t.kind === 'word')
    .map((t) => t.value.replace(/[^a-z']/g, ''));

  let score = 0;
  const positives: string[] = [];
  const negatives: string[] = [];
  let negations = 0;
  let negate = 0;
  let intensity = 1;

  for (const w of words) {
    if (['not', "n't", 'no', 'never', 'neither', 'nobody', 'nothing', 'nor', 'cannot'].includes(w) || w.endsWith("n't")) {
      negate = 3;
      negations++;
      continue;
    }
    if (INTENSIFIERS[w]) {
      intensity = INTENSIFIERS[w];
      continue;
    }
    if (w === 'but') {
      // What follows "but" carries the real opinion.
      score *= 0.5;
    }
    let delta = 0;
    if (POSITIVE.has(w)) {
      delta = 1 * intensity;
      positives.push(w);
    } else if (NEGATIVE.has(w)) {
      delta = -1 * intensity;
      negatives.push(w);
    }
    if (delta !== 0) {
      score += negate > 0 ? -delta : delta;
      if (negate > 0) negate--;
    } else if (negate > 0) negate--;
    intensity = 1;
  }

  const norm = clamp(score / Math.max(4, Math.sqrt(words.length)), -1, 1);
  const label: SentimentResult['label'] = norm > 0.12 ? 'positive' : norm < -0.12 ? 'negative' : 'neutral';
  return {
    score: Number(norm.toFixed(3)),
    label,
    confidence: Number(clamp(Math.abs(norm) * 2.2, 0, 1).toFixed(2)),
    positives: [...new Set(positives)],
    negatives: [...new Set(negatives)],
    negations,
  };
}

/** Strip markup for preview snippets. */
export function plainText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]{1,}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function snippet(text: string, max = 220): string {
  const p = plainText(text);
  if (p.length <= max) return p;
  return `${p.slice(0, max).replace(/\s\S*$/, '')}…`;
}
