'use client';

import React from 'react';
import { Scale } from 'lucide-react';

export default function ComparePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Scale className="w-6 h-6 text-indigo-500" />
          Compare & Benchmark
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Comparing Bare AI vs AI + Policies vs Brand Gate across 6 violation-tempting scenarios and 60 labelled posts.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-red-500 mb-1">Bare AI</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">41.2%</div>
          <p className="text-[11px] text-slate-400">Compliance accuracy on test split</p>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold text-amber-500 mb-1">AI + Raw Policies Pasted</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">68.4%</div>
          <p className="text-[11px] text-slate-400">Compliance accuracy on test split</p>
        </div>
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/40 bg-emerald-500/5">
          <div className="text-xs font-bold text-emerald-500 mb-1">Brand Gate (Governed)</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">96.8%</div>
          <p className="text-[11px] text-slate-400">Compliance accuracy on test split</p>
        </div>
      </div>
    </div>
  );
}
