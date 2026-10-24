'use client';
// app/(shell)/insights/page.tsx — Phase 7 Insights.
// Every figure is computed by src/insights/aggregate.ts from stored events:
// the labelled seeded sample history plus live events recorded in this browser.
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3, ShieldAlert, Lightbulb, ExternalLink, Users } from 'lucide-react';
import { Category, Clause, Rule } from '@/src/types';
import { InsightEvent } from '@/src/insights/types';
import { loadAllEvents } from '@/src/insights/store';
import {
  ambiguityRanking, averageIterationsToReady, eventCounts, hallucinationsBlocked, humanDecisionsByRole,
  ruleCoverage, scoreDistribution, topViolatedClauses, violationsByCategoryOverTime, AmbiguityRow,
} from '@/src/insights/aggregate';
import { templateClarification } from '@/src/llm/prompts/clarify';

const CATEGORY_COLORS: Record<Category, string> = {
  tone: '#6366f1', terminology: '#0ea5e9', messaging: '#14b8a6', factual_accuracy: '#f59e0b', claims: '#ef4444',
  visual: '#a855f7', accessibility: '#22c55e', disclosure: '#ec4899', regional: '#84cc16', security: '#64748b',
};

type Scope = 'all' | 'sample' | 'live';
type Suggestion = { text: string; source: 'model' | 'template'; model?: string; error?: string };

