'use client';

import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-500" />
          Brand Insights & Ambiguity Index
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Surfacing recurring creator mistakes and unclear policy clauses based on multi-model debate disputes and human overrides.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-400 mb-1">Top Unclear Clause</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">[BV-007]</div>
          <p className="text-xs text-amber-500 mt-1">&quot;Keep tone friendly but not too casual&quot; (42% dispute rate)</p>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-400 mb-1">Top Planted Rule Conflict</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">[BV vs SR]</div>
          <p className="text-xs text-indigo-400 mt-1">Emoji limit 3 vs 2 (Resolved by precedence: stricter 2)</p>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-400 mb-1">Hallucinations Blocked</div>
          <div className="text-lg font-bold text-slate-900 dark:text-white font-mono">18 Blocked</div>
          <p className="text-xs text-emerald-500 mt-1">Citations discarded by code substring verification</p>
        </div>
      </div>
    </div>
  );
}
