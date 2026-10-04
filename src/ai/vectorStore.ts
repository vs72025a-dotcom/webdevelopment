/**
 * Vector store + document chunking.
 *
 * In-memory flat index with cosine search. For a browser-side corpus (a few
 * thousand chunks) brute force is faster than any approximate index and uses a
 * fraction of the memory. Chunks are embedded once and cached by content hash.
 */

import { cosine, embed, hybridScore } from './embeddings';
import { contentTerms, estimateTokens, splitSentences, stem } from './tokenizer';

export interface Chunk {
  id: string;
  sourceId: string;
  sourceTitle: string;
  text: string;
  index: number;
  embedding: Float32Array;
  tokens: number;
  /**
   * The source's curated keyword field (its tags). Search scores it, but the
   * composer never quotes it: tags are synonyms, not prose, and a chunk of pure
   * keywords would otherwise be eligible as an answer sentence.
   */
  tags?: string;
  tagEmbedding?: Float32Array;
  tagTerms?: string[];
}

export interface Hit {
  chunk: Chunk;
  score: number;
  lexical: number;
  semantic: number;
}

export interface SourceRecord {
  id: string;
  title: string;
  kind: 'document' | 'knowledge' | 'conversation' | 'note';
  addedAt: number;
  chars: number;
  chunks: number;
  /** Optional raw text, kept only for user documents (knowledge corpus is code). */
  text?: string;
  meta?: Record<string, string | number | boolean>;
}

const embedCache = new Map<number, Float32Array>();

function cachedEmbed(text: string): Float32Array {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hit = embedCache.get(h);
  if (hit) return hit;
  const vec = embed(text);
  if (embedCache.size > 6000) embedCache.clear();
  embedCache.set(h, vec);
  return vec;
}

export interface ChunkOptions {
  target?: number;
  overlap?: number;
  max?: number;
}

/**
 * Semantic chunking: prefer paragraph breaks, then sentence breaks, then hard
 * splits. Adjacent chunks overlap so an answer spanning a boundary is still
 * retrievable from a single chunk.
 */
export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const target = opts.target ?? 760;
  const overlap = opts.overlap ?? 120;
  const max = opts.max ?? target * 2.2;

  const clean = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= target) return [clean];

  const blocks = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    const t = current.trim();
    if (t) chunks.push(t);
    current = '';
  };

  const pushSentence = (sentence: string) => {
    if (current && current.length + sentence.length + 1 > target) {
      const tail = current.slice(-overlap).trim();
      flush();
      current = tail ? `${tail} ${sentence}` : sentence;
    } else {
      current = current ? `${current} ${sentence}` : sentence;
    }
    if (current.length > max) flush();
  };

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    if (trimmed.length <= target) {
      if (current && current.length + trimmed.length + 2 > target) flush();
      current = current ? `${current}\n\n${trimmed}` : trimmed;
      if (current.length > max) flush();
      continue;
    }
    flush();
    for (const s of splitSentences(trimmed)) pushSentence(s);
  }
  flush();
  return chunks.filter((c) => c.length > 24);
}

/**
 * Weight of a source's curated tags in the final score.
 *
 * Tags are hand-written synonyms — "macrotask", "deoptimization", "rule of 72" —
 * so they are exactly what a user's phrasing tends to miss. Without this the
 * keyword field only affected the re-rank, which runs *after* the candidate cut,
 * so an entry could be tagged perfectly and still never be retrieved.
 */
const TAG_WEIGHT = 0.5;

function tagBonus(qv: Float32Array, queryTerms: string[], chunk: Chunk): number {
  if (!chunk.tagEmbedding || !chunk.tagTerms?.length || !queryTerms.length) return 0;
  const semantic = cosine(qv, chunk.tagEmbedding);
  // Same stem-level coverage rule as hybridScore: a tag field has to match the
  // query's actual content words to earn credit.
  const wanted = new Set(queryTerms.map(stemTerm));
  const termSet = new Set(chunk.tagTerms);
  let hits = 0;
  for (const t of wanted) if (termSet.has(t)) hits++;
  const lexical = hits / wanted.size;
  return TAG_WEIGHT * (0.55 * semantic + 0.45 * Math.min(1, lexical));
}

const stemCache = new Map<string, string>();
function stemTerm(t: string): string {
  let hit = stemCache.get(t);
  if (hit === undefined) {
    hit = stem(t);
    if (stemCache.size > 4000) stemCache.clear();
    stemCache.set(t, hit);
  }
  return hit;
}

export class VectorStore {
  private chunks: Chunk[] = [];
  private byId = new Map<string, Chunk>();
  private sources = new Map<string, SourceRecord>();

  get size(): number {
    return this.chunks.length;
  }

  get sourceCount(): number {
    return this.sources.size;
  }

  listSources(): SourceRecord[] {
    return [...this.sources.values()].sort((a, b) => b.addedAt - a.addedAt);
  }

