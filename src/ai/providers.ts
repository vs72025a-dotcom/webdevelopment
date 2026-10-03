/**
 * Provider layer — connect the workspace to a real frontier model.
 *
 * Four wire protocols are implemented natively, all streaming:
 *   • OpenAI-compatible  (OpenAI, OpenRouter, Groq, Together, DeepSeek,
 *                         Mistral, LM Studio, Ollama, any /v1 server)
 *   • Anthropic Messages API
 *   • Google Gemini
 *   • the on-device engine (kind: 'offline', handled by the caller)
 *
 * Tool calling is a genuine loop: the model's function-call request is parsed
 * out of the stream, executed by our local tool registry, and the observation is
 * sent back so the model can continue. Nothing is simulated.
 *
 * Keys live only in this browser's localStorage and are sent only to the
 * endpoint the user configured. There is no proxy and no telemetry.
 */

import { runTool, toolSchemasForProviders, ToolResult } from './tools';

export type ProviderKind = 'offline' | 'openai' | 'anthropic' | 'gemini' | 'ollama';

export interface ProviderConfig {
  kind: ProviderKind;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  useTools: boolean;
  groundWithRetrieval: boolean;
}

export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
}

export type ProviderEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_start'; name: string; args: Record<string, unknown> }
  | { type: 'tool_end'; name: string; result: ToolResult; ms: number }
  | { type: 'notice'; text: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number; model: string }
  | { type: 'done'; text: string }
  | { type: 'error'; message: string; hint?: string };

export const PROVIDER_PRESETS: Record<
  Exclude<ProviderKind, 'offline'>,
  { label: string; baseUrl: string; models: string[]; docs: string; note: string }
> = {
  openai: {
    label: 'OpenAI (or any compatible API)',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'],
    docs: 'platform.openai.com/docs/api-reference/chat',
    note: 'Also works with OpenRouter, Groq, Together, DeepSeek and Mistral — just change the base URL and model.',
  },
  anthropic: {
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-3-5-haiku-latest'],
    docs: 'docs.anthropic.com/en/api/messages',
    note: 'Browser calls need the direct-access header, which this client sets. Some workspaces block CORS — a local proxy may be required.',
  },
  gemini: {
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    docs: 'ai.google.dev/api/generate-content',
    note: 'The API key is sent as a query parameter, as the Gemini REST API requires.',
  },
  ollama: {
    label: 'Local model (Ollama / LM Studio)',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3.2', 'qwen2.5-coder', 'mistral-nemo', 'phi3'],
    docs: 'ollama.com/blog/openai-compatibility',
    note: 'Fully private: nothing leaves your machine. Ollama exposes an OpenAI-compatible /v1 endpoint.',
  },
};

export const DEFAULT_CONFIG: ProviderConfig = {
  kind: 'offline',
  apiKey: '',
  baseUrl: '',
  model: '',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt:
    'You are Aurora Mind, a precise and candid AI assistant embedded in a browser workspace. ' +
    'Answer directly, use markdown, show code in fenced blocks with a language tag, and cite the ' +
    'CONTEXT passages as [1], [2] when you rely on them. Use tools for arithmetic, dates, unit ' +
    'conversion and text analysis instead of guessing. If the context is insufficient, say so ' +
    'plainly rather than inventing facts.',
  useTools: true,
  groundWithRetrieval: true,
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function readSSE(
  res: Response,
  onEvent: (data: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!res.body) throw new Error('Response has no body to stream');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {});
      return;
    }
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, '').trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      onEvent(payload);
    }
  }
}

