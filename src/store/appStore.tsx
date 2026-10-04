/**
 * Application store.
 *
 * Holds conversations, the document index and settings, and owns the single
 * `send()` pipeline that decides whether a turn is answered by the on-device
 * engine or streamed from a configured provider. Both paths produce the same
 * message shape — content, citations, tool calls, thinking trace and telemetry
 * — so the rest of the UI never needs to know which one ran.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import {
  bootstrapKnowledge, generate, setKnowledgePack, ENGINE_MODEL_ID,
  type EngineEvent, type EnginePhase, type Citation, type ChatTurn,
} from '../ai/engine';
import { streamProvider, buildSystemPrompt, DEFAULT_CONFIG, type ProviderConfig, type ProviderEvent, type ProviderMessage } from '../ai/providers';
import { store as vectorStore } from '../ai/vectorStore';
import { embed } from '../ai/embeddings';
import { chunkText } from '../ai/vectorStore';
import { estimateTokens } from '../ai/tokenizer';
import { setActivity, pushActivity } from '../theme/themes';
import {
  db, STORE, uid, lsGet, lsSet, toToolCallInfo,
  type Conversation, type Message, type Settings, type DocRecord, type ToolCallInfo,
  DEFAULT_SETTINGS, wipeEverything,
} from './db';

export type ViewId = 'chat' | 'documents' | 'codelab' | 'studio' | 'agents' | 'settings';

export interface Toast {
  id: string;
  tone: 'ok' | 'err' | 'warn' | 'info';
  title: string;
  body?: string;
}

interface StoreValue {
  ready: boolean;
  view: ViewId;
  setView: (v: ViewId) => void;
  conversations: Conversation[];
  active: Conversation | null;
  documents: DocRecord[];
  settings: Settings;
  busy: boolean;
  phase: EnginePhase | null;
  toasts: Toast[];
  indexStats: { chunks: number; sources: number };
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  newConversation: (seed?: string) => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  clearConversations: () => Promise<void>;
  send: (text: string, opts?: { conversationId?: string }) => Promise<void>;
  stop: () => void;
  regenerate: (messageId: string) => Promise<void>;
  deleteMessage: (messageId: string) => void;
  editMessage: (messageId: string, content: string) => Promise<void>;
  addFiles: (files: FileList | File[]) => Promise<{ added: number; failed: number }>;
  addNote: (title: string, text: string) => Promise<void>;
  removeDocument: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => void;
  updateProvider: (patch: Partial<Settings['provider']>) => void;
  toast: (tone: Toast['tone'], title: string, body?: string) => void;
  dismissToast: (id: string) => void;
  wipe: () => Promise<void>;
  exportConversation: (id: string, format: 'md' | 'json') => string;
}

const StoreContext = createContext<StoreValue | null>(null);

const TEXT_EXT = /\.(txt|md|markdown|json|jsonc|csv|tsv|log|js|mjs|cjs|ts|tsx|jsx|py|rb|go|rs|java|c|h|cpp|hpp|cs|php|html|htm|css|scss|less|yml|yaml|toml|ini|cfg|conf|sh|bash|zsh|sql|xml|svg|env|gitignore|dockerfile)$/i;

function titleFrom(text: string): string {
  const clean = text.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return 'New conversation';
  const cut = clean.length > 46 ? `${clean.slice(0, 46).replace(/\s\S*$/, '')}…` : clean;
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

export function StoreProvider({ children }: { children: ReactNode }): ReactNode {
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<ViewId>('chat');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [settings, setSettings] = useState<Settings>(() => ({
    ...DEFAULT_SETTINGS,
    ...lsGet<Partial<Settings>>('am.settings', {}),
    provider: { ...DEFAULT_SETTINGS.provider, ...(lsGet<Partial<Settings>>('am.settings', {}).provider ?? {}) },
    engine: { ...DEFAULT_SETTINGS.engine, ...(lsGet<Partial<Settings>>('am.settings', {}).engine ?? {}) },
    speech: { ...DEFAULT_SETTINGS.speech, ...(lsGet<Partial<Settings>>('am.settings', {}).speech ?? {}) },
  }));
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<EnginePhase | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const abortRef = useRef<{ aborted: boolean }>({ aborted: false });
  const saveTimer = useRef<number | null>(null);
  const flushTimer = useRef<number | null>(null);
  const bufferRef = useRef('');
  const bufferTarget = useRef<string | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const indexStats = useMemo(
    () => ({ chunks: vectorStore.size, sources: vectorStore.sourceCount }),
    [documents.length, ready, settings.engine.extendedPack],
  );

  // Settings toggles the extended corpus; keep the live index in step.
  useEffect(() => {
    if (!ready) return;
    setKnowledgePack(settings.engine.extendedPack);
  }, [ready, settings.engine.extendedPack]);

  // ───────────────────────── boot ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      bootstrapKnowledge();
      // The saved preference decides whether the extended corpus is indexed.
      if (!settingsRef.current.engine.extendedPack) setKnowledgePack(false);
      const [convs, docs] = await Promise.all([
        db.getAll<Conversation>(STORE.conversations),
        db.getAll<DocRecord>(STORE.documents),
      ]);
      if (cancelled) return;

      // Rehydrate the vector index from stored embeddings — no re-embedding.
      for (const doc of docs) {
        try {
          vectorStore.addSource(
            { id: doc.id, title: doc.title, kind: doc.kind, addedAt: doc.addedAt, meta: doc.meta },
            doc.text,
            undefined,
            doc.chunks.map((c) => ({ text: c.text, embedding: Array.from(c.embedding) })),
          );
        } catch {
          /* a corrupt record must not block boot */
        }
      }

      const sorted = convs.sort((a, b) => b.updatedAt - a.updatedAt);
      setConversations(sorted);
      setDocuments(docs.sort((a, b) => b.addedAt - a.addedAt));
      setActiveId(sorted[0]?.id ?? null);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ───────────────────────── persistence ─────────────────────────
  const persistConversation = useCallback((conv: Conversation) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void db.put(STORE.conversations, conv);
    }, 380);
  }, []);

  useEffect(() => {
    if (!ready) return;
    lsSet('am.settings', settings);
  }, [settings, ready]);

  // Keep the theme attributes in localStorage in sync with settings.
  useEffect(() => {
    if (!ready) return;
    document.documentElement.setAttribute('data-density', settings.density);
  }, [settings.density, ready]);

  // ───────────────────────── toasts ─────────────────────────
  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (tone: Toast['tone'], title: string, body?: string) => {
      const id = uid('toast');
      setToasts((t) => [...t.slice(-3), { id, tone, title, body }]);
      window.setTimeout(() => dismissToast(id), tone === 'err' ? 8000 : 4600);
    },
    [dismissToast],
  );

  // ───────────────────────── conversation mutations ─────────────────────────
  const patchConversation = useCallback(
    (id: string, fn: (c: Conversation) => Conversation) => {
      let next: Conversation | null = null;
      setConversations((list) =>
        list.map((c) => {
          if (c.id !== id) return c;
          next = fn(c);
          return next;
        }),
      );
      // Persist outside the updater so we never write during render.
      window.setTimeout(() => {
        if (next) persistConversation(next);
      }, 0);
    },
    [persistConversation],
  );

  const patchMessage = useCallback(
    (convId: string, msgId: string, fn: (m: Message) => Message) => {
      patchConversation(convId, (c) => ({ ...c, messages: c.messages.map((m) => (m.id === msgId ? fn(m) : m)) }));
    },
    [patchConversation],
  );

  const newConversation = useCallback(
    (seed?: string) => {
      const conv: Conversation = {
        id: uid('c'),
        title: seed ? titleFrom(seed) : 'New conversation',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [],
      };
      setConversations((l) => [conv, ...l]);
      setActiveId(conv.id);
      setView('chat');
      void db.put(STORE.conversations, conv);
      return conv.id;
    },
    [],
  );

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    setView('chat');
    setPanelOpen(window.innerWidth > 860);
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((l) => l.filter((c) => c.id !== id));
      void db.delete(STORE.conversations, id);
      setActiveId((cur) => {
        if (cur !== id) return cur;
        const rest = conversations.filter((c) => c.id !== id);
        return rest[0]?.id ?? null;
      });
      toast('info', 'Conversation deleted');
    },
    [conversations, toast],
  );

  const renameConversation = useCallback(
    (id: string, title: string) => {
      patchConversation(id, (c) => ({ ...c, title: title.trim() || c.title, updatedAt: Date.now() }));
    },
    [patchConversation],
  );

  const togglePin = useCallback(
    (id: string) => {
      patchConversation(id, (c) => ({ ...c, pinned: !c.pinned }));
    },
    [patchConversation],
  );

  const clearConversations = useCallback(async () => {
    setConversations([]);
    setActiveId(null);
    await db.clear(STORE.conversations);
    toast('info', 'All conversations cleared');
  }, [toast]);

  const deleteMessage = useCallback(
    (messageId: string) => {
      if (!activeId) return;
      patchConversation(activeId, (c) => ({ ...c, messages: c.messages.filter((m) => m.id !== messageId) }));
    },
    [activeId, patchConversation],
  );

  // ───────────────────────── documents ─────────────────────────
  const indexDocument = useCallback(
    async (title: string, text: string, kind: 'document' | 'note' = 'document', meta?: Record<string, string | number | boolean>) => {
      const id = uid('doc');
      const pieces = chunkText(text);
      const chunks = pieces.map((t) => ({ text: t, embedding: embed(t) }));
      const record: DocRecord = {
        id,
        title,
        kind,
        text,
        addedAt: Date.now(),
        chars: text.length,
        chunks,
        meta,
      };
      vectorStore.addSource({ id, title, kind, addedAt: record.addedAt, meta }, text, undefined, chunks.map((c) => ({ text: c.text, embedding: Array.from(c.embedding) })));
      setDocuments((d) => [record, ...d]);
      await db.put(STORE.documents, record);
      return record;
    },
    [],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      let added = 0;
      let failed = 0;
      for (const file of list) {
        const isText = TEXT_EXT.test(file.name) || file.type.startsWith('text/') || file.type === 'application/json';
        if (!isText) {
          failed++;
          toast('warn', `${file.name} skipped`, 'Only text-based files can be indexed. PDFs and Office documents are not decoded in the browser — paste the text instead.');
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          failed++;
          toast('warn', `${file.name} is too large`, 'The browser index caps documents at 8 MB.');
          continue;
        }
        try {
          const text = await file.text();
          if (!text.trim()) {
            failed++;
            continue;
          }
          await indexDocument(file.name, text, 'document', { type: file.type || 'text/plain', bytes: file.size });
          added++;
        } catch {
          failed++;
        }
      }
      if (added) toast('ok', `${added} document${added === 1 ? '' : 's'} indexed`, failed ? `${failed} could not be read.` : undefined);
      else if (failed) toast('err', 'Nothing was indexed', 'Check the file types and try again.');
      return { added, failed };
    },
    [indexDocument, toast],
  );

  const addNote = useCallback(
    async (title: string, text: string) => {
      await indexDocument(title.trim() || 'Untitled note', text, 'note');
      toast('ok', 'Note indexed');
    },
    [indexDocument, toast],
  );

  const removeDocument = useCallback(
    async (id: string) => {
      vectorStore.removeSource(id);
      setDocuments((d) => d.filter((x) => x.id !== id));
      await db.delete(STORE.documents, id);
      toast('info', 'Removed from the index');
    },
    [toast],
  );

  // ───────────────────────── settings ─────────────────────────
  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const updateProvider = useCallback((patch: Partial<Settings['provider']>) => {
    setSettings((s) => ({ ...s, provider: { ...s.provider, ...patch } }));
  }, []);

  // ───────────────────────── streaming buffer ─────────────────────────
  /**
   * Token deltas arrive far faster than it is worth re-rendering. They are
   * buffered and flushed at most every ~45 ms, which keeps scrolling smooth and
   * markdown parsing cheap without any visible stutter.
   */
  const queueDelta = useCallback(
    (convId: string, msgId: string, text: string) => {
      bufferRef.current += text;
      bufferTarget.current = `${convId}|${msgId}`;
      if (flushTimer.current) return;
      flushTimer.current = window.setTimeout(() => {
        flushTimer.current = null;
        const chunk = bufferRef.current;
        bufferRef.current = '';
        const target = bufferTarget.current;
        if (!chunk || !target) return;
        const [cId, mId] = target.split('|');
        patchMessage(cId, mId, (m) => ({ ...m, content: m.content + chunk }));
      }, 45);
    },
    [patchMessage],
  );

  const flushBuffer = useCallback(() => {
    if (flushTimer.current) {
      window.clearTimeout(flushTimer.current);
      flushTimer.current = null;
    }
    const chunk = bufferRef.current;
    bufferRef.current = '';
    const target = bufferTarget.current;
    bufferTarget.current = null;
    if (!chunk || !target) return;
    const [cId, mId] = target.split('|');
    patchMessage(cId, mId, (m) => ({ ...m, content: m.content + chunk }));
  }, [patchMessage]);

  // ───────────────────────── the send pipeline ─────────────────────────
  const runTurn = useCallback(
    async (convId: string, userText: string, historyBefore: ChatTurn[]) => {
      const assistantId = uid('m');
      const assistant: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        pending: true,
        streaming: true,
        toolCalls: [],
        citations: [],
        thinking: [],
        plan: [],
      };
      patchConversation(convId, (c) => ({
        ...c,
        updatedAt: Date.now(),
        title: c.messages.length === 1 && c.title === 'New conversation' ? titleFrom(userText) : c.title,
        messages: [...c.messages, assistant],
      }));

      abortRef.current = { aborted: false };
      setBusy(true);
      setPhase('understanding');
      setActivity('thinking', 0.55);

      const cfg = settingsRef.current;
      const provider: ProviderConfig = {
        ...DEFAULT_CONFIG,
        kind: cfg.provider.kind as ProviderConfig['kind'],
        apiKey: cfg.provider.apiKey,
        baseUrl: cfg.provider.baseUrl,
        model: cfg.provider.model,
        temperature: cfg.provider.temperature,
        maxTokens: cfg.provider.maxTokens,
        systemPrompt: cfg.provider.systemPrompt || DEFAULT_CONFIG.systemPrompt,
        useTools: cfg.provider.useTools,
        groundWithRetrieval: cfg.provider.groundWithRetrieval,
      };

      const useProvider = provider.kind !== 'offline' && Boolean(provider.model);
      const t0 = performance.now();
      let finalText = '';
      let model = ENGINE_MODEL_ID;
      const toolCalls: ToolCallInfo[] = [];
      const citations: Citation[] = [];
      const thinking: string[] = [];
      let plan: string[] = [];
      let confidence: number | undefined;
      let intent: string | undefined;
      let grounded = false;
      let tokens = { prompt: estimateTokens(userText), completion: 0 };
      let errorMsg: string | undefined;

      try {
        if (useProvider) {
          // Remote model, optionally grounded in the local index.
          let context: Array<{ title: string; text: string; kind: string }> = [];
          if (provider.groundWithRetrieval) {
            const kinds = cfg.engine.useDocuments && cfg.engine.useKnowledge
              ? (['knowledge', 'document', 'note'] as const)
              : cfg.engine.useDocuments
                ? (['document', 'note'] as const)
                : (['knowledge'] as const);
            const hits = vectorStore.search(userText, 5, [...kinds] as never, 0.12);
            context = hits.map((h) => ({ title: h.chunk.sourceTitle, text: h.chunk.text, kind: h.chunk.sourceId.startsWith('kb:') ? 'corpus' : 'your document' }));
            citations.push(
              ...hits.map((h, i) => ({
                index: i + 1,
                title: h.chunk.sourceTitle,
                sourceId: h.chunk.sourceId,
                excerpt: h.chunk.text.slice(0, 240),
                score: h.score,
                kind: h.chunk.sourceId.startsWith('kb:') ? ('knowledge' as const) : ('document' as const),
              })),
            );
          }

          const messages: ProviderMessage[] = [
            { role: 'system', content: buildSystemPrompt(provider.systemPrompt, context) },
            ...historyBefore,
            { role: 'user', content: userText },
          ];
          tokens.prompt = messages.reduce((a, m) => a + estimateTokens(m.content), 0);
          model = `${provider.model} · ${provider.kind}`;
          setPhase('streaming');

          await streamProvider(
            provider,
            messages,
            (ev: ProviderEvent) => {
              switch (ev.type) {
                case 'delta':
                  finalText += ev.text;
                  queueDelta(convId, assistantId, ev.text);
                  pushActivity('streaming', 0.12);
                  break;
                case 'tool_start':
                  setActivity('tool', 0.8);
                  thinking.push(`calling ${ev.name}(${JSON.stringify(ev.args).slice(0, 120)})`);
                  patchMessage(convId, assistantId, (m) => ({ ...m, thinking }));
                  break;
                case 'tool_end':
                  toolCalls.push(toToolCallInfo({ id: ev.name, name: ev.name, label: ev.name, args: {}, result: ev.result, ms: ev.ms }));
                  thinking.push(`${ev.name} → ${ev.result.ok ? ev.result.summary : `error: ${ev.result.error}`}`);
                  patchMessage(convId, assistantId, (m) => ({ ...m, toolCalls: [...toolCalls], thinking: [...thinking] }));
                  setActivity('streaming', 0.6);
                  break;
                case 'usage':
                  tokens = { prompt: ev.promptTokens || tokens.prompt, completion: ev.completionTokens || estimateTokens(finalText) };
                  break;
                case 'notice':
                  thinking.push(`note: ${ev.text}`);
                  patchMessage(convId, assistantId, (m) => ({ ...m, thinking: [...thinking] }));
                  break;
                case 'error':
                  errorMsg = ev.hint ? `${ev.message} — ${ev.hint}` : ev.message;
                  break;
                case 'done':
                  break;
              }
            },
            undefined,
          );
          if (errorMsg && !finalText) {
            finalText = `**Provider request failed.**\n\n${errorMsg}\n\nSwitch back to the on-device engine in **Settings → Model provider**, or fix the configuration and try again.`;
          }
        } else {
          // On-device engine.
          const res = await generate(userText, {
            history: historyBefore,
            useDocuments: cfg.engine.useDocuments,
            useKnowledge: cfg.engine.useKnowledge,
            streamDelay: cfg.engine.streamSpeed,
            signal: abortRef.current,
            onEvent: (ev: EngineEvent) => {
              switch (ev.type) {
                case 'phase':
                  if (ev.phase) setPhase(ev.phase);
                  setActivity(ev.phase === 'streaming' ? 'streaming' : 'thinking', ev.phase === 'retrieving' ? 0.5 : 0.28);
                  break;
                case 'plan':
                  plan = ev.plan ?? [];
                  patchMessage(convId, assistantId, (m) => ({ ...m, plan }));
                  break;
                case 'thought':
                  thinking.push(ev.text ?? '');
                  pushActivity('thinking', 0.1);
                  patchMessage(convId, assistantId, (m) => ({ ...m, thinking: [...thinking] }));
                  break;
                case 'tool_start':
                  setActivity('tool', 0.85);
                  break;
                case 'tool_end':
                  if (ev.call) {
                    toolCalls.push(toToolCallInfo(ev.call));
                    patchMessage(convId, assistantId, (m) => ({ ...m, toolCalls: [...toolCalls] }));
                  }
                  setActivity('streaming', 0.6);
                  break;
                case 'citation':
                  if (ev.citation) {
                    citations.push(ev.citation);
                    patchMessage(convId, assistantId, (m) => ({ ...m, citations: [...citations] }));
                  }
                  break;
                case 'token':
                  finalText += ev.text ?? '';
                  queueDelta(convId, assistantId, ev.text ?? '');
                  pushActivity('streaming', 0.1);
                  break;
                case 'error':
                  errorMsg = ev.text;
                  break;
                case 'done':
                  break;
              }
            },
          });
          finalText = res.content;
          model = res.model;
          confidence = res.confidence;
          intent = res.intent;
          grounded = res.grounded;
          tokens = res.tokens;
          thinking.length = 0;
          thinking.push(...res.thinking);
          citations.length = 0;
          citations.push(...res.citations);
          toolCalls.length = 0;
          toolCalls.push(...res.toolCalls.map(toToolCallInfo));
          plan = [...(plan.length ? plan : [])];
        }
      } catch (e) {
        errorMsg = e instanceof Error ? e.message : String(e);
        finalText = finalText || `Something went wrong while answering: **${errorMsg}**`;
      }

      flushBuffer();
      tokens.completion = tokens.completion || estimateTokens(finalText);

      patchMessage(convId, assistantId, (m) => ({
        ...m,
        content: finalText,
        pending: false,
        streaming: false,
        model,
        intent,
        confidence,
        grounded,
        citations,
        toolCalls,
        thinking,
        plan,
        tokens,
        latencyMs: Math.round(performance.now() - t0),
        error: errorMsg,
      }));

      setBusy(false);
      setPhase(null);
      setActivity('done', 0.45);
      window.setTimeout(() => setActivity('idle'), 1600);
    },
    [flushBuffer, patchConversation, patchMessage, queueDelta],
  );

  const send = useCallback(
    async (text: string, opts?: { conversationId?: string }) => {
      const clean = text.trim();
      if (!clean || busy) return;
      let convId = opts?.conversationId ?? activeId;
      if (!convId) convId = newConversation(clean);

      const conv = conversations.find((c) => c.id === convId);
      const historyBefore: ChatTurn[] = (conv?.messages ?? [])
        .filter((m) => !m.pending)
        .slice(-14)
        .map((m) => ({ role: m.role, content: m.content }));

      const userMsg: Message = { id: uid('m'), role: 'user', content: clean, createdAt: Date.now() };
      patchConversation(convId, (c) => ({ ...c, updatedAt: Date.now(), messages: [...c.messages, userMsg] }));
      if (!conv) {
        // Brand-new conversation: set its title immediately.
        patchConversation(convId, (c) => ({ ...c, title: titleFrom(clean) }));
      }
      setActiveId(convId);
      await runTurn(convId, clean, historyBefore);
    },
    [activeId, busy, conversations, newConversation, patchConversation, runTurn],
  );

  const stop = useCallback(() => {
    abortRef.current.aborted = true;
    setBusy(false);
    setPhase(null);
    setActivity('idle');
    flushBuffer();
    if (activeId) {
      patchConversation(activeId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.pending
            ? { ...m, pending: false, streaming: false, content: m.content || '_Stopped._', thinking: [...(m.thinking ?? []), 'stopped by user'] }
            : m,
        ),
      }));
    }
  }, [activeId, flushBuffer, patchConversation]);

  const regenerate = useCallback(
    async (messageId: string) => {
      if (!activeId || busy) return;
      const conv = conversations.find((c) => c.id === activeId);
      if (!conv) return;
      const idx = conv.messages.findIndex((m) => m.id === messageId);
      if (idx < 1) return;
      const userMsg = conv.messages[idx - 1];
      if (userMsg.role !== 'user') return;
      patchConversation(activeId, (c) => ({ ...c, messages: c.messages.slice(0, idx) }));
      const historyBefore = conv.messages
        .slice(0, idx - 1)
        .slice(-14)
        .map((m) => ({ role: m.role, content: m.content }));
      await runTurn(activeId, userMsg.content, historyBefore);
    },
    [activeId, busy, conversations, patchConversation, runTurn],
  );

  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!activeId || busy) return;
      const conv = conversations.find((c) => c.id === activeId);
      if (!conv) return;
      const idx = conv.messages.findIndex((m) => m.id === messageId);
      if (idx < 0) return;
      patchConversation(activeId, (c) => ({ ...c, messages: c.messages.slice(0, idx) }));
      const historyBefore = conv.messages.slice(0, idx).slice(-14).map((m) => ({ role: m.role, content: m.content }));
      await runTurn(activeId, content, historyBefore);
    },
    [activeId, busy, conversations, patchConversation, runTurn],
  );

  const exportConversation = useCallback(
    (id: string, format: 'md' | 'json') => {
      const conv = conversations.find((c) => c.id === id);
      if (!conv) return '';
      if (format === 'json') return JSON.stringify(conv, null, 2);
      const lines = [`# ${conv.title}`, '', `_Exported ${new Date().toISOString()}_`, ''];
      for (const m of conv.messages) {
        lines.push(`## ${m.role === 'user' ? 'You' : 'Aurora Mind'}`, '', m.content, '');
        if (m.citations?.length) {
          lines.push('**Sources**', '');
          m.citations.forEach((c) => lines.push(`- [${c.index}] ${c.title} (${(c.score * 100).toFixed(0)}%)`));
          lines.push('');
        }
        if (m.toolCalls?.length) {
          lines.push('**Tools**', '');
          m.toolCalls.forEach((t) => lines.push(`- \`${t.name}\` → ${t.summary}`));
          lines.push('');
        }
        lines.push('---', '');
      }
      return lines.join('\n');
    },
    [conversations],
  );

  const wipe = useCallback(async () => {
    await wipeEverything();
    vectorStore.clear(['document', 'note']);
    setConversations([]);
    setDocuments([]);
    setActiveId(null);
    setSettings(DEFAULT_SETTINGS);
    toast('ok', 'Everything erased', 'Conversations, documents, vectors and preferences are gone from this browser.');
  }, [toast]);

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId]);

  const value: StoreValue = {
    ready,
    view,
    setView,
    conversations,
    active,
    documents,
    settings,
    busy,
    phase,
    toasts,
    indexStats,
    paletteOpen,
    setPaletteOpen,
    panelOpen,
    setPanelOpen,
    newConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    togglePin,
    clearConversations,
    send,
    stop,
    regenerate,
    deleteMessage,
    editMessage,
    addFiles,
    addNote,
    removeDocument,
    updateSettings,
    updateProvider,
    toast,
    dismissToast,
    exportConversation,
    wipe,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
