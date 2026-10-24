'use client';

import React from 'react';
import { ListTodo } from 'lucide-react';
import { useApp } from '@/src/ui/context/AppContext';
import ReviewQueue from '@/src/ui/components/ReviewQueue';

export default function WorkflowPage() {
  const { role } = useApp();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-indigo-500" />
            Workflow & Review Queue
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Role-based review queue for posts in <code className="text-indigo-400 font-mono">draft</code>, <code className="text-amber-400 font-mono">in_review</code>, and <code className="text-emerald-400 font-mono">approved</code> states.
          </p>
        </div>
        <div className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300">
          Viewing as: <strong className="capitalize">{role}</strong>
        </div>
      </div>

      <ReviewQueue />
    </div>
  );
}