  getSource(id: string): SourceRecord | undefined {
    return this.sources.get(id);
  }

  chunksFor(sourceId: string): Chunk[] {
    return this.chunks.filter((c) => c.sourceId === sourceId);
  }

  /**
   * Index a document. `precomputed` lets callers supply chunks whose embeddings
   * are already known (used when rehydrating from IndexedDB).
   */
  addSource(
    record: Omit<SourceRecord, 'chunks' | 'chars'>,
    text: string,
    options?: ChunkOptions,
    precomputed?: Array<{ text: string; embedding?: number[] }>,
  ): SourceRecord {
    const pieces = precomputed
      ? precomputed.map((p) => p.text)
      : chunkText(text, options);
    const tags = String(record.meta?.tags ?? '').replace(/,/g, ' ').trim();
    const tagEmbedding = tags ? cachedEmbed(tags) : undefined;
    const tagTerms = tags ? [...new Set(contentTerms(tags))] : undefined;

    pieces.forEach((piece, i) => {
      const id = `${record.id}#${i}`;
      const embedding =
        precomputed?.[i]?.embedding
          ? Float32Array.from(precomputed[i].embedding as number[])
          : cachedEmbed(piece);
      const chunk: Chunk = {
        id,
        sourceId: record.id,
        sourceTitle: record.title,
        text: piece,
        index: i,
        embedding,
        tokens: estimateTokens(piece),
        tags: tags || undefined,
        tagEmbedding,
        tagTerms,
      };
      this.chunks.push(chunk);
      this.byId.set(id, chunk);
    });
    const full: SourceRecord = {
      ...record,
      chunks: pieces.length,
      chars: text.length,
      text: record.kind === 'document' || record.kind === 'note' ? text : undefined,
    };
    this.sources.set(record.id, full);
    return full;
  }

  removeSource(id: string): void {
    this.chunks = this.chunks.filter((c) => c.sourceId !== id);
    for (const key of [...this.byId.keys()]) {
      if (key.startsWith(`${id}#`)) this.byId.delete(key);
    }
    this.sources.delete(id);
  }

  clear(kinds?: SourceRecord['kind'][]): void {
    if (!kinds) {
      this.chunks = [];
      this.byId.clear();
      this.sources.clear();
      return;
    }
    const doomed = new Set(
      [...this.sources.values()].filter((s) => kinds.includes(s.kind)).map((s) => s.id),
    );
    for (const id of doomed) this.removeSource(id);
  }

  /** k-nearest chunks, restricted to the given source kinds when supplied. */
  search(query: string, k = 6, kinds?: SourceRecord['kind'][], minScore = 0.05): Hit[] {
    if (!this.chunks.length || !query.trim()) return [];
    const qv = cachedEmbed(query);
    const terms = [...new Set(contentTerms(query))];
    const scored: Hit[] = [];
    for (const chunk of this.chunks) {
      if (kinds && !kinds.includes(this.sources.get(chunk.sourceId)?.kind ?? 'document')) continue;
      const semantic = cosine(qv, chunk.embedding);
      const base = terms.length ? hybridScore(query, chunk.text, terms) : semantic;
      const score = base + tagBonus(qv, terms, chunk);
      if (score >= minScore) scored.push({ chunk, score, semantic, lexical: score - semantic });
    }
    scored.sort((a, b) => b.score - a.score);
    return this.dedupe(scored.slice(0, k * 2), k);
  }

  /** Collapse near-duplicate neighbours from the same source (overlap artefacts). */
  private dedupe(hits: Hit[], k: number): Hit[] {
    const out: Hit[] = [];
    const seen = new Set<string>();
    for (const h of hits) {
      const key = h.chunk.text.slice(0, 64);
      const neighbour = `${h.chunk.sourceId}:${h.chunk.index + 1}`;
      if (seen.has(key) || seen.has(neighbour)) continue;
      seen.add(key);
      seen.add(`${h.chunk.sourceId}:${h.chunk.index}`);
      out.push(h);
      if (out.length >= k) break;
    }
    return out;
  }

  stats(): { chunks: number; sources: number; vectors: number; dim: number } {
    return {
      chunks: this.chunks.length,
      sources: this.sources.size,
      vectors: this.chunks.length * (this.chunks[0]?.embedding.length ?? 0),
      dim: this.chunks[0]?.embedding.length ?? 0,
    };
  }

  serializeSources(): Array<{ record: SourceRecord; chunks: Array<{ text: string; embedding: number[] }> }> {
    return [...this.sources.values()]
      .filter((s) => s.kind === 'document' || s.kind === 'note')
      .map((record) => ({
        record: { ...record, text: record.text },
        chunks: this.chunksFor(record.id).map((c) => ({
          text: c.text,
          embedding: Array.from(c.embedding),
        })),
      }));
  }
}

/** The shared store instance used by the whole app. */
export const store = new VectorStore();
