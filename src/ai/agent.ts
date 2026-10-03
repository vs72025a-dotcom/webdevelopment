/**
 * Agent planner.
 *
 * Takes a goal in natural language, decomposes it into concrete tool steps,
 * executes them in order while streaming progress, then synthesises a report
 * from the *actual* outputs. Steps are derived from the goal text, so the plan
 * is inspectable and every claim in the report traces back to a tool result.
 *
 * This runs on the on-device engine — no provider key required — and the same
 * planner drives the Chat view when the engine decides a task needs several
 * steps.
 */

import { runTool, ToolResult, TOOL_MAP } from './tools';
import { store } from './vectorStore';
import { bootstrapKnowledge } from './engine';
import { keywords, summarize } from './analysis';
import { parseConversionRequest } from './units';
import { looksLikeMath, spokenToExpression } from './expression';
import { detectLanguage, splitSentences } from './tokenizer';

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface AgentStep {
  id: string;
  index: number;
  title: string;
  rationale: string;
  tool: string;
  toolLabel: string;
  args: Record<string, string | number | boolean>;
  status: StepStatus;
  result?: ToolResult;
  ms?: number;
}

export interface AgentPlan {
  goal: string;
  steps: AgentStep[];
  report: string;
  startedAt: number;
  finishedAt: number;
  okCount: number;
  failCount: number;
}

export type AgentEvent =
  | { type: 'plan'; steps: AgentStep[] }
  | { type: 'step_start'; index: number }
  | { type: 'step_end'; index: number; step: AgentStep }
  | { type: 'report'; text: string }
  | { type: 'notice'; text: string };

const CODE_FENCE = /```(\w*)\n?([\s\S]*?)```/g;

interface Candidate {
  title: string;
  rationale: string;
  tool: string;
  args: Record<string, string | number | boolean>;
  priority: number;
}

