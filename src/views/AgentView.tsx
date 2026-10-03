import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AGENT_EXAMPLES, runAgent, type AgentEvent, type AgentPlan, type AgentStep } from '../ai/agent';
import { useStore } from '../store/appStore';
import { EVENTS, on, queuePrompt } from '../lib/bus';
import { Icon } from '../components/Icons';
import { Markdown } from '../components/Markdown';

/**
 * Agents.
 *
 * A goal is decomposed into steps by a rule-based planner, each step names the
 * tool it needs and the arguments it will pass, the tools actually execute, and
 * the report is written only from what they returned. Every step shows its own
 * output, so a wrong conclusion is traceable to a wrong input rather than
 * hidden inside a paragraph.
 */

const STEP_ICON: Record<string, string> = {
  calculate: 'calc',
  convert_units: 'ruler',
  convert_base: 'hash',
  datetime: 'clock',
  random_number: 'dice',
  convert_color: 'palette',
  analyse_text: 'list',
  summarize: 'quote',
  sentiment: 'gauge',
  code_analyze: 'braces',
  regex_test: 'asterisk',
  json_format: 'layers',
  hash_text: 'shield',
  make_uuid: 'key',
  search_knowledge: 'db',
  list_units: 'book',
};

function StepCard({ step }: { step: AgentStep }): JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <div className="step" data-status={step.status}>
      <div className="step-rail">
        <span className="step-dot">
          {step.status === 'done' ? (
            <Icon name="check" size={11} />
          ) : step.status === 'error' ? (
            <Icon name="x" size={11} />
          ) : step.status === 'running' ? (
            <Icon name="refresh" size={11} />
          ) : (
            step.index + 1
          )}
        </span>
        <span className="step-line" />
      </div>
      <div className="step-body">
        <div className="row" style={{ gap: 7, alignItems: 'baseline' }}>
          <span className="step-title">{step.title}</span>
          <span className="badge" data-tone={step.status === 'done' ? 'ok' : step.status === 'error' ? 'err' : 'info'}>
            {step.status}
          </span>
          <span className="mono row" style={{ fontSize: 10, color: 'var(--text-faint)', marginLeft: 'auto', gap: 4 }}>
            <Icon name={STEP_ICON[step.tool] ?? 'zap'} size={11} />
            {step.toolLabel}
            {step.ms !== undefined ? ` · ${step.ms}ms` : ''}
          </span>
        </div>
        <div className="step-why">{step.rationale}</div>

        {step.status === 'done' || step.status === 'error' ? (
          <div className="step-out">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpen((v) => !v)}
              style={{ paddingLeft: 0 }}
            >
              <Icon name="chevR" size={11} className="chev" style={{ transform: open ? 'rotate(90deg)' : 'none' }} />
              {step.result?.ok ? step.result.summary : `failed — ${step.result?.error ?? 'no output'}`}
            </button>
            {open && step.result ? (
              <div className="toolcard" style={{ marginTop: 5 }}>
                <div className="toolcard-body" style={{ borderTop: 0 }}>
                  <div className="toolcard-args">
                    {step.tool}({Object.entries(step.args).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')})
                  </div>
                  {step.result.detail ? <Markdown source={step.result.detail} /> : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AgentView(): JSX.Element {
  const store = useStore();
  const [goal, setGoal] = useState('');
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [report, setReport] = useState('');
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<AgentPlan[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const signal = useRef<{ aborted: boolean }>({ aborted: false });

  useEffect(
    () =>
      on<{ goal: string; label: string }>(EVENTS.agentGoal, (ex) => {
        setGoal(ex.goal);
        setPlan(null);
        setSteps([]);
        setReport('');
      }),
    [],
  );

  useEffect(() => {
    if (!running) return;
    const t0 = Date.now();
    const t = window.setInterval(() => setElapsed(Date.now() - t0), 100);
    return () => window.clearInterval(t);
  }, [running]);

  const run = useCallback(async () => {
    const g = goal.trim();
    if (!g || running) return;
    signal.current = { aborted: false };
    setRunning(true);
    setNotice(null);
    setReport('');
    setPlan(null);
    setSteps([]);
    setElapsed(0);

    const finished = await runAgent(
      g,
      (ev: AgentEvent) => {
        switch (ev.type) {
          case 'plan':
            setSteps([...ev.steps]);
            break;
          case 'step_start':
            setSteps((s) => s.map((x, i) => (i === ev.index ? { ...x, status: 'running' } : x)));
            break;
          case 'step_end':
            setSteps((s) => s.map((x, i) => (i === ev.index ? { ...ev.step } : x)));
            break;
          case 'report':
            setReport(ev.text);
            break;
          case 'notice':
            setNotice(ev.text);
            break;
        }
      },
      signal.current,
    );

    setPlan(finished);
    setSteps(finished.steps);
    setReport(finished.report);
    setHistory((h) => [finished, ...h].slice(0, 8));
    setRunning(false);
    setElapsed(finished.finishedAt - finished.startedAt);
  }, [goal, running]);

  const stop = useCallback(() => {
    signal.current.aborted = true;
    setRunning(false);
  }, []);

  const stats = useMemo(() => {
    if (!plan) return null;
    const secs = (plan.finishedAt - plan.startedAt) / 1000;
    return {
      steps: plan.steps.length,
      ok: plan.okCount,
      fail: plan.failCount,
      secs,
      words: plan.report.split(/\s+/).filter(Boolean).length,
    };
  }, [plan]);

  const download = () => {
    if (!plan) return;
    const body = `# Agent report\n\n**Goal:** ${plan.goal}\n\n${plan.report}\n\n---\n\n## Steps\n\n${plan.steps
      .map(
        (s, i) =>
          `${i + 1}. **${s.title}** — \`${s.tool}\` (${s.status})\n   ${s.rationale}\n${
            s.result?.detail ? `\n${s.result.detail}\n` : ''
          }`,
      )
      .join('\n')}`;
    const blob = new Blob([body], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-report-${Date.now()}.md`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="view">
      <div className="view-head">
        <div>
          <div className="view-title">Agents</div>
          <div className="view-sub">Goal → plan → tool execution → evidenced report</div>
        </div>
        <span style={{ flex: 1 }} />
        {running ? (
          <span className="badge" data-tone="accent">
            <span className="status-dot" /> {(elapsed / 1000).toFixed(1)}s
          </span>
        ) : null}
        {plan ? (
          <>
            <button type="button" className="btn btn-sm" onClick={download}>
              <Icon name="download" size={13} /> Report
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                queuePrompt(`Here is an agent report I just produced. Critique it, then extend the analysis:\n\n${plan.report}`);
                store.newConversation('Agent report review');
              }}
            >
              <Icon name="chat" size={13} /> Discuss in chat
            </button>
          </>
        ) : null}
      </div>

      <div className="scroll">
        <div className="wrap">
          <div className="card card-pad" style={{ marginBottom: 14 }}>
            <label className="card-title" htmlFor="agent-goal" style={{ display: 'block', marginBottom: 8 }}>
              Goal
            </label>
            <textarea
              id="agent-goal"
              className="textarea"
              rows={3}
              placeholder="Describe an outcome, e.g. “Work out the deployment budget: 12% of 480 × 3, convert 5 GB to MiB, and timestamp the report.”"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void run();
                }
              }}
            />
            <div className="row" style={{ marginTop: 9, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void run()} disabled={running || !goal.trim()}>
                <Icon name="play" size={14} /> {running ? 'Running…' : 'Run agent'}
              </button>
              {running ? (
                <button type="button" className="btn btn-sm btn-danger" onClick={stop}>
                  <Icon name="stop" size={13} /> Abort
                </button>
              ) : null}
              <span className="mono" style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>
                <kbd>⌘</kbd>+<kbd>Enter</kbd> to run · every tool executes locally
              </span>
            </div>

            <div className="suggest" style={{ marginTop: 10, marginInline: 0 }}>
              {AGENT_EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  className="chip"
                  onClick={() => {
                    setGoal(ex.goal);
                    setPlan(null);
                    setSteps([]);
                    setReport('');
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {notice ? (
            <div className="callout" data-tone="warn">
              <Icon name="info" size={15} className="ico" />
              <div>
                <strong style={{ fontSize: 12.5 }}>{notice}</strong>
                <div style={{ fontSize: 11.5, opacity: 0.85 }}>
                  The planner derives steps from concrete cues in the goal — numbers, units, code, dates, text to
                  analyse. Try one of the examples above.
                </div>
              </div>
            </div>
          ) : null}

          {stats ? (
            <div className="grid grid-4" style={{ margin: '14px 0' }}>
              <div className="kpi">
                <div className="kpi-value">{stats.steps}</div>
                <div className="kpi-label">steps planned</div>
              </div>
              <div className="kpi">
                <div className="kpi-value" style={{ color: 'var(--ok)' }}>
                  {stats.ok}
                </div>
                <div className="kpi-label">succeeded</div>
              </div>
              <div className="kpi">
                <div className="kpi-value" style={{ color: stats.fail ? 'var(--err)' : undefined }}>
                  {stats.fail}
                </div>
                <div className="kpi-label">failed</div>
              </div>
              <div className="kpi">
                <div className="kpi-value">{stats.secs.toFixed(2)}s</div>
                <div className="kpi-label">
                  {stats.words} word report
                </div>
              </div>
            </div>
          ) : null}

          {steps.length > 0 ? (
            <div className="card" style={{ marginBottom: 14 }}>
              <div className="card-head">
                <Icon name="target" size={15} className="ico" />
                <span className="card-title">Plan</span>
                <span className="badge" data-tone="info">{steps.length} steps</span>
              </div>
              <div className="card-pad">
                {steps.map((s) => (
                  <StepCard key={s.id} step={s} />
                ))}
              </div>
            </div>
          ) : null}

          {report ? (
            <div className="card">
              <div className="card-head">
                <Icon name="doc" size={15} className="ico" />
                <span className="card-title">Report</span>
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void navigator.clipboard?.writeText(report).catch(() => undefined)}
                >
                  <Icon name="copy" size={13} /> Copy
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void store.addNote(`Agent report — ${goal.slice(0, 40)}`, report).then(() => store.toast('ok', 'Report indexed', 'It is now retrievable and citable in chat.'))}
                >
                  <Icon name="db" size={13} /> Index
                </button>
              </div>
              <div className="card-pad">
                <Markdown source={report} />
              </div>
            </div>
          ) : null}

          {!steps.length && !report && !running ? (
            <div className="empty" style={{ padding: '34px 16px' }}>
              <Icon name="bot" className="ico" />
              <strong>No run yet</strong>
              <p>
                Write a goal with something concrete in it — a calculation, a unit, a file, a passage to review — and
                the planner will build and execute a step list.
              </p>
            </div>
          ) : null}

          {history.length > 0 ? (
            <div className="card" style={{ marginTop: 14 }}>
              <div className="card-head">
                <Icon name="history" size={15} className="ico" />
                <span className="card-title">This session</span>
                <span className="badge">{history.length}</span>
              </div>
              <div className="card-pad">
                {history.map((h) => (
                  <button
                    key={h.startedAt}
                    type="button"
                    className="conv-row"
                    onClick={() => {
                      setPlan(h);
                      setSteps(h.steps);
                      setReport(h.report);
                      setGoal(h.goal);
                    }}
                  >
                    <span className="toolcard-icon" style={{ marginTop: 1 }}>
                      <Icon name="bot" size={12} />
                    </span>
                    <span className="conv-main">
                      <span className="conv-title">{h.goal.slice(0, 74)}</span>
                      <span className="conv-meta">
                        {h.steps.length} steps · {h.okCount} ok · {h.failCount} failed ·{' '}
                        {((h.finishedAt - h.startedAt) / 1000).toFixed(1)}s ·{' '}
                        {new Date(h.startedAt).toLocaleTimeString()}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
