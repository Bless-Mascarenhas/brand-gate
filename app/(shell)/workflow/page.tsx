'use client';

import React from 'react';
import { ListTodo, UserCog } from 'lucide-react';
import { useApp } from '@/src/ui/context/AppContext';
import ReviewQueue from '@/src/ui/components/ReviewQueue';

export default function WorkflowPage() {
  const { role } = useApp();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-indigo-500" />
            Workflow &amp; Review Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            draft → in_review → changes_requested → approved → published_mock. Required approvers come from the escalation matrix; nothing is ever auto-published.
          </p>
        </div>
        <div className="text-xs px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-start gap-2 max-w-sm">
          <UserCog className="w-4 h-4 shrink-0" />
          <span>
            Acting as <strong className="capitalize">{role}</strong>. Simulated roles for the demo (switch in the top bar); production would use SSO (EM-008).
            Records are stored in this browser.
          </span>
        </div>
      </div>

      <ReviewQueue />
    </div>
  );
}