/** Extract every concrete task the goal text implies. */
export function deriveSteps(goal: string): Candidate[] {
  bootstrapKnowledge();
  const out: Candidate[] = [];
  const text = goal.trim();

  // Embedded code blocks → analyse each one.
  let m: RegExpExecArray | null;
  CODE_FENCE.lastIndex = 0;
  let codeIdx = 0;
  while ((m = CODE_FENCE.exec(text)) !== null) {
    const [, hint, code] = m;
    if (code.trim().length < 8) continue;
    out.push({
      title: `Analyse code block ${++codeIdx}`,
      rationale: `A fenced ${hint || 'unspecified'} block was supplied; static analysis gives language, complexity and smells.`,
      tool: 'code_analyze',
      args: { code, ...(hint ? { language: hint } : {}) },
      priority: 9,
    });
  }
  const textWithoutCode = text.replace(CODE_FENCE, ' ');

  // Explicit arithmetic.
  for (const line of splitSentences(textWithoutCode)) {
    if (looksLikeMath(line) || /\b(calculate|compute|evaluate|work out|what is)\b.*[\d]/i.test(line)) {
      const expr = spokenToExpression(line);
      if (/[+\-*/^%]/.test(expr)) {
        out.push({
          title: `Evaluate "${expr.slice(0, 48)}${expr.length > 48 ? '…' : ''}"`,
          rationale: 'The goal contains arithmetic. Evaluating it exactly removes any chance of a wrong figure in the report.',
          tool: 'calculate',
          args: { expression: expr, angle_mode: /degree|deg\b/i.test(line) ? 'deg' : 'rad' },
          priority: 10,
        });
      }
    }
    const conv = parseConversionRequest(line);
    if (conv) {
      out.push({
        title: `Convert ${conv.value} ${conv.from}${conv.to ? ` → ${conv.to}` : ''}`,
        rationale: 'A unit conversion was requested; converting through the canonical base unit is exact.',
        tool: 'convert_units',
        args: { value: conv.value, from: conv.from, ...(conv.to ? { to: conv.to } : {}) },
        priority: 10,
      });
    }
  }

  // Long prose supplied with the goal → summarise and measure it.
  const prose = textWithoutCode.replace(/^\s*(?:goal|task|plan|please|now)?[:\-\s]*/i, '');
  const wordCount = prose.split(/\s+/).filter(Boolean).length;
  if (wordCount > 90) {
    out.push({
      title: 'Summarise the supplied text',
      rationale: `${wordCount} words were supplied with the goal — an MMR extractive summary keeps the report short without losing the main claims.`,
      tool: 'summarize',
      args: { text: prose, sentences: 5 },
      priority: 8,
    });
    out.push({
      title: 'Measure readability and keywords',
      rationale: 'Readability scores and keyword weights tell us who the text is written for.',
      tool: 'analyse_text',
      args: { text: prose },
      priority: 6,
    });
    if (/sentiment|tone|feedback|review|opinion/i.test(text)) {
      out.push({
        title: 'Score sentiment',
        rationale: 'The goal asks about tone or feedback, so polarity scoring with negation handling applies.',
        tool: 'sentiment',
        args: { text: prose },
        priority: 7,
      });
    }
  }

  // Explicit JSON payload.
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch && !CODE_FENCE.test(text) && jsonMatch[0].length > 12) {
    out.push({
      title: 'Validate the JSON payload',
      rationale: 'A JSON literal appears in the goal; validating it catches syntax errors before anything depends on it.',
      tool: 'json_format',
      args: { json: jsonMatch[0] },
      priority: 8,
    });
  }

  // Keyword-driven research.
  const wants = text.toLowerCase();
  if (/\b(date|time|today|deadline|schedule|when)\b/.test(wants)) {
    out.push({
      title: 'Resolve the current date and time',
      rationale: 'The goal refers to time, so anchoring to the real local clock and timezone avoids stale assumptions.',
      tool: 'datetime',
      args: { op: 'now' },
      priority: 7,
    });
  }
  if (/\b(colour|color|palette|theme|contrast|brand)\b/.test(wants)) {
    const hex = text.match(/#[0-9a-fA-F]{3,8}\b/)?.[0];
    out.push({
      title: hex ? `Analyse colour ${hex}` : 'Report the recognised unit and colour spaces',
      rationale: 'Colour work needs exact conversions plus WCAG contrast, which cannot be eyeballed reliably.',
      tool: 'convert_color',
      args: { color: hex ?? '#7c8cff' },
      priority: hex ? 8 : 3,
    });
  }
  if (/\b(hash|checksum|digest|signature|integrity)\b/.test(wants)) {
    out.push({
      title: 'Compute a SHA-256 digest',
      rationale: 'Integrity checks need a real cryptographic digest from the Web Crypto API.',
      tool: 'hash_text',
      args: { text: prose.slice(0, 2000), algorithm: 'SHA-256' },
      priority: 8,
    });
  }
  if (/\b(random|sample|draw|roll|dice|monte carlo)\b/.test(wants)) {
    const nums = [...text.matchAll(/\d+/g)].map((x) => Number(x[0]));
    out.push({
      title: 'Draw random samples',
      rationale: 'Sampling needs cryptographically-seeded randomness rather than Math.random.',
      tool: 'random_number',
      args: { min: nums.length > 1 ? Math.min(...nums) : 1, max: nums.length ? Math.max(...nums) : 100, count: Math.min(50, nums.length > 2 ? nums[2] : 10) },
      priority: 7,
    });
  }
  if (/\b(regex|regular expression|pattern match)\b/.test(wants)) {
    const pat = text.match(/\/(.+?)\/([gimsuy]*)/);
    out.push({
      title: 'Run the regular expression',
      rationale: 'A pattern was supplied; executing it shows real matches and capture groups.',
      tool: 'regex_test',
      args: { pattern: pat?.[1] ?? '\\b\\w+@\\w+\\.\\w+', text: prose.slice(0, 1000), flags: pat?.[2] ?? 'g' },
      priority: pat ? 8 : 3,
    });
  }
  if (/\b(uuid|guid|identifier|ids)\b/.test(wants)) {
    out.push({
      title: 'Generate identifiers',
      rationale: 'RFC 4122 v4 identifiers come from crypto.getRandomValues.',
      tool: 'make_uuid',
      args: { count: Math.min(10, Number(text.match(/\b(\d{1,2})\b/)?.[1] ?? 3)) },
      priority: 6,
    });
  }
  if (/\b(base|binary|hex(adecimal)?|octal)\b/.test(wants)) {
    const num = text.match(/\b(0x[0-9a-fA-F]+|0b[01]+|\d{2,})\b/)?.[1];
    if (num) {
      out.push({
        title: `Express ${num} in several bases`,
        rationale: 'Base conversion is exact and worth showing side by side.',
        tool: 'convert_base',
        args: { value: num, to_base: /binary/i.test(wants) ? 2 : /hex/i.test(wants) ? 16 : 10 },
        priority: 7,
      });
    }
  }

  // Always finish with grounded research over the indexed corpus.
  const terms = keywords(prose || text, 5).map((k) => k.term).join(' ');
  out.push({
    title: 'Retrieve grounding material',
    rationale: 'Searching the indexed corpus and your documents turns the report from opinion into something sourced.',
    tool: 'search_knowledge',
    args: { query: terms || text.slice(0, 160), k: 6, scope: 'all' },
    priority: 5,
  });

  // De-duplicate by tool+args signature, then order by priority.
  const seen = new Set<string>();
  return out
    .filter((c) => {
      const sig = `${c.tool}:${JSON.stringify(c.args).slice(0, 200)}`;
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 9);
}

/** Synthesise a report from executed steps — every section cites its source. */
export function writeReport(goal: string, steps: AgentStep[]): string {
  const done = steps.filter((s) => s.status === 'done' && s.result?.ok);
  const failed = steps.filter((s) => s.status === 'error' || (s.result && !s.result.ok));
  const skipped = steps.filter((s) => s.status === 'skipped');
  const totalMs = steps.reduce((a, s) => a + (s.ms ?? 0), 0);

  const parts: string[] = [`## Agent report — ${goal}`, ''];

  parts.push(
    `**${done.length} of ${steps.length} step(s) completed** in ${totalMs} ms` +
      (failed.length ? ` · ${failed.length} failed` : '') +
      (skipped.length ? ` · ${skipped.length} skipped` : ''),
    '',
  );

  if (!done.length) {
    parts.push('No step produced a usable result, so there is nothing to report. The failures are listed below.');
  }

  parts.push('### Findings', '');
  done.forEach((s, i) => {
    parts.push(`**${i + 1}. ${s.title}** — \`${s.tool}\``, '', s.result?.detail ?? s.result?.summary ?? '', '');
  });

  if (failed.length) {
    parts.push('### Steps that failed', '');
    failed.forEach((s) => parts.push(`- **${s.title}** (\`${s.tool}\`): ${s.result?.error ?? s.result?.summary ?? 'no result'}`));
    parts.push('');
  }
  if (skipped.length) {
    parts.push('### Skipped', '');
    skipped.forEach((s) => parts.push(`- ${s.title} — ${s.rationale}`));
    parts.push('');
  }

  // If a retrieval step ran, distil the retrieved passages into a source list.
  const research = done.find((s) => s.tool === 'search_knowledge');
  if (research?.result?.data) {
    const rows = research.result.data as Array<{ rank: number; title: string; score: number; text: string }>;
    if (rows.length) {
      parts.push('### Sources consulted', '');
      rows.slice(0, 5).forEach((r) => {
        parts.push(`- **${r.title}** — relevance ${(r.score * 100).toFixed(0)}%`);
      });
      parts.push('');
      const combined = rows.map((r) => r.text).join(' ');
      if (combined.length > 200) {
        const gist = summarize(combined, 2, goal).summary;
        if (gist) parts.push('### Synthesis', '', gist, '');
      }
    }
  }

  parts.push('---', '', `_Every figure above came from an executed tool, not from generation. Re-run any step to verify it._`);
  return parts.join('\n');
}

export async function runAgent(
  goal: string,
  emit: (e: AgentEvent) => void,
  signal: { aborted: boolean } = { aborted: false },
): Promise<AgentPlan> {
  bootstrapKnowledge();
  const startedAt = Date.now();
  const candidates = deriveSteps(goal);

  if (!candidates.length) {
    emit({ type: 'notice', text: 'The goal did not imply any executable step.' });
  }

  const steps: AgentStep[] = candidates.map((c, i) => ({
    id: `step-${i}`,
    index: i,
    title: c.title,
    rationale: c.rationale,
    tool: c.tool,
    toolLabel: TOOL_MAP.get(c.tool)?.label ?? c.tool,
    args: c.args,
    status: 'pending' as StepStatus,
  }));
  emit({ type: 'plan', steps: steps.map((s) => ({ ...s })) });

  let okCount = 0;
  let failCount = 0;

  for (const step of steps) {
    if (signal.aborted) {
      step.status = 'skipped';
      emit({ type: 'step_end', index: step.index, step: { ...step } });
      continue;
    }
    step.status = 'running';
    emit({ type: 'step_start', index: step.index });
    const t0 = performance.now();
    const result = await runTool(step.tool, step.args);
    step.ms = Math.round(performance.now() - t0);
    step.result = result;
    step.status = result.ok ? 'done' : 'error';
    if (result.ok) okCount++;
    else failCount++;
    emit({ type: 'step_end', index: step.index, step: { ...step } });
  }

  const report = writeReport(goal, steps);
  emit({ type: 'report', text: report });

  return {
    goal,
    steps,
    report,
    startedAt,
    finishedAt: Date.now(),
    okCount,
    failCount,
  };
}

/** Suggested goals shown as chips in the Agent view. */
export const AGENT_EXAMPLES: Array<{ goal: string; label: string }> = [
  {
    label: 'Audit this prose',
    goal:
      'Review this launch copy for clarity and tone: Our platform leverages cutting-edge machine learning to deliver best-in-class insights at scale. We are excited to announce that we will be transforming the way teams think about data. With our revolutionary approach, businesses can unlock unprecedented value. Join us on this journey as we redefine what is possible in the world of analytics and intelligence for modern enterprises everywhere.',
  },
  {
    label: 'Engineering numbers',
    goal:
      'Work out the deployment budget. Calculate 12% of 480 multiplied by 3, then convert 5 GB to MiB, and check how many miles 42 km is. Also give me the current date so I can timestamp the report.',
  },
  {
    label: 'Review this code',
    goal:
      'Review this code for problems:\n```js\nfunction getUser(id){\n  var cache = {}\n  if(cache[id] != null) return cache[id]\n  try { return fetch(\'/api/u/\'+id).then(r=>r.json()) } catch(e) {}\n}\n```',
  },
  {
    label: 'Research RAG quality',
    goal: 'Explain how retrieval augmented generation reduces hallucination and what chunking choices matter.',
  },
  {
    label: 'Theme + palette check',
    goal: 'Check the contrast of #7c8cff for a night-mode accent colour, and list the colour spaces it converts to.',
  },
  {
    label: 'Validate a payload',
    goal: 'Validate and describe this payload: {"users":[{"id":1,"name":"Ada","tags":["math","logic"]},{"id":2,"name":null}]}',
  },
];

export function languageOf(code: string): string {
  return detectLanguage(code);
}

export { store };
