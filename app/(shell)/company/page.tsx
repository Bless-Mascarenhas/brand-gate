'use client';

import React from 'react';
import { Building2, FileText, CheckCircle2, Shield, Palette } from 'lucide-react';

export default function CompanyPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-500" />
            Company Knowledge Base (Thrift-It)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Governed policy documents, active facts registry, deterministic rules, and brand assets.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { icon: FileText, title: '8 Policy Documents', sub: '90+ Clauses Indexed' },
          { icon: CheckCircle2, title: 'Approved Facts', sub: 'Validity windows & prices' },
          { icon: Shield, title: '45+ Deterministic Rules', sub: 'Hard gates & zero debate' },
          { icon: Palette, title: 'Brand Assets', sub: 'Thrift Teal, Marigold, Wordmark' },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={i}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <Icon className="w-5 h-5 text-indigo-500 mb-2" />
              <div className="font-bold text-sm text-slate-900 dark:text-white">{card.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{card.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
        <p className="text-xs text-slate-400">
          Full 8 markdown documents, interactive clause anchor viewer, and facts/rules tables will load in Phase 2.
        </p>
      </div>
    </div>
  );
}
