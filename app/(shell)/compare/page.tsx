'use client';
// app/(shell)/compare/page.tsx — Phase 8: live three-column Compare + benchmark results.
// Every column is scored by the same independent scorer (deterministic gate engine via /api/gates).
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Scale, Clock, Cpu, Play, AlertTriangle } from 'lucide-react';
import { Finding, LlmCallLog, Rule, Verdict } from '@/src/types';
import { COMPARE_SCENARIOS } from '@/src/compare/scenarios';
import { CompareMetrics, compareMetrics, runCost } from '@/src/compare/metrics';
import { useApp } from '@/src/ui/context/AppContext';

type ColumnKey = 'bare' | 'policies' | 'governed';

interface ColumnView {
  key: ColumnKey;
  label: string;
  source: 'live';
  status: 'idle' | 'running' | 'done' | 'error';
  post?: { caption: string; hashtags: string[]; altText?: string };
  metrics?: CompareMetrics;
  findings: Finding[];
  pipelineVerdict?: Verdict;
  llmCalls: LlmCallLog[];
  wallMs: number | null;
  note: string;
  error?: string;
  needsAccess?: boolean;
}

const COLUMN_META: Record<ColumnKey, { label: string; note: string }> = {
  bare: { label: 'A · Bare AI', note: 'Gemini with only “You write Instagram posts for Thrift-It, an Indian pre-loved clothing store.”' },
  policies: { label: 'B · AI + policies', note: 'Same model, all eight policy documents pasted into the prompt, single pass, no verification.' },
  governed: { label: 'C · Governed', note: 'Grounded generation, deterministic gates, two independent reviewers, citation verifier, consensus, scoring; regenerates once on findings.' },
};

const idle = (key: ColumnKey): ColumnView => ({ key, ...COLUMN_META[key], source: 'live', status: 'idle', findings: [], llmCalls: [], wallMs: null });

const verdictClass = (v?: string) =>
  v === 'BLOCKED' ? 'text-red-600 dark:text-red-400' : v === 'REVISE' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400';

