'use client';

import React from 'react';
import { ShieldCheck, CheckCircle } from 'lucide-react';

export default function VerifyPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-500" />
            Verify: Multi-Model Audit Pipeline
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Paste or upload any social post. Hard gates run first, followed by Grok & NVIDIA debate, citation verification, and scoring.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Post Input</h3>
            <select className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300">
              <option>Load Sample Post 1 (Clean Control)</option>
              <option>Load Sample Post 2 (Stale Monsoon Offer)</option>
              <option>Load Sample Post 3 (Greenwashing Claim)</option>
              <option>Load Sample Post 4 (Banned Terms & ₹299 Jeans)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Caption
            </label>
            <textarea
              rows={4}
              placeholder="Enter Instagram post caption..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans"
              defaultValue="Diwali vibes only! ✨ Get up to 30% off our curated pre-loved collection during the Diwali Thrift Fest. Free shipping on orders above ₹999. Visit our Bandra pop-up this weekend! #ThriftIt #PreLovedFashion"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Hashtags (Space or comma separated)
            </label>
            <input
              type="text"
              placeholder="#ThriftIt #CuratedVintage"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
              defaultValue="#ThriftIt #DiwaliFest #PreLovedFashion"
            />
          </div>

          <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg transition">
            Run Verification Pipeline
          </button>
        </div>

        {/* Right: Live Stepper & Verdict */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Pipeline Verdict</h3>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              READY_FOR_HUMAN
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Compliance Score</div>
              <div className="text-3xl font-black text-slate-900 dark:text-white">96 / 100</div>
            </div>
            <div className="text-xs text-right text-slate-500">
              <div>Hard Gates: <strong className="text-emerald-500">Passed</strong></div>
              <div>Hallucinations Blocked: <strong className="text-indigo-500">0</strong></div>
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>Clause [AF-002] Verified: Diwali Thrift Fest active through 2026-11-10.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
