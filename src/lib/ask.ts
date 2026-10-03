/**
 * One-shot question answering for the non-chat surfaces.
 *
 * Code Lab, Studio and Agents all need "ask the model something and stream the
 * answer into this panel" without creating a conversation record. This is the
 * same routing the chat pipeline uses — provider when one is configured, the
 * on-device engine otherwise — factored out so the two can never drift apart.
 */

import { estimateTokens } from '../ai/tokenizer';
import { generate, ENGINE_MODEL_ID, type Citation, type ChatTurn, type EngineEvent } from '../ai/engine';
import {
  DEFAULT_CONFIG,
  buildSystemPrompt,
  streamProvider,
  type ProviderConfig,
  type ProviderEvent,
  type ProviderMessage,
} from '../ai/providers';
import { store as vectorStore } from '../ai/vectorStore';
import { toToolCallInfo, type Settings, type ToolCallInfo } from '../store/db';
import { pushActivity, setActivity } from '../theme/themes';

export interface AskOptions {
  settings: Settings;
  /** Extra instruction folded into the system prompt for the provider path. */
  system?: string;
  history?: ChatTurn[];
  signal?: { aborted: boolean };
  onDelta?: (text: string) => void;
  onPhase?: (phase: string) => void;
  /** Retrieve from the local index and cite what is used. Default true. */
  ground?: boolean;
}

export interface AskResult {
  content: string;
  model: string;
  citations: Citation[];
  toolCalls: ToolCallInfo[];
  thinking: string[];
  plan: string[];
  confidence?: number;
  intent?: string;
  grounded: boolean;
  tokens: { prompt: number; completion: number };
  latencyMs: number;
  error?: string;
  usedProvider: boolean;
}

export function providerFrom(settings: Settings): ProviderConfig {
  return {
    ...DEFAULT_CONFIG,
    kind: settings.provider.kind as ProviderConfig['kind'],
    apiKey: settings.provider.apiKey,
    baseUrl: settings.provider.baseUrl,
    model: settings.provider.model,
    temperature: settings.provider.temperature,
    maxTokens: settings.provider.maxTokens,
    systemPrompt: settings.provider.systemPrompt || DEFAULT_CONFIG.systemPrompt,
    useTools: settings.provider.useTools,
    groundWithRetrieval: settings.provider.groundWithRetrieval,
  };
}

export function isRemote(settings: Settings): boolean {
  return settings.provider.kind !== 'offline' && settings.provider.model.trim() !== '';
}

