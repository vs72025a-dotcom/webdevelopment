/**
 * A tiny typed event bus.
 *
 * The sidebar and the views live in different subtrees and each panel is
 * contextual, so a handful of cross-component intents (open this artwork, run
 * this agent goal, jump to this settings section) travel over named events
 * rather than being threaded through props.
 */

type Handler<T> = (payload: T) => void;

const targets = new Map<string, Set<Handler<unknown>>>();

export function emit<T>(event: string, payload: T): void {
  const set = targets.get(event);
  if (!set) return;
  for (const fn of set) (fn as Handler<T>)(payload);
}

export function on<T>(event: string, fn: Handler<T>): () => void {
  let set = targets.get(event);
  if (!set) {
    set = new Set();
    targets.set(event, set);
  }
  set.add(fn as Handler<unknown>);
  return () => {
    set?.delete(fn as Handler<unknown>);
  };
}

/* A one-shot prompt handed to the composer when the chat view next mounts. */
let pendingPrompt: string | null = null;

export function queuePrompt(text: string): void {
  pendingPrompt = text;
}

export function takePrompt(): string | null {
  const p = pendingPrompt;
  pendingPrompt = null;
  return p;
}

export const EVENTS = {
  artOpen: 'am:art-open',
  artDelete: 'am:art-delete',
  artChanged: 'am:art-changed',
  agentGoal: 'am:agent-goal',
  codeSample: 'am:code-sample',
  codeFile: 'am:code-file',
  settingsSection: 'am:settings-section',
  docFocus: 'am:doc-focus',
} as const;
