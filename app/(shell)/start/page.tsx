'use client';

import React from 'react';
import Link from 'next/link';
import { Play, Sparkles, ArrowRight } from 'lucide-react';
import { useApp } from '@/src/ui/context/AppContext';

export default function StartPage() {
  const { setMode } = useApp();

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Hero statement */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-8 lg:p-12 text-white border border-indigo-800/40 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Pre-Publication Brand Governance Platform
          </div>
          <h1 className="text-3xl lg:text-5xl font-black tracking-tight leading-tight">
            Stop Brand Drift <br className="hidden sm:inline" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-teal-300">
              Before It Ever Hits Social Media
            </span>
          </h1>
          <p className="text-slate-300 text-sm lg:text-base leading-relaxed">
            Governing social campaigns for <strong className="text-white">Thrift-It</strong> (Mumbai curated pre-loved fashion). We combine deterministic hard rules, 2-model debate (Grok + NVIDIA), citation verification, and human oversight.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-4">
            <button
              onClick={() => {
                setMode('replay');
                window.location.href = '/verify?demo=diwali';
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition transform hover:-translate-y-0.5"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Run 90-Second Demo</span>
            </button>
            <Link
              href="/verify"
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm border border-white/10 transition"
            >
              <span>Test Verify Engine</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 3-Way Teaser: Bare AI vs AI + Policies vs Governed */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          Why Raw LLMs Fail & How Brand Gate Fixes It
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-2xl p-6 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/40 shadow-sm space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center gap-1.5">
              <span>Column A</span> &bull; <span>Bare AI</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Unconstrained Generation</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Standard chatbots invent expired discounts, cite illegal claims like &quot;100% authentic eco-friendly&quot;, and ignore regional Indian legal constraints.
            </p>
            <div className="text-[11px] font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg">
              Score: ~32/100 (Critical Hallucinations)
            </div>
          </div>

          <div className="rounded-2xl p-6 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/40 shadow-sm space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <span>Column B</span> &bull; <span>AI + Policies Pasted In</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Prompt Stuffing</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Pasting 8 policy docs overwhelms attention windows. Subtle greenwashing and stale shipping thresholds slip straight past single-pass scrutiny.
            </p>
            <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg">
              Score: ~65/100 (Unverified Pass)
            </div>
          </div>

          <div className="rounded-2xl p-6 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/40 shadow-sm space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <span>Column C</span> &bull; <span>Governed Pipeline</span>
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Brand Gate Architecture</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Deterministic gates catch hard facts; 2-model debate challenges subjective tone; code validates citations; human signs off final post.
            </p>
            <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg">
              Score: 94/100 (Ready For Human)
            </div>
          </div>
        </div>
      </div>

      {/* Guided Tour Links */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Explore the 8 Platform Modules</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Link href="/company" className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition border border-slate-200/60 dark:border-slate-700/60">
            <div className="font-semibold text-slate-900 dark:text-white">2. Company KB</div>
            <div className="text-slate-500">8 policy docs & rules</div>
          </Link>
          <Link href="/build" className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition border border-slate-200/60 dark:border-slate-700/60">
            <div className="font-semibold text-slate-900 dark:text-white">3. Build Chat</div>
            <div className="text-slate-500">AI generator with self-loop</div>
          </Link>
          <Link href="/verify" className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition border border-slate-200/60 dark:border-slate-700/60">
            <div className="font-semibold text-slate-900 dark:text-white">4. Verify Engine</div>
            <div className="text-slate-500">Multi-model audit pipeline</div>
          </Link>
          <Link href="/compare" className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition border border-slate-200/60 dark:border-slate-700/60">
            <div className="font-semibold text-slate-900 dark:text-white">5. Compare</div>
            <div className="text-slate-500">60 benchmark tests</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
