'use client';

import React, { useState } from 'react';
import {
  FileCode2,
  Cpu,
  Layers,
  ShieldCheck,
  AlertOctagon,
  Users,
} from 'lucide-react';

export default function TransparencyPage() {
  const [activeTab, setActiveTab] = useState<'arch' | 'models' | 'responsible' | 'limits' | 'team'>('arch');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <FileCode2 className="w-6 h-6 text-indigo-500" />
          Transparency & Responsible AI Disclosure
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Complete disclosure of models, data flow, safety gates, known limitations, and team contributions.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'arch', label: 'Architecture & Decisions', icon: Layers },
          { id: 'models', label: 'Models & Data Flow', icon: Cpu },
          { id: 'responsible', label: 'Responsible Design', icon: ShieldCheck },
          { id: 'limits', label: 'Known Limitations', icon: AlertOctagon },
          { id: 'team', label: 'Team & Contribution', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isCurrent = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                isCurrent
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
        {activeTab === 'arch' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Core Architectural Flow</h3>
            <p>
              Brand Gate guarantees deterministic gates run <strong>before</strong> any LLM, code decides the verdict, and human reviewers retain the sole authority to approve and publish.
            </p>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300">
              Content &rarr; Deterministic Gates &rarr; Parallel Soft Review (Grok + NVIDIA) &rarr; Citation Substring Verifier &rarr; Consensus &rarr; Adjudication &rarr; Human Sign-off
            </div>
          </div>
        )}

        {activeTab === 'models' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Models &amp; API Usage</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-400">
                    <th className="py-2">Provider</th>
                    <th className="py-2">Purpose</th>
                    <th className="py-2">Data Sent</th>
                    <th className="py-2">Data Retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  <tr>
                    <td className="py-2 font-bold text-indigo-400">Gemini 2.0 Flash</td>
                    <td className="py-2">Post Generation, Vision Perception, Summary</td>
                    <td className="py-2">Prompt, routed policy clauses, uploaded image</td>
                    <td className="py-2">Ephemeral (API policy zero training)</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-sky-400">xAI (Grok-2)</td>
                    <td className="py-2">Reviewer A (Tone, Messaging, Claims)</td>
                    <td className="py-2">Post text, routed policy clauses</td>
                    <td className="py-2">Ephemeral per API terms</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-bold text-emerald-400">NVIDIA NIM (Llama-3.1-70B)</td>
                    <td className="py-2">Reviewer B (Independent Debate Cross-check)</td>
                    <td className="py-2">Post text, routed policy clauses</td>
                    <td className="py-2">Ephemeral per API terms</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'responsible' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Responsible Design Principles</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Zero Auto-Publish:</strong> The system cannot post to social media without human reviewer approval.</li>
              <li><strong>Citation Requirement:</strong> Every finding must cite an exact clause ID and quote a valid substring from the policy document.</li>
              <li><strong>Untrusted Data Encapsulation:</strong> All user posts are encapsulated in XML tags; prompt-injection patterns are caught deterministically.</li>
            </ul>
          </div>
        )}

        {activeTab === 'limits' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Known Limitations</h3>
            <p>
              Please see <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-400 font-mono">docs/KNOWN_LIMITATIONS.md</code> for complete details.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Simulated role-based auth (for demo convenience).</li>
              <li>Client-side orchestration to avoid Vercel 60-second serverless execution limits.</li>
              <li>Mocked social publishing receipt instead of live Meta Graph API.</li>
            </ul>
          </div>
        )}

        {activeTab === 'team' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Team &amp; Contribution</h3>
            <p>
              Solo build by <strong>Bless Mascarenhas</strong>. Built for pre-publication brand governance and verifiable AI alignment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