export default function ComparePage() {
  const { speedMode, setIsAccessModalOpen } = useApp();
  const [scenarioId, setScenarioId] = useState(COMPARE_SCENARIOS[0].id);
  const [rules, setRules] = useState<Pick<Rule, 'id' | 'type'>[] | null>(null);
  const [columns, setColumns] = useState<ColumnView[]>(() => (['bare', 'policies', 'governed'] as ColumnKey[]).map(idle));
  const scenario = COMPARE_SCENARIOS.find((s) => s.id === scenarioId)!;

  useEffect(() => {
    fetch('/api/pack').then((r) => r.json()).then((p) => setRules(p.rules)).catch(() => setRules(null));
  }, []);

  const runLive = async () => {
    if (!rules) return;
    setColumns((cols) => cols.map((c) => ({ ...idle(c.key), status: 'running' })));
    const call = async (key: ColumnKey): Promise<ColumnView> => {
      const started = performance.now();
      const url = key === 'governed' ? '/api/compare/governed' : '/api/llm/baseline';
      const body = key === 'governed' ? { scenarioId, mode: speedMode } : { variant: key, scenarioId };
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        const wallMs = Math.round(performance.now() - started);
        if (!res.ok) return { ...idle(key), status: 'error', error: data.error ?? `HTTP ${res.status}`, needsAccess: res.status === 401, llmCalls: data.log ? [data.log] : [], wallMs };
        // The same independent scorer for every column:
        const gateRes = await fetch('/api/gates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post: data.post }) });
        if (!gateRes.ok) throw new Error(`Scoring failed (HTTP ${gateRes.status})`);
        const gate = await gateRes.json();
        return {
          ...idle(key), status: 'done', post: data.post, metrics: compareMetrics(gate, rules), findings: gate.findings,
          pipelineVerdict: data.verdict, llmCalls: data.llmCalls ?? [], wallMs,
          note: key === 'governed' ? `${COLUMN_META.governed.note} Ran ${data.iterations?.length ?? 1} iteration(s).` : COLUMN_META[key].note,
        };
      } catch (e: unknown) {
        return { ...idle(key), status: 'error', error: e instanceof Error ? e.message : String(e), wallMs: Math.round(performance.now() - started) };
      }
    };
    const keys: ColumnKey[] = ['bare', 'policies', 'governed'];
    await Promise.all(keys.map(async (k) => {
      const col = await call(k);
      setColumns((cols) => cols.map((c) => (c.key === k ? col : c)));
    }));
  };

  const anyError = columns.some((c) => c.status === 'error');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Scale className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
          Compare: Bare AI vs AI + policies vs Governed
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
          One brief, three systems. Every output is scored by the same independent scorer — the deterministic gate engine — so the numbers are comparable.
          Column C additionally shows its own pipeline verdict, which includes verified LLM findings.
        </p>
      </div>

      <section data-tour="compare-scenarios" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Scenario</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {COMPARE_SCENARIOS.map((s) => (
            <button key={s.id} onClick={() => { setScenarioId(s.id); setColumns((cols) => cols.map((c) => idle(c.key))); }} aria-pressed={scenarioId === s.id}
              className={`text-left p-3 rounded-lg border text-xs transition ${scenarioId === s.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>
              <div className="font-semibold text-slate-800 dark:text-slate-100">{s.label}</div>
              <div className="text-slate-600 dark:text-slate-400 mt-0.5">{s.tempts}</div>
            </button>
          ))}
        </div>
        <div className="text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <strong>Brief sent to all three:</strong> {scenario.brief}
        </div>
        <button onClick={runLive} disabled={!rules || columns.some((c) => c.status === 'running')}
          className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
          <Play className="w-4 h-4" />{columns.some((c) => c.status === 'running') ? 'Running three systems live…' : 'Run live comparison (uses real model calls)'}
        </button>
        {anyError && (
          <div role="alert" className="text-xs p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 flex flex-wrap items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            One or more systems encountered an error during live execution (missing keys, provider timeout, or provider failure).
            {columns.some((c) => c.needsAccess) && <button onClick={() => setIsAccessModalOpen(true)} className="underline font-semibold ml-1">Enter access code</button>}
          </div>
        )}
      </section>

      <div className="grid md:grid-cols-3 gap-4">
        {columns.map((c) => <Column key={c.key} col={c} />)}
      </div>

      <TradeOffs columns={columns} />
      <BenchmarkSection />
    </div>
  );
}

function Column({ col }: { col: ColumnView }) {
  const cost = runCost(col.llmCalls, col.wallMs);
  const m = col.metrics;
  return (
    <div className={`bg-white dark:bg-slate-900 border rounded-xl p-4 space-y-3 ${col.key === 'governed' ? 'border-indigo-300 dark:border-indigo-700' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="font-bold text-slate-900 dark:text-white">{col.label}</div>
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">Live call</span>
      </div>
      <p className="text-[11px] text-slate-600 dark:text-slate-400">{col.note}</p>
      {col.status === 'idle' && <p className="text-xs text-slate-600 dark:text-slate-400">Not run yet. Click &quot;Run live comparison&quot; above.</p>}
      {col.status === 'running' && <p className="text-xs text-indigo-600 animate-pulse dark:text-indigo-300">Running live call…</p>}
      {col.status === 'error' && (
        <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 space-y-1">
          <div className="font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Call Failed</div>
          <div>{col.error}</div>
        </div>
      )}
      {m && (
        <>
          <div className="flex items-end gap-3">
            <div className={`text-3xl font-black tabular-nums ${verdictClass(m.verdict)}`}>{m.score}</div>
            <div className="text-xs"><div className="text-slate-600 dark:text-slate-400">independent score / 100</div><div className={`font-bold ${verdictClass(m.verdict)}`}>{m.verdict}</div></div>
          </div>
          <dl className="grid grid-cols-2 gap-1 text-xs">
            {([
              ['Gate failures', m.gateFailures], ['Stale/wrong facts', m.staleOrWrongFacts], ['Banned terms', m.bannedTerms],
              ['Unsupported claims', m.unsupportedClaims], ['Accessibility gaps', m.accessibilityGaps],
              ['Crit / maj / min', `${m.bySeverity.critical} / ${m.bySeverity.major} / ${m.bySeverity.minor}`],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex justify-between bg-slate-50 dark:bg-slate-800 rounded px-2 py-1"><dt className="text-slate-600 dark:text-slate-400">{k}</dt><dd className="font-semibold">{v}</dd></div>
            ))}
          </dl>
          <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{cost.wallMs === null ? 'time not recorded' : `${(cost.wallMs / 1000).toFixed(1)} s wall`}</span>
            <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5" />{cost.llmCallCount} LLM call(s)</span>
            <span>{cost.llmCallCount === 0 ? 'no tokens (no model calls)' : cost.tokensIn === null ? 'tokens not reported by provider' : `${cost.tokensIn} in / ${cost.tokensOut} out tokens${cost.tokensIncomplete ? ' (partial: some calls reported none)' : ''}`}</span>
          </div>
          {col.pipelineVerdict && (
            <div className="text-xs p-2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200">
              Governed pipeline verdict: <strong>{col.pipelineVerdict.status}</strong> ({col.pipelineVerdict.score}). Publishing still needs a human approval in Workflow.
            </div>
          )}
          {col.post && (
            <details className="text-xs">
              <summary className="cursor-pointer text-indigo-600 dark:text-indigo-400">Output and {col.findings.length} scorer finding(s)</summary>
              <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-200">{col.post.caption}</p>
              <p className="text-slate-600 dark:text-slate-400">Alt text: {col.post.altText || <em>missing</em>}</p>
              <ul className="mt-1 space-y-1">
                {col.findings.map((f, i) => (
                  <li key={i}><strong>{f.severity}</strong> <Link href={`/company#${f.clauseId}`} className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline">[{f.clauseId}]</Link> “{f.postQuote}” — {f.explanation}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function TradeOffs({ columns }: { columns: ColumnView[] | null }) {
  const done = (columns ?? []).filter((c) => c.status === 'done');
  const base = done.find((c) => c.key === 'policies');
  const gov = done.find((c) => c.key === 'governed');
  const measured = base && gov && base.wallMs !== null && gov.wallMs !== null;
  return (
    <section className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-1">
      <div className="font-semibold text-slate-700 dark:text-slate-200">Speed, cost and governance trade-offs</div>
      {measured ? (
        <div>
          This run: governed took {(gov!.wallMs! / 1000).toFixed(1)} s and {gov!.llmCalls.length} LLM calls; AI + policies took {(base!.wallMs! / 1000).toFixed(1)} s and {base!.llmCalls.length} call.
          The governed column is slower and costlier by design.
        </div>
      ) : (
        <div>No timing was recorded for the outputs shown, so speed and cost cannot be compared here. Run live to measure them.</div>
      )}
      <div>• Governance costs extra model calls (two reviewers, a regeneration when findings remain) and wall time; in return every cited clause is verified, facts are checked against the registry and nothing publishes without a human.</div>
      <div>• The independent score uses the deterministic gate engine only. It does not see tone or messaging issues that only LLM reviewers catch, and it has known misses (e.g. “starting at just ₹299” evades the price pattern; there is no gate for unapproved festival greetings).</div>
      <div>• Live outputs vary run to run; one scenario is an anecdote, the benchmark below is the measurement.</div>
    </section>
  );
}

type SplitMetrics = { tp: number; fp: number; fn: number; precision: number | null; recall: number | null; falsePositiveRateOnClean: number | null; citationValidity: number | null; hallucinatedCitations: number; caughtOnlyByGates: number; perCategory: Record<string, { precision: number | null; recall: number | null; tp: number; fp: number; fn: number }> };
const pct = (x: number | null | undefined) => (x === null || x === undefined ? 'n/a' : `${Math.round(x * 100)}%`);

function BenchmarkSection() {
  const [benchmarkData, setBenchmarkData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/benchmark')
      .then((r) => r.json())
      .then((res) => {
        if (res.available && res.data) {
          setBenchmarkData(res.data);
        } else {
          setBenchmarkData(null);
        }
      })
      .catch(() => setBenchmarkData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <h2 className="font-bold text-slate-800 dark:text-white">Benchmark</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">Checking for benchmark results…</p>
      </section>
    );
  }

  if (!benchmarkData) {
    return (
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-bold text-slate-800 dark:text-white">Benchmark</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            Evaluates the governed system against a baseline across 60 labelled posts.
          </p>
        </div>
        <div className="p-8 text-center text-xs text-slate-600 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-1">
          <div className="font-semibold text-slate-700 dark:text-slate-300">No benchmark run yet</div>
          <div>Run <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-600 dark:text-indigo-400">npm run benchmark</code> with provider keys configured to produce real live metrics.</div>
        </div>
      </section>
    );
  }

  const meta = benchmarkData.meta;
  const gov = benchmarkData.systems.governed.metrics as unknown as Record<string, SplitMetrics>;
  const baseRun = benchmarkData.systems.baseline.status === 'ran';
  const base = baseRun ? ((benchmarkData.systems.baseline as unknown as { metrics: Record<string, SplitMetrics> }).metrics) : null;
  const split = gov.test ? 'test' : 'all';
  const cats = Object.keys(gov[split].perCategory).sort();
  const chart = cats.map((c) => ({ category: c, governed: gov[split].perCategory[c].recall === null ? 0 : Math.round(gov[split].perCategory[c].recall! * 100), ...(base ? { baseline: base[split].perCategory[c]?.recall == null ? 0 : Math.round(base[split].perCategory[c].recall! * 100) } : {}) }));
  const systems: [string, SplitMetrics | null][] = [['Governed', gov[split]], ['Baseline (single model + policies)', base ? base[split] : null]];

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
      <div>
        <h2 className="font-bold text-slate-800 dark:text-white">Benchmark Results</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Computed on {meta.computedAt.slice(0, 10)} from <code>scripts/benchmark.ts</code> (commit {meta.gitCommit}); run it yourself with <code>npm run benchmark</code>.
          Execution: <strong>{meta.execution.replace('_', ' ')}</strong>. Labels human-reviewed: <strong>{meta.labelsHumanReviewed}</strong>. Showing the held-out {split} split.
        </p>
        <ul className="mt-1 text-xs text-amber-700 dark:text-amber-300 list-disc pl-4">{meta.caveats.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {systems.map(([name, m]) => (
          <div key={name} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <div className="font-semibold mb-1">{name}</div>
            {m ? (
              <div className="grid grid-cols-2 gap-1">
                <span>Precision {pct(m.precision)}</span><span>Recall {pct(m.recall)}</span>
                <span>FP rate on clean {pct(m.falsePositiveRateOnClean)}</span><span>Citation validity {pct(m.citationValidity)}</span>
                <span>Hallucinated citations {m.hallucinatedCitations}</span><span>Caught only by gates {m.caughtOnlyByGates}</span>
                <span>TP / FP / FN</span><span>{m.tp} / {m.fp} / {m.fn}</span>
              </div>
            ) : <p className="text-slate-600 dark:text-slate-400">Not run — {(benchmarkData.systems.baseline as { reason?: string }).reason}. No numbers are shown rather than invented ones.</p>}
          </div>
        ))}
      </div>
      <div>
        <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Recall by category ({split} split, %)</h3>
        <div role="img" aria-label={`Recall by category in percent: ${chart.map((c) => `${c.category} governed ${c.governed}%${'baseline' in c ? `, baseline ${c.baseline}%` : ''}`).join('; ')}`}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chart} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
            <XAxis dataKey="category" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="governed" name="Governed" fill="#6366f1" />
            {base && <Bar dataKey="baseline" name="Baseline" fill="#f59e0b" />}
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Example viewer “baseline missed, governed caught” needs a baseline run; {baseRun ? 'see data/benchmark/results.json perPost.' : 'it will appear after `npm run benchmark` runs with GEMINI_API_KEY set.'}
        {' '}Limitations: synthetic posts, small N (30 per split), labels written by the system’s author and not human-reviewed.
      </p>
    </section>
  );
}