const Card = ({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) => (
  <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
    <h2 className="font-bold text-slate-800 dark:text-white">{title}</h2>
    {note && <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{note}</p>}
    <div className={note ? '' : 'mt-3'}>{children}</div>
  </section>
);

const Empty = ({ what }: { what: string }) => <p className="text-sm text-slate-600 py-6 text-center dark:text-slate-400">No {what} in the selected data yet.</p>;

export default function InsightsPage() {
  const [allEvents, setAllEvents] = useState<InsightEvent[] | null>(null);
  const [pack, setPack] = useState<{ clauses: Clause[]; rules: Rule[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion | 'loading'>>({});

  useEffect(() => {
    loadAllEvents().then(setAllEvents).catch((e) => setError(`Could not load insight events: ${e.message}`));
    fetch('/api/pack')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setPack)
      .catch((e) => setError(`Could not load the policy pack: ${e.message}`));
  }, []);

  const events = useMemo(
    () => (allEvents ?? []).filter((e) => (scope === 'all' ? true : scope === 'sample' ? e.sample : !e.sample)),
    [allEvents, scope]
  );
  const counts = useMemo(() => eventCounts(allEvents ?? []), [allEvents]);
  const clauseText = useMemo(() => new Map((pack?.clauses ?? []).map((c) => [c.id, c])), [pack]);

  const byWeek = useMemo(() => violationsByCategoryOverTime(events).map((r) => ({ week: r.week, ...r.counts })), [events]);
  const categoriesPresent = useMemo(() => Array.from(new Set(byWeek.flatMap((r) => Object.keys(r).filter((k) => k !== 'week')))) as Category[], [byWeek]);
  const top = useMemo(() => topViolatedClauses(events, 8), [events]);
  const dist = useMemo(() => scoreDistribution(events), [events]);
  const iters = useMemo(() => averageIterationsToReady(events), [events]);
  const ambiguity = useMemo(() => (pack ? ambiguityRanking(events, pack.clauses.map((c) => c.id)) : []), [events, pack]);
  const coverage = useMemo(() => (pack ? ruleCoverage(pack) : []), [pack]);
  const halluc = useMemo(() => hallucinationsBlocked(events), [events]);
  const byRole = useMemo(() => humanDecisionsByRole(events), [events]);
  const coverageByDoc = useMemo(() => {
    const m = new Map<string, { doc: string; deterministic: number; llmOnly: number }>();
    for (const r of coverage) {
      const prefix = r.clauseId.slice(0, 2);
      const row = m.get(prefix) ?? { doc: prefix, deterministic: 0, llmOnly: 0 };
      if (r.coverage === 'deterministic') row.deterministic++;
      else row.llmOnly++;
      m.set(prefix, row);
    }
    return Array.from(m.values());
  }, [coverage]);

  const draftClarification = async (row: AmbiguityRow) => {
    const clause = clauseText.get(row.clauseId);
    if (!clause) return;
    const evidence = row.evidence.map((e) => e.text);
    setSuggestions((s) => ({ ...s, [row.clauseId]: 'loading' }));
    try {
      const res = await fetch('/api/llm/clarify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clauseId: row.clauseId, evidence }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSuggestions((s) => ({ ...s, [row.clauseId]: { text: data.suggestion, source: 'model', model: data.model } }));
    } catch (e: unknown) {
      setSuggestions((s) => ({
        ...s,
        [row.clauseId]: { text: templateClarification(clause, evidence), source: 'template', error: e instanceof Error ? e.message : String(e) },
      }));
    }
  };

  if (error && !allEvents) return <div role="alert" className="p-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm">{error}</div>;
  if (!allEvents) return <div className="text-sm text-slate-600 py-8 text-center dark:text-slate-400">Loading insight events…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
            Insights &amp; Ambiguity Index
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Recurring mistakes and unclear clauses, computed from stored checks, reviewer disagreements and human overrides/rejections. Aggregated by role only — never by individual.
          </p>
        </div>
        <div className="shrink-0 space-y-2">
          <div className="text-[11px] px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">
            <strong>{counts.sample}</strong> seeded events are <strong>sample data</strong> (synthetic, generated by <code>scripts/make-seed.ts</code>).<br />
            <strong>{counts.live}</strong> live events recorded in this browser.
          </div>
          <div role="radiogroup" aria-label="Data scope" className="flex gap-1 text-xs">
            {(['all', 'sample', 'live'] as Scope[]).map((s) => (
              <button key={s} role="radio" aria-checked={scope === s} onClick={() => setScope(s)}
                className={`px-3 py-1 rounded-md border ${scope === s ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {s === 'all' ? 'All' : s === 'sample' ? 'Sample only' : 'Live only'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Checks', String(eventCounts(events).checks)],
          ['Human overrides + rejections', String(eventCounts(events).human)],
          ['Hallucinations blocked', String(halluc.total)],
          ['Avg iterations to READY', iters.average === null ? 'no data' : `${iters.average.toFixed(2)} (n=${iters.runs})`],
        ].map(([label, value]) => (
          <div key={label} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="text-2xl font-black text-slate-900 dark:text-white">{value}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <Card title="Violations by category over time" note="Findings per ISO week (Monday start), all severities.">
        {byWeek.length === 0 ? <Empty what="checks" /> : (
          <div role="img" aria-label={`Stacked bar chart of findings per week by category: ${byWeek.map((r) => `${r.week}: ${Object.entries(r).filter(([k]) => k !== 'week').map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`).join('; ')}`}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byWeek} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              {categoriesPresent.map((c) => <Bar key={c} dataKey={c} stackId="a" fill={CATEGORY_COLORS[c]} name={c} />)}
            </BarChart>
          </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Most frequently violated clauses">
          {top.length === 0 ? <Empty what="findings" /> : (
            <ol className="space-y-1 text-sm">
              {top.map((t) => (
                <li key={t.clauseId} className="flex items-center gap-2">
                  <Link href={`/company#${t.clauseId}`} className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline w-16">{t.clauseId}</Link>
                  <div className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded bg-indigo-500" style={{ width: `${(t.count / top[0].count) * 100}%` }} /></div>
                  <span className="tabular-nums w-8 text-right">{t.count}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card title="Score distribution: first pass vs after fix" note="Number of checks per score bucket.">
          <div role="img" aria-label={`Bar chart of checks per score bucket: ${dist.map((d) => `${d.bucket} first pass ${d.firstPass}, after fix ${d.afterFix}`).join('; ')}`}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dist} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="firstPass" name="First pass" fill="#f59e0b" />
              <Bar dataKey="afterFix" name="After fix" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card
        title="Ambiguity Index per clause"
        note="(disputed findings + human overrides + human rejections citing the clause) ÷ checks that evaluated the clause. Clauses never checked have no index (shown as —), not 0."
      >
        {!pack ? <Empty what="policy data" /> : ambiguity.length === 0 ? <Empty what="disputes, overrides or rejections" /> : (
          <div className="space-y-2">
            {ambiguity.slice(0, 8).map((row, i) => {
              const sug = suggestions[row.clauseId];
              return (
                <div key={row.clauseId} className="border border-slate-200 dark:border-slate-700 rounded-lg">
                  <button className="w-full flex items-center justify-between gap-3 p-3 text-left" onClick={() => setExpanded(expanded === row.clauseId ? null : row.clauseId)} aria-expanded={expanded === row.clauseId}>
                    <div className="min-w-0">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 mr-2">{row.clauseId}</span>
                      <span className="text-sm text-slate-700 dark:text-slate-200">{clauseText.get(row.clauseId)?.text.slice(0, 90)}…</span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-black tabular-nums text-slate-900 dark:text-white">{row.index === null ? '—' : row.index.toFixed(2)}</div>
                      <div className="text-[10px] text-slate-600 dark:text-slate-400">({row.disputed}+{row.overrides}+{row.rejections})/{row.totalChecks}</div>
                    </div>
                  </button>
                  {expanded === row.clauseId && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-3 text-sm">
                      <div>
                        <div className="text-xs font-semibold text-slate-600 mb-1 dark:text-slate-400">Evidence ({row.evidence.length})</div>
                        <ul className="text-xs space-y-0.5 max-h-40 overflow-y-auto">
                          {row.evidence.slice(0, 12).map((e, j) => (
                            <li key={j}><span className="text-slate-600 dark:text-slate-400">{e.kind.replace('_', ' ')}{e.sample ? ' · sample' : ' · live'}:</span> {e.text}</li>
                          ))}
                        </ul>
                      </div>
                      {i < 3 && (
                        <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-3 space-y-2">
                          <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" />Suggested clarification — a suggestion only, not an approved policy change</div>
                          {!sug && <button onClick={() => draftClarification(row)} className="text-xs px-3 py-1 rounded bg-indigo-600 text-white">Draft clarification (Gemini)</button>}
                          {sug === 'loading' && <p className="text-xs text-slate-600 dark:text-slate-400">Drafting…</p>}
                          {sug && sug !== 'loading' && (
                            <>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                {sug.source === 'model' ? `AI-generated by ${sug.model} — review before applying.` : `Template suggestion (no model call; generated from the evidence). Live drafting failed: ${sug.error}`}
                              </p>
                              <p className="text-slate-800 dark:text-slate-100">{sug.text}</p>
                            </>
                          )}
                        </div>
                      )}
                      <Link href={`/company#${row.clauseId}`} className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                        Open {row.clauseId} in the Company knowledge base <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Rule coverage by clause" note={`${coverage.filter((c) => c.coverage === 'deterministic').length} of ${coverage.length} clauses have at least one deterministic rule; the rest rely on LLM review only. Computed from rules.json.`}>
          <div role="img" aria-label={`Bar chart of clauses with deterministic rules versus LLM-only coverage per document: ${coverageByDoc.map((d) => `${d.doc} ${d.deterministic} deterministic, ${d.llmOnly} LLM-only`).join('; ')}`}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={coverageByDoc} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis dataKey="doc" type="category" tick={{ fontSize: 11 }} width={36} interval={0} />
              <Tooltip />
              <Legend />
              <Bar dataKey="deterministic" name="Deterministic rule" fill="#6366f1" stackId="a" />
              <Bar dataKey="llmOnly" name="LLM-only" fill="#f59e0b" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
          </div>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-indigo-600 dark:text-indigo-400">Per-clause list</summary>
            <ul className="mt-1 grid grid-cols-2 gap-x-3 max-h-48 overflow-y-auto">
              {coverage.map((c) => (
                <li key={c.clauseId}><Link href={`/company#${c.clauseId}`} className="font-mono hover:underline">{c.clauseId}</Link> {c.coverage === 'deterministic' ? c.ruleIds.join(', ') : <span className="text-amber-700 dark:text-amber-300">LLM-only</span>}</li>
              ))}
            </ul>
          </details>
        </Card>

        <Card title="Hallucinations blocked (cumulative)" note="Reviewer findings dropped by the citation verifier, by the model that produced them.">
          {halluc.total === 0 ? <Empty what="blocked citations" /> : (
            <ul className="space-y-2">
              {halluc.byModel.map((h) => (
                <li key={h.model} className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm">
                  <div className="font-semibold text-red-700 dark:text-red-300 flex items-center gap-1"><ShieldAlert className="w-4 h-4" />{h.model}: {h.count} blocked</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Reasons: {h.reasons.join('; ')}</div>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-4 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1"><Users className="w-4 h-4" />Human decisions by role</h3>
          <table className="w-full text-xs mt-1">
            <thead><tr className="text-left text-slate-600 dark:text-slate-400"><th>Role</th><th>Overrides</th><th>Change requests</th></tr></thead>
            <tbody>{byRole.map((r) => <tr key={r.role} className="border-t border-slate-100 dark:border-slate-800"><td className="capitalize">{r.role}</td><td>{r.overrides}</td><td>{r.rejections}</td></tr>)}</tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
