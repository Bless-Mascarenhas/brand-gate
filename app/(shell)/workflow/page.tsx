'use client';

import React from 'react';
import { ListTodo } from 'lucide-react';
import { useApp } from '@/src/ui/context/AppContext';

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

      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Pending Approvals</h3>
        <div className="space-y-3">
          {[
            { title: 'Diwali Thrift Fest - Teaser 1', status: 'ready_for_human', score: 94, author: 'Ria (Creator)' },
            { title: 'Denim Drops - Winter Collection', status: 'changes_requested', score: 74, author: 'Karan (Creator)' },
            { title: 'Bandra Pop-up Weekend Reminder', status: 'approved', score: 98, author: 'Pooja (Manager)' },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs"
            >
              <div>
                <div className="font-semibold text-slate-900 dark:text-white">{item.title}</div>
                <div className="text-slate-400">Created by {item.author}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-emerald-500">{item.score}/100</span>
                <span className="px-2 py-0.5 rounded uppercase font-semibold text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300">
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