function describeHttpError(status: number, body: string, kind: ProviderKind): { message: string; hint?: string } {
  let parsed: string | null = null;
  try {
    const j = JSON.parse(body);
    parsed = j?.error?.message ?? j?.message ?? j?.error?.msg ?? null;
  } catch {
    parsed = body.slice(0, 300) || null;
  }
  const hints: Record<number, string> = {
    401: 'The API key was rejected. Check it in Settings, and that it belongs to the provider you selected.',
    403: 'Access forbidden — the key may lack permission for this model or region.',
    404: 'Endpoint or model not found. Verify the base URL and the exact model id.',
    429: 'Rate limit or quota exceeded. Wait a moment, or check your plan billing.',
    500: 'The provider had a server error. Retry shortly.',
    502: 'Bad gateway from the provider. Retry shortly.',
    503: 'The provider is overloaded or the model is at capacity.',
  };
  return {
    message: `HTTP ${status}${parsed ? ` — ${parsed}` : ''}`,
    hint: hints[status] ?? (kind === 'ollama' ? 'Is the local server running and reachable from this origin?' : undefined),
  };
}

// ─────────────────────────── OpenAI-compatible ───────────────────────────

interface PendingToolCall {
  id: string;
  name: string;
  arguments: string;
}

async function streamOpenAI(
  cfg: ProviderConfig,
  messages: ProviderMessage[],
  emit: (e: ProviderEvent) => void,
  signal?: AbortSignal,
  maxRounds = 4,
): Promise<string> {
  const tools = cfg.useTools ? toolSchemasForProviders() : [];
  let convo = messages.map((m) => ({ role: m.role, content: m.content, ...(m.name ? { name: m.name } : {}), ...(m.toolCallId ? { tool_call_id: m.toolCallId } : {}) }));
  let finalText = '';

  for (let round = 0; round <= maxRounds; round++) {
    const res = await fetch(joinUrl(cfg.baseUrl, 'chat/completions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: convo,
        stream: true,
        stream_options: { include_usage: true },
        temperature: cfg.temperature,
        max_tokens: cfg.maxTokens,
        ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
      }),
      signal,
    });

    if (!res.ok) {
      const { message, hint } = describeHttpError(res.status, await res.text(), cfg.kind);
      emit({ type: 'error', message, hint });
      return finalText;
    }

    let assistantText = '';
    const pending = new Map<number, PendingToolCall>();
    let finishReason = '';

    await readSSE(
      res,
      (data) => {
        let json: any;
        try {
          json = JSON.parse(data);
        } catch {
          return;
        }
        if (json.usage) {
          emit({
            type: 'usage',
            promptTokens: json.usage.prompt_tokens ?? 0,
            completionTokens: json.usage.completion_tokens ?? 0,
            model: json.model ?? cfg.model,
          });
        }
        const choice = json.choices?.[0];
        if (!choice) return;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const delta = choice.delta;
        if (!delta) return;
        if (typeof delta.content === 'string' && delta.content) {
          assistantText += delta.content;
          emit({ type: 'delta', text: delta.content });
        }
        for (const tc of delta.tool_calls ?? []) {
          const idx = tc.index ?? 0;
          const slot = pending.get(idx) ?? { id: '', name: '', arguments: '' };
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name += tc.function.name;
          if (tc.function?.arguments) slot.arguments += tc.function.arguments;
          pending.set(idx, slot);
        }
      },
      signal,
    );

    finalText += assistantText;

    if (!pending.size || finishReason !== 'tool_calls') {
      if (pending.size) emit({ type: 'notice', text: 'Model requested tools but the stream ended without a tool_calls finish reason.' });
      return finalText;
    }

    // Execute the requested tools locally and feed the observations back.
    convo = [...convo, { role: 'assistant', content: assistantText, tool_calls: [...pending.values()].map((p) => ({ id: p.id, type: 'function', function: { name: p.name, arguments: p.arguments } })) } as never];
    for (const call of pending.values()) {
      let args: Record<string, string | number | boolean> = {};
      try {
        args = call.arguments ? JSON.parse(call.arguments) : {};
      } catch {
        emit({ type: 'notice', text: `Malformed arguments from the model for ${call.name}: ${call.arguments.slice(0, 120)}` });
      }
      emit({ type: 'tool_start', name: call.name, args });
      const t0 = performance.now();
      const result = await runTool(call.name, args);
      emit({ type: 'tool_end', name: call.name, result, ms: Math.round(performance.now() - t0) });
      const observation = result.ok
        ? `${result.summary}\n${result.detail ?? ''}`.trim()
        : `ERROR: ${result.error ?? result.summary}`;
      convo.push({ role: 'tool', tool_call_id: call.id, content: observation } as never);
    }
    pending.clear();
  }
  emit({ type: 'notice', text: 'Stopped after the maximum number of tool rounds.' });
  return finalText;
}

