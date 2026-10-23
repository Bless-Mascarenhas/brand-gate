'use client';

import React from 'react';
import { Sparkles, Bot, Image as ImageIcon, Send } from 'lucide-react';

export default function BuildPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            Build: Governed Content Studio
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generate India-targeted posts for Thrift-It with an automatic 3-iteration self-governance loop.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Bot className="w-4 h-4 text-indigo-500" />
              <span>Gemini Content Creator</span>
            </div>
            <div className="text-[11px] text-slate-400">Format: 4:5 Feed &bull; Language: Hinglish</div>
          </div>

          <div className="h-64 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            Quick prompts: Diwali Thrift Fest teaser, Bandra pop-up weekend drop, Denim jackets drop.
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="e.g. Write a teaser for Diwali Thrift Fest targeting Mumbai college students..."
              className="w-full pl-4 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button className="absolute right-2 top-2 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg">
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="text-xs font-bold uppercase text-slate-400">Live Governance Preview</div>
          <div className="aspect-[4/5] bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-4 text-center">
            <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">Composited post with client-side canvas wordmark</p>
          </div>
        </div>
      </div>
    </div>
  );
}
