'use client';
// app/(shell)/insights/page.tsx
// Phase 7 – Insights & Ambiguity Index
// All data is seeded/sample data, clearly labelled as such.
import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';
import { BarChart3, AlertTriangle, CheckCircle2, ShieldAlert, Lightbulb, TrendingUp, ExternalLink } from 'lucide-react';
import Link from 'next/link';

// ─── Seeded sample data (clearly labelled) ──────────────────────────────────
const SAMPLE_NOTE = '⚠ Sample data — seeded for demo purposes. Live runs append to this.';

const violationsByCategory = [
  { category: 'Terminology', findings: 28, resolved: 24 },
  { category: 'Brand Voice', findings: 22, resolved: 16 },
  { category: 'Claims', findings: 17, resolved: 14 },
  { category: 'Disclosure', findings: 15, resolved: 15 },
  { category: 'Accessibility', findings: 12, resolved: 10 },
  { category: 'Visual', findings: 10, resolved: 7 },
  { category: 'Regional', findings: 8, resolved: 6 },
  { category: 'Messaging', findings: 6, resolved: 5 },
];

const scoreDistribution = [
  { bucket: '0–40', before: 4, after: 0 },
  { bucket: '41–60', before: 9, after: 2 },
  { bucket: '61–70', before: 14, after: 5 },
  { bucket: '71–80', before: 20, after: 8 },
  { bucket: '81–90', before: 32, after: 28 },
  { bucket: '91–100', before: 11, after: 47 },
];

const iterationsToReady = [
  { name: 'Week 1', avg: 2.9 },
  { name: 'Week 2', avg: 2.5 },
  { name: 'Week 3', avg: 2.1 },
  { name: 'Week 4', avg: 1.7 },
  { name: 'Week 5', avg: 1.4 },
  { name: 'Week 6', avg: 1.3 },
];

const ambiguityIndex = [
  {
    clause: 'BV-007',
    title: '"Keep tone friendly but not too casual"',
    disputes: 18,
    overrides: 7,
    rejections: 4,
    totalChecks: 69,
    index: 0.42,
    suggestion: 'Clarify with examples: Define "too casual" with 2-3 example captions — one on-brand (friendly), one borderline (too casual), one clearly off-brand (dismissive). This removes interpreter latitude.',
    docHref: '/company#BV-007',
  },
  {
    clause: 'CL-004',
    title: '"Use sustainability language responsibly"',
    disputes: 12,
    overrides: 5,
    rejections: 3,
    totalChecks: 51,
    index: 0.39,
    suggestion: 'Add an explicit allowlist: List the 4 approved sustainability phrases verbatim and state that any other sustainability claim requires written evidence attached at submission.',
    docHref: '/company#CL-004',
  },
  {
    clause: 'SR-009',
    title: '"Use appropriate festival imagery"',
    disputes: 9,
    overrides: 4,
    rejections: 2,
    totalChecks: 39,
    index: 0.38,
    suggestion: 'Replace with the approved-festival-list clause: Enumerate the festivals from market.json explicitly. State that imagery outside this list requires Manager pre-approval.',
    docHref: '/company#SR-009',
  },
  {
    clause: 'BV-SR emoji conflict',
    title: 'Emoji limit: BV says ≤3, SR says ≤2',
    disputes: 14,
    overrides: 0,
    rejections: 0,
    totalChecks: 84,
    index: 0.17,
    suggestion: 'Resolved by precedence: stricter SR wins (≤2). Update BV-003 to reference SR explicitly so creators see the single source of truth.',
    docHref: '/company#SR',
  },
];

const hallucinationLog = [
  { model: 'xAI Grok', count: 11, example: 'Cited BV-999 (non-existent clause)' },
  { model: 'NVIDIA NIM', count: 7, example: 'Quote not found in post field' },
];

const ruleCoverage = [
  { category: 'Terminology', deterministic: 8, llmOnly: 2 },
  { category: 'Accessibility', deterministic: 6, llmOnly: 1 },
  { category: 'Social Rules', deterministic: 7, llmOnly: 3 },
  { category: 'Claims', deterministic: 3, llmOnly: 5 },
  { category: 'Brand Voice', deterministic: 2, llmOnly: 7 },
  { category: 'Visual', deterministic: 4, llmOnly: 4 },
];