// ─────────────────────────── Anthropic ───────────────────────────

async function streamAnthropic(
  cfg: ProviderConfig,
  messages: ProviderMessage[],
  emit: (e: ProviderEvent) => void,
  signal?: AbortSignal,
  maxRounds = 4,
): Promise<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  let convo: any[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content }));

  const tools = cfg.useTools
    ? toolSchemasForProviders().map((t) => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters }))
    : [];

  let finalText = '';
  for (let round = 0; round <= maxRounds; round++) {
    const res = await fetch(joinUrl(cfg.baseUrl, 'messages'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        // Required for direct browser calls; without it the API rejects CORS.
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: cfg.maxTokens,
        temperature: cfg.temperature,
        ...(system ? { system } : {}),
        messages: convo,
        stream: true,
        ...(tools.length ? { tools } : {}),
      }),
      signal,
    });

    if (!res.ok) {
      const { message, hint } = describeHttpError(res.status, await res.text(), cfg.kind);
      emit({ type: 'error', message, hint: hint ?? 'Anthropic requires the direct-browser-access header for CORS; some environments still block it.' });
      return finalText;
    }

    let assistantText = '';
    const blocks: Array<{ type: string; name?: string; id?: string; json: string }> = [];
    let current: { type: string; name?: string; id?: string; json: string } | null = null;
    let stopReason = '';

    await readSSE(
      res,
      (data) => {
        let ev: any;
        try {
          ev = JSON.parse(data);
        } catch {
          return;
        }
        switch (ev.type) {
          case 'content_block_start':
            current = { type: ev.content_block?.type ?? 'text', name: ev.content_block?.name, id: ev.content_block?.id, json: '' };
            break;
          case 'content_block_delta':
            if (!current) return;
            if (ev.delta?.type === 'text_delta' && ev.delta.text) {
              assistantText += ev.delta.text;
              emit({ type: 'delta', text: ev.delta.text });
            } else if (ev.delta?.type === 'input_json_delta' && ev.delta.partial_json) {
              current.json += ev.delta.partial_json;
            }
            break;
          case 'content_block_stop':
            if (current) blocks.push(current);
            current = null;
            break;
          case 'message_delta':
            if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
            break;
          case 'message_stop':
            break;
          default:
            if (ev.usage) {
              emit({ type: 'usage', promptTokens: ev.usage.input_tokens ?? 0, completionTokens: ev.usage.output_tokens ?? 0, model: cfg.model });
            }
        }
      },
      signal,
    );

    finalText += assistantText;
    const toolUses = blocks.filter((b) => b.type === 'tool_use');
    if (!toolUses.length || stopReason !== 'tool_use') return finalText;

    const assistantContent: any[] = [];
    if (assistantText) assistantContent.push({ type: 'text', text: assistantText });
    for (const b of toolUses) {
      let input: Record<string, unknown> = {};
      try {
        input = b.json ? JSON.parse(b.json) : {};
      } catch {
        /* leave empty */
      }
      assistantContent.push({ type: 'tool_use', id: b.id, name: b.name, input });
    }
    convo = [...convo, { role: 'assistant', content: assistantContent }];

    const results: any[] = [];
    for (const b of toolUses) {
      let input: Record<string, unknown> = {};
      try {
        input = b.json ? JSON.parse(b.json) : {};
      } catch {
        /* leave empty */
      }
      emit({ type: 'tool_start', name: b.name ?? 'unknown', args: input });
      const t0 = performance.now();
      const result = await runTool(b.name ?? '', input as Record<string, string | number | boolean>);
      emit({ type: 'tool_end', name: b.name ?? 'unknown', result, ms: Math.round(performance.now() - t0) });
      results.push({
        type: 'tool_result',
        tool_use_id: b.id,
        content: result.ok ? `${result.summary}\n${result.detail ?? ''}`.trim() : `ERROR: ${result.error ?? result.summary}`,
        is_error: !result.ok,
      });
    }
    convo = [...convo, { role: 'user', content: results }];
  }
  return finalText;
}

