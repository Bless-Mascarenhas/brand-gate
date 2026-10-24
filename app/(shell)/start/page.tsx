'use client';
// Start here (spec §16, Phase 9): pitch, interactive architecture, guided tour, recorded demo.
import React from 'react';
import Link from 'next/link';
import { Play, Sparkles, ArrowRight, Map, History } from 'lucide-react';
import { useApp } from '@/src/ui/context/AppContext';
import { ArchitectureDiagram } from '@/src/ui/components/ArchitectureDiagram';
import { ProvenanceBadge } from '@/src/ui/components/ReplayViewer';
import { startTour } from '@/src/ui/components/GuidedTour';
import teaserRun from '@/data/replay/compare-sustainability-claim.json';
import benchmark from '@/data/benchmark/results.json';
import { CompareReplay } from '@/src/replay/schema';

const teaser = teaserRun as unknown as CompareReplay;
const verdictClass = (v: string) => (v === 'BLOCKED' ? 'text-red-700 dark:text-red-300' : v === 'REVISE' ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300');
const pct = (x: number | null | undefined) => (x === null || x === undefined ? 'n/a' : `${Math.round(x * 100)}%`);

export default function StartPage() {
  const { setMode } = useApp();
  const govTest = (benchmark.systems.governed.metrics as unknown as Record<string, { precision: number | null; recall: number | null; falsePositiveRateOnClean: number | null }>).test;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 sm:p-8 lg:p-12 text-white border border-indigo-800/40 shadow-2xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" aria-hidden />
            Pre-publication brand governance
          </div>
          <h1 className="text-3xl lg:text-5xl font-black tracking-tight leading-tight">
            Stop brand drift <span className="text-sky-200">before it reaches social media</span>
          </h1>
          <p className="text-slate-200 text-sm lg:text-base leading-relaxed">
            Brand Gate reviews every post for <strong className="text-white">Thrift-It</strong>, a fictional Mumbai pre-loved clothing store, before it is published:
            deterministic rules check facts and banned claims, two AI reviewers judge tone, code verifies every citation and computes the verdict, and a human always makes the final call.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setMode('replay'); window.location.href = '/verify?demo=1'; }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg"
            >
              <Play className="w-4 h-4 fill-white" aria-hidden />
              Run the 90-second demo
            </button>
            <button type="button" onClick={startTour} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20">
              <Map className="w-4 h-4" aria-hidden />
              Guided tour (5 steps)
            </button>
            <Link href="/verify" className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm underline-offset-4 hover:underline">
              Verify your own post <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
          <p className="text-xs text-slate-300 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" aria-hidden /> The demo plays a recorded run and needs no API keys; it is labelled “Recorded run, not live”.
          </p>
        </div>
      </section>

      <section aria-labelledby="first-time" className="grid md:grid-cols-3 gap-4 text-sm">
        <h2 id="first-time" className="sr-only">How to use this demo</h2>
        {[
          ['1. Watch', 'Press “Run the 90-second demo”. A recorded verification of a sample post plays step by step on the architecture diagram.'],
          ['2. Explore', 'Take the guided tour, or open any section from the sidebar. Switch between Creator, Manager and Reviewer in the top bar to see what each role may do (roles are simulated).'],
          ['3. Go live', 'With the access code and provider keys configured, Verify, Build and Compare call real models. Without them, the top-bar toggle switches to Replay.'],
        ].map(([t, b]) => (
          <div key={t} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <h3 className="font-bold text-slate-900 dark:text-white">{t}</h3>
            <p className="text-slate-700 dark:text-slate-300 mt-1">{b}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="arch-heading" className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h2 id="arch-heading" className="text-lg font-bold text-slate-900 dark:text-white">How it works</h2>
        <ArchitectureDiagram />
      </section>

      <section aria-labelledby="teaser-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="teaser-heading" className="text-lg font-bold text-slate-900 dark:text-white">Bare AI vs AI + policies vs governed</h2>
          <ProvenanceBadge provenance={teaser.provenance} />
        </div>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Brief: “{teaser.brief}” Each output below is scored by the same deterministic gate engine. Recorded {teaser.recordedAt.slice(0, 10)}; see Compare for all six scenarios and how each column was produced.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {teaser.columns.map((c) => (
            <div key={c.key} className="rounded-2xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white">{c.label}</h3>
                <ProvenanceBadge provenance={c.provenance} />
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 line-clamp-4">{c.post.caption}</p>
              <div className="text-sm">
                Score <strong>{c.metrics.score}</strong> · <span className={`font-bold ${verdictClass(c.metrics.verdict)}`}>{c.metrics.verdict}</span>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                {c.key === 'governed'
                  ? `Pipeline verdict ${c.pipelineVerdict?.status ?? 'n/a'} — cannot be published until a human approves it.`
                  : 'Nothing stops this from being posted as written.'}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300">
          Benchmark (held-out split, {benchmark.meta.execution.replace('_', ' ')} run, labels human-reviewed {benchmark.meta.labelsHumanReviewed}): governed precision {pct(govTest?.precision)}, recall {pct(govTest?.recall)}, false positives on clean posts {pct(govTest?.falsePositiveRateOnClean)}. The single-model baseline has not been run yet, so no head-to-head number is claimed.{' '}
          <Link href="/compare" className="text-indigo-700 dark:text-indigo-300 underline">Open Compare</Link>
        </p>
      </section>
    </div>
  );
}
