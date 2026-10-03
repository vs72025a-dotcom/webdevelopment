/**
 * Persistence.
 *
 * IndexedDB holds conversations, uploaded documents and their *pre-computed
 * embedding vectors* (stored as Float32Array, which structured-clone handles
 * natively), so reopening the app restores a warm index without re-embedding.
 * localStorage holds only small preferences, including the theme — which the
 * inline script in index.html reads before first paint.
 */

import type { Citation, ToolCallRecord } from '../ai/engine';

export interface ToolCallInfo {
  name: string;
  label: string;
  args: Record<string, unknown>;
  summary: string;
  detail?: string;
  ok: boolean;
  ms: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  model?: string;
  intent?: string;
  confidence?: number;
  citations?: Citation[];
  toolCalls?: ToolCallInfo[];
  thinking?: string[];
  plan?: string[];
  tokens?: { prompt: number; completion: number };
  latencyMs?: number;
  grounded?: boolean;
  error?: string;
  streaming?: boolean;
  /** Set while the engine is still emitting tokens. */
  pending?: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  pinned?: boolean;
  summary?: string;
}

export interface DocChunk {
  text: string;
  embedding: Float32Array;
}

export interface DocRecord {
  id: string;
  title: string;
  kind: 'document' | 'note';
  text: string;
  addedAt: number;
  chars: number;
  chunks: DocChunk[];
  meta?: Record<string, string | number | boolean>;
}

export interface ArtworkRecord {
  id: string;
  spec: unknown;
  promptText: string;
  dataUrl: string;
  createdAt: number;
}

export interface Settings {
  theme: string;
  accent: string;
  motion: 'full' | 'reduced' | 'off';
  density: 'cosy' | 'compact';
  sidebarOpen: boolean;
  provider: {
    kind: string;
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    useTools: boolean;
    groundWithRetrieval: boolean;
  };
  engine: {
    useDocuments: boolean;
    useKnowledge: boolean;
    streamSpeed: number;
  };
  speech: {
    enabled: boolean;
    rate: number;
    pitch: number;
    voiceName: string;
    listenOnStart: boolean;
  };
  firstRunDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'aurora',
  accent: '',
  motion: 'full',
  density: 'cosy',
  sidebarOpen: true,
  provider: {
    kind: 'offline',
    apiKey: '',
    baseUrl: '',
    model: '',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: '',
    useTools: true,
    groundWithRetrieval: true,
  },
  engine: { useDocuments: true, useKnowledge: true, streamSpeed: 1 },
  speech: { enabled: false, rate: 1, pitch: 1, voiceName: '', listenOnStart: false },
  firstRunDone: false,
};

const DB_NAME = 'aurora-mind';
const DB_VERSION = 1;
const STORES = {
  conversations: 'conversations',
  documents: 'documents',
  settings: 'settings',
  artworks: 'artworks',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this browser context'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another open tab'));
  });
  return dbPromise;
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const request = fn(transaction.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const db = {
  async getAll<T>(storeName: string): Promise<T[]> {
    try {
      return await tx<T[]>(storeName, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
    } catch {
      return [];
    }
  },
  async get<T>(storeName: string, id: string): Promise<T | undefined> {
    try {
      return await tx<T | undefined>(storeName, 'readonly', (s) => s.get(id) as IDBRequest<T | undefined>);
    } catch {
      return undefined;
    }
  },
  async put(storeName: string, value: unknown): Promise<void> {
    try {
      await tx(storeName, 'readwrite', (s) => s.put(value as never));
    } catch {
      /* storage full or private mode — the app keeps working in memory */
    }
  },
  async delete(storeName: string, id: string): Promise<void> {
    try {
      await tx(storeName, 'readwrite', (s) => s.delete(id));
    } catch {
      /* ignore */
    }
  },
  async clear(storeName: string): Promise<void> {
    try {
      await tx(storeName, 'readwrite', (s) => s.clear());
    } catch {
      /* ignore */
    }
  },
  async estimate(): Promise<{ usage: number; quota: number } | null> {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
    return null;
  },
};

export const STORE = STORES;

// ─────────────────────────── localStorage helpers ───────────────────────────

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode */
  }
}

export function lsRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function lsSetRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** Wipe every trace of the app from this browser. */
export async function wipeEverything(): Promise<void> {
  for (const name of Object.values(STORES)) await db.clear(name);
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('am.'));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
  if (indexedDB.deleteDatabase) {
    indexedDB.deleteDatabase(DB_NAME);
    dbPromise = null;
  }
}

export function uid(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('')
      : Math.random().toString(16).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export function toToolCallInfo(record: ToolCallRecord): ToolCallInfo {
  return {
    name: record.name,
    label: record.label,
    args: record.args,
    summary: record.result.summary,
    detail: record.result.detail,
    ok: record.result.ok,
    ms: record.ms,
  };
}
