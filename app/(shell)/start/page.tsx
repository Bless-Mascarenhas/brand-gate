'use client';
// Start here: pitch, interactive architecture diagram, and navigation to live governance tools.
import React from 'react';
import Link from 'next/link';
import { Sparkles, ArrowRight, Map, ShieldCheck, PenTool, Scale, ListTodo } from 'lucide-react';
import { ArchitectureDiagram } from '@/src/ui/components/ArchitectureDiagram';
import { startTour } from '@/src/ui/components/GuidedTour';

export default function StartPage() {
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
            <button type="button" onClick={startTour} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg">
              <Map className="w-4 h-4" aria-hidden />
              Guided tour (5 steps)
            </button>
            <Link href="/verify" className="flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20">
              Verify your own post <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
            <Link href="/build" className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm underline-offset-4 hover:underline">
              Draft in Build <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="first-time" className="grid md:grid-cols-3 gap-4 text-sm">
        <h2 id="first-time" className="sr-only">How to use Brand Gate</h2>
        {[
          ['1. Explore', 'Take the guided tour, or open any section from the sidebar. Everything runs live against configured providers.'],
          ['2. Roles & Workflow', 'Switch between Creator, Manager and Reviewer in the top bar to inspect and approve real posts in the review queue.'],
          ['3. Live Governance', 'Verify, Build and Compare call real models and deterministic rules, logging every action to your local audit trail.'],
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

      <section aria-labelledby="sections-heading" className="space-y-4">
        <h2 id="sections-heading" className="text-lg font-bold text-slate-900 dark:text-white">Explore the application</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/verify" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition group space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition">Verify</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Run candidate posts against deterministic gates, independent reviewers, and citation verification.</p>
          </Link>
          <Link href="/build" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition group space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold">
              <PenTool className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition">Build</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Collaborative post drafting with multimodal generation, automatic policy governance loops, and image compositing.</p>
          </Link>
          <Link href="/compare" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition group space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold">
              <Scale className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition">Compare</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Live three-column comparison: Bare AI vs AI + pasted policies vs governed pipeline.</p>
          </Link>
          <Link href="/workflow" className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition group space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold">
              <ListTodo className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition">Workflow</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Escalation matrix review queue, manager overrides, version diffs, and append-only audit trail.</p>
          </Link>
        </div>
      </section>
    </div>
  );
}