// ─────────────────────────── Gemini ───────────────────────────

function toGeminiContents(messages: ProviderMessage[]): { systemInstruction?: any; contents: any[] } {
  const systemText = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents: any[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.role === 'tool' ? `Tool result for ${m.name ?? 'tool'}:\n${m.content}` : m.content }],
    });
  }
  return { systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined, contents };
}

async function streamGemini(
  cfg: ProviderConfig,
  messages: ProviderMessage[],
  emit: (e: ProviderEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  const { systemInstruction, contents } = toGeminiContents(messages);
  const tools = cfg.useTools
    ? [{ functionDeclarations: toolSchemasForProviders().map((t) => ({ name: t.function.name, description: t.function.description, parameters: t.function.parameters })) }]
    : [];

  const url = `${joinUrl(cfg.baseUrl, `models/${cfg.model}:streamGenerateContent`)}?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
      ...(tools.length ? { tools } : {}),
      generationConfig: { temperature: cfg.temperature, maxOutputTokens: cfg.maxTokens },
    }),
    signal,
  });

  if (!res.ok) {
    const { message, hint } = describeHttpError(res.status, await res.text(), cfg.kind);
    emit({ type: 'error', message, hint });
    return '';
  }

  let text = '';
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  await readSSE(
    res,
    (data) => {
      let json: any;
      try {
        json = JSON.parse(data);
      } catch {
        return;
      }
      if (json.usageMetadata) {
        emit({
          type: 'usage',
          promptTokens: json.usageMetadata.promptTokenCount ?? 0,
          completionTokens: json.usageMetadata.candidatesTokenCount ?? 0,
          model: cfg.model,
        });
      }
      for (const cand of json.candidates ?? []) {
        for (const part of cand.content?.parts ?? []) {
          if (typeof part.text === 'string' && part.text) {
            text += part.text;
            emit({ type: 'delta', text: part.text });
          }
          if (part.functionCall) calls.push({ name: part.functionCall.name, args: part.functionCall.args ?? {} });
        }
      }
    },
    signal,
  );

  // Gemini's streaming API returns function calls at the end of the stream;
  // execute them and do one follow-up round with the observations.
  if (calls.length) {
    const responses: any[] = [];
    for (const call of calls) {
      emit({ type: 'tool_start', name: call.name, args: call.args });
      const t0 = performance.now();
      const result = await runTool(call.name, call.args as Record<string, string | number | boolean>);
      emit({ type: 'tool_end', name: call.name, result, ms: Math.round(performance.now() - t0) });
      responses.push({ functionResponse: { name: call.name, response: { result: result.ok ? result.summary : `ERROR: ${result.error}` , detail: result.detail ?? '' } } });
    }
    const followUp = await fetch(`${joinUrl(cfg.baseUrl, `models/${cfg.model}:streamGenerateContent`)}?alt=sse&key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [...contents, { role: 'model', parts: calls.map((c) => ({ functionCall: { name: c.name, args: c.args } })) }, { role: 'user', parts: responses }],
        ...(systemInstruction ? { systemInstruction } : {}),
        generationConfig: { temperature: cfg.temperature, maxOutputTokens: cfg.maxTokens },
      }),
      signal,
    });
    if (followUp.ok) {
      await readSSE(
        followUp,
        (data) => {
          try {
            const json = JSON.parse(data);
            for (const cand of json.candidates ?? []) {
              for (const part of cand.content?.parts ?? []) {
                if (typeof part.text === 'string' && part.text) {
                  text += part.text;
                  emit({ type: 'delta', text: part.text });
                }
              }
            }
          } catch {
            /* ignore malformed frame */
          }
        },
        signal,
      );
    }
  }
  return text;
}

// ─────────────────────────── entry point ───────────────────────────