export async function ask(prompt: string, opts: AskOptions): Promise<AskResult> {
  const { settings, system, history = [], signal, onDelta, onPhase, ground = true } = opts;
  const t0 = performance.now();

  const result: AskResult = {
    content: '',
    model: ENGINE_MODEL_ID,
    citations: [],
    toolCalls: [],
    thinking: [],
    plan: [],
    grounded: false,
    tokens: { prompt: estimateTokens(prompt), completion: 0 },
    latencyMs: 0,
    usedProvider: false,
  };

  setActivity('thinking', 0.5);
  onPhase?.('understanding');

  try {
    if (isRemote(settings)) {
      const provider = providerFrom(settings);
      result.usedProvider = true;
      result.model = `${provider.model} · ${provider.kind}`;

      let context: Array<{ title: string; text: string; kind: string }> = [];
      if (ground && provider.groundWithRetrieval) {
        const kinds =
          settings.engine.useDocuments && settings.engine.useKnowledge
            ? (['knowledge', 'document', 'note'] as const)
            : settings.engine.useDocuments
              ? (['document', 'note'] as const)
              : (['knowledge'] as const);
        const hits = vectorStore.search(prompt, 5, [...kinds] as never, 0.12);
        context = hits.map((h) => ({
          title: h.chunk.sourceTitle,
          text: h.chunk.text,
          kind: h.chunk.sourceId.startsWith('kb:') ? 'corpus' : 'your document',
        }));
        result.citations = hits.map((h, i) => ({
          index: i + 1,
          title: h.chunk.sourceTitle,
          sourceId: h.chunk.sourceId,
          excerpt: h.chunk.text.slice(0, 240),
          score: h.score,
          kind: h.chunk.sourceId.startsWith('kb:') ? ('knowledge' as const) : ('document' as const),
        }));
      }

      const base = system ? `${provider.systemPrompt}\n\n${system}` : provider.systemPrompt;
      const messages: ProviderMessage[] = [
        { role: 'system', content: buildSystemPrompt(base, context) },
        ...history.map((h) => ({ role: h.role, content: h.content }) as ProviderMessage),
        { role: 'user', content: prompt },
      ];
      result.tokens.prompt = messages.reduce((a, m) => a + estimateTokens(m.content), 0);
      onPhase?.('streaming');

      let err: string | undefined;
      await streamProvider(
        provider,
        messages,
        (ev: ProviderEvent) => {
          switch (ev.type) {
            case 'delta':
              result.content += ev.text;
              onDelta?.(ev.text);
              pushActivity('streaming', 0.12);
              break;
            case 'tool_start':
              setActivity('tool', 0.8);
              result.thinking.push(`calling ${ev.name}(${JSON.stringify(ev.args).slice(0, 120)})`);
              break;
            case 'tool_end':
              result.toolCalls.push(
                toToolCallInfo({ id: ev.name, name: ev.name, label: ev.name, args: {}, result: ev.result, ms: ev.ms }),
              );
              setActivity('streaming', 0.6);
              break;
            case 'usage':
              result.tokens = {
                prompt: ev.promptTokens || result.tokens.prompt,
                completion: ev.completionTokens || estimateTokens(result.content),
              };
              break;
            case 'notice':
              result.thinking.push(`note: ${ev.text}`);
              break;
            case 'error':
              err = ev.hint ? `${ev.message} — ${ev.hint}` : ev.message;
              break;
            case 'done':
              break;
          }
        },
        undefined,
      );
      if (err && !result.content) result.error = err;
      else if (err) result.error = err;
    } else {
      const res = await generate(prompt, {
        history,
        useDocuments: settings.engine.useDocuments,
        useKnowledge: settings.engine.useKnowledge,
        streamDelay: settings.engine.streamSpeed,
        signal,
        onEvent: (ev: EngineEvent) => {
          switch (ev.type) {
            case 'phase':
              onPhase?.(ev.phase ?? 'reasoning');
              setActivity(ev.phase === 'streaming' ? 'streaming' : 'thinking', ev.phase === 'retrieving' ? 0.5 : 0.28);
              break;
            case 'plan':
              result.plan = ev.plan ?? [];
              break;
            case 'thought':
              result.thinking.push(ev.text ?? '');
              pushActivity('thinking', 0.1);
              break;
            case 'tool_start':
              setActivity('tool', 0.85);
              break;
            case 'tool_end':
              if (ev.call) result.toolCalls.push(toToolCallInfo(ev.call));
              setActivity('streaming', 0.6);
              break;
            case 'citation':
              if (ev.citation) result.citations.push(ev.citation);
              break;
            case 'token':
              onDelta?.(ev.text ?? '');
              pushActivity('streaming', 0.1);
              break;
            case 'error':
              result.error = ev.text;
              break;
            case 'done':
              break;
          }
        },
      });
      result.content = res.content;
      result.model = res.model;
      result.confidence = res.confidence;
      result.intent = res.intent;
      result.grounded = res.grounded;
      result.tokens = res.tokens;
      result.thinking = res.thinking;
      result.citations = res.citations;
      result.toolCalls = res.toolCalls.map(toToolCallInfo);
    }
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }

  result.tokens.completion = result.tokens.completion || estimateTokens(result.content);
  result.latencyMs = Math.round(performance.now() - t0);
  setActivity('done', 0.45);
  window.setTimeout(() => setActivity('idle'), 1400);
  onPhase?.('done');
  return result;
}