// ─── Component ───────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const totalHallucinations = hallucinationLog.reduce((s, h) => s + h.count, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-500" />
            Brand Insights &amp; Ambiguity Index
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            Surfacing recurring creator mistakes and unclear policy clauses based on multi-model debate disputes and human overrides.
          </p>
        </div>
        <div className="shrink-0 text-[11px] px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 font-mono">
          {SAMPLE_NOTE}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Checks', value: '120', icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Hallucinations Blocked', value: String(totalHallucinations), icon: ShieldAlert, color: 'text-red-500' },
          { label: 'Avg Iterations to READY', value: '1.8', icon: TrendingUp, color: 'text-indigo-500' },
          { label: 'Disputed Findings', value: '53', icon: AlertTriangle, color: 'text-amber-500' },
        ].map((kpi) => (
          <div key={kpi.label} className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <kpi.icon className={`w-5 h-5 ${kpi.color} mb-2`} />
            <div className="text-2xl font-black text-slate-900 dark:text-white">{kpi.value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Violations by category */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <h2 className="font-bold text-slate-800 dark:text-white mb-4">Violations by Category</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={violationsByCategory} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="findings" name="Total findings" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="resolved" name="Resolved" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Score distribution + Iterations to READY */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h2 className="font-bold text-slate-800 dark:text-white mb-4">Score Distribution: First-Pass vs After-Fix</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreDistribution} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="before" name="First pass" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="after" name="After fix" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h2 className="font-bold text-slate-800 dark:text-white mb-4">Avg Iterations to READY (trending down)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={iterationsToReady} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={[1, 3.5]} />
              <Tooltip />
              <Line type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Avg iterations" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ambiguity Index */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-bold text-slate-800 dark:text-white">Ambiguity Index per Clause</h2>
          <span className="text-xs text-slate-400 font-mono">(disputes + overrides + rejections) ÷ total checks</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Clauses with high ambiguity index are candidates for rewriting. Top 3 show AI-drafted clarification suggestions (labelled).
        </p>
        <div className="space-y-3">
          {ambiguityIndex.map((item, i) => (
            <div key={item.clause} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                onClick={() => setExpanded(expanded === item.clause ? null : item.clause)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    {item.clause}
                  </span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.title}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <div className="text-right">
                    <div
                      className={`text-lg font-black tabular-nums ${
                        item.index > 0.3 ? 'text-red-500' : item.index > 0.2 ? 'text-amber-500' : 'text-emerald-500'
                      }`}
                    >
                      {(item.index * 100).toFixed(0)}%
                    </div>
                    <div className="text-[10px] text-slate-400">ambiguity</div>
                  </div>
                  <span className="text-slate-400 text-xs">{expanded === item.clause ? '▲' : '▼'}</span>
                </div>
              </button>

              {expanded === item.clause && (
                <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                  <div className="flex gap-6 text-sm">
                    <div><span className="text-slate-500">Disputes:</span> <strong>{item.disputes}</strong></div>
                    <div><span className="text-slate-500">Overrides:</span> <strong>{item.overrides}</strong></div>
                    <div><span className="text-slate-500">Rejections:</span> <strong>{item.rejections}</strong></div>
                    <div><span className="text-slate-500">Total checks:</span> <strong>{item.totalChecks}</strong></div>
                  </div>
                  {i < 3 && item.suggestion && (
                    <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-3">
                      <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                        <Lightbulb className="w-3.5 h-3.5" />
                        AI-drafted clarification suggestion (Gemini) — review before applying
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-200">{item.suggestion}</p>
                    </div>
                  )}
                  <Link
                    href={item.docHref}
                    className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:underline"
                  >
                    Open clause in Company KB <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Rule coverage + Hallucinations */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h2 className="font-bold text-slate-800 dark:text-white mb-4">Rule Coverage: Deterministic vs LLM-Only</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={ruleCoverage} layout="vertical" margin={{ top: 4, right: 16, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Legend />
              <Bar dataKey="deterministic" name="Deterministic" fill="#6366f1" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="llmOnly" name="LLM-only" fill="#f59e0b" stackId="a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h2 className="font-bold text-slate-800 dark:text-white mb-1">Hallucinations Blocked</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
            Findings dropped by the citation verifier because the clause didn&apos;t exist or the quote wasn&apos;t in the post.
          </p>
          <div className="space-y-3">
            {hallucinationLog.map((h) => (
              <div key={h.model} className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-red-700 dark:text-red-300">{h.model}: <strong>{h.count}</strong> blocked</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">e.g. {h.example}</div>
                </div>
              </div>
            ))}
            <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
              Total: <strong className="text-red-500">{totalHallucinations}</strong> fabricated citations discarded
              — code-verified before reaching the verdict.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