export async function streamProvider(
  cfg: ProviderConfig,
  messages: ProviderMessage[],
  emit: (e: ProviderEvent) => void,
  signal?: AbortSignal,
): Promise<string> {
  if (cfg.kind === 'offline') {
    emit({ type: 'error', message: 'No provider configured — using the on-device engine.' });
    return '';
  }
  if (!cfg.apiKey && cfg.kind !== 'ollama') {
    emit({ type: 'error', message: 'No API key set.', hint: 'Add one in Settings → Model provider, or switch back to the on-device engine.' });
    return '';
  }
  if (!cfg.model) {
    emit({ type: 'error', message: 'No model selected.', hint: 'Choose a model id in Settings → Model provider.' });
    return '';
  }
  try {
    let text = '';
    if (cfg.kind === 'anthropic') text = await streamAnthropic(cfg, messages, emit, signal);
    else if (cfg.kind === 'gemini') text = await streamGemini(cfg, messages, emit, signal);
    else text = await streamOpenAI(cfg, messages, emit, signal);
    emit({ type: 'done', text });
    return text;
  } catch (e) {
    const err = e as Error;
    if (err.name === 'AbortError') {
      emit({ type: 'notice', text: 'Stopped.' });
      return '';
    }
    emit({
      type: 'error',
      message: err.message || 'Network request failed',
      hint: /Failed to fetch|NetworkError/i.test(err.message ?? '')
        ? 'The browser blocked the request. Common causes: the provider does not allow CORS from this origin, the base URL is unreachable, or you are offline. Local servers (Ollama, LM Studio) must send permissive CORS headers.'
        : undefined,
    });
    return '';
  }
}

/** Verify a key and list available models for the Settings screen. */
export async function probeProvider(
  cfg: ProviderConfig,
): Promise<{ ok: boolean; message: string; models?: string[] }> {
  try {
    if (cfg.kind === 'openai' || cfg.kind === 'ollama') {
      const res = await fetch(joinUrl(cfg.baseUrl, 'models'), { headers: cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {} });
      if (!res.ok) return { ok: false, message: describeHttpError(res.status, await res.text(), cfg.kind).message };
      const json = await res.json();
      const models: string[] = (json.data ?? json.models ?? [])
        .map((m: any) => m.id ?? m.name ?? String(m))
        .filter(Boolean)
        .slice(0, 200);
      return { ok: true, message: `Connected — ${models.length} model(s) available`, models };
    }
    if (cfg.kind === 'anthropic') {
      const res = await fetch(joinUrl(cfg.baseUrl, 'messages'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({ model: cfg.model || 'claude-3-5-haiku-latest', max_tokens: 8, messages: [{ role: 'user', content: 'ping' }] }),
      });
      if (!res.ok) return { ok: false, message: describeHttpError(res.status, await res.text(), cfg.kind).message };
      return { ok: true, message: `Connected — ${cfg.model || 'claude-3-5-haiku-latest'} responded` };
    }
    if (cfg.kind === 'gemini') {
      const res = await fetch(`${joinUrl(cfg.baseUrl, 'models')}?key=${encodeURIComponent(cfg.apiKey)}&pageSize=200`);
      if (!res.ok) return { ok: false, message: describeHttpError(res.status, await res.text(), cfg.kind).message };
      const json = await res.json();
      const models: string[] = (json.models ?? [])
        .map((m: any) => String(m.name ?? '').replace(/^models\//, ''))
        .filter(Boolean);
      return { ok: true, message: `Connected — ${models.length} model(s) available`, models };
    }
    return { ok: true, message: 'On-device engine — always available, no key required.' };
  } catch (e) {
    return { ok: false, message: (e as Error).message || 'Request failed' };
  }
}

/** Build the grounded system prompt, injecting retrieved context when present. */
export function buildSystemPrompt(base: string, context: Array<{ title: string; text: string; kind: string }>): string {
  if (!context.length) return base;
  const block = context
    .map((c, i) => `[${i + 1}] (${c.kind}) ${c.title}\n${c.text}`)
    .join('\n\n');
  return `${base}

CONTEXT — retrieved passages from the user's documents and the built-in corpus. Prefer these over prior knowledge, and cite them as [n]. If they do not answer the question, say so explicitly.

${block}`;
}
