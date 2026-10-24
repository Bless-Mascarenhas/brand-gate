'use client';

import React from 'react';
import { useApp } from '@/src/ui/context/AppContext';
import { Role } from '@/src/types';
import {
  Calendar,
  Zap,
  Lock,
  Unlock,
  Sun,
  Moon,
  Cpu,
  RefreshCw,
} from 'lucide-react';

export const TopBar: React.FC = () => {
  const {
    role,
    setRole,
    mode,
    setMode,
    speedMode,
    setSpeedMode,
    theme,
    toggleTheme,
    demoDate,
    hasAccess,
    setIsAccessModalOpen,
    providers,
    refreshProviders,
  } = useApp();

  const roles: { id: Role; label: string; badge: string }[] = [
    { id: 'creator', label: 'Creator', badge: 'Drafting' },
    { id: 'manager', label: 'Manager', badge: 'Approval' },
    { id: 'reviewer', label: 'Reviewer', badge: 'Legal/Brand' },
  ];

  return (
    <header className="min-h-[4rem] border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 z-30 sticky top-0">
      {/* Left: Role Switcher & Simulated SSO note */}
      <div className="flex items-center gap-2 sm:gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/60">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 px-2">
            Role
          </span>
          {roles.map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                role === r.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="hidden xl:inline text-[11px] text-slate-600 italic dark:text-slate-400">
          (Simulated roles for demo; production uses SSO)
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Pinned Demo Date */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700" title="Pinned system date so seeded campaigns stay valid/expired as designed">
          <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
          <span>{demoDate}</span>
        </div>

        {/* Speed Mode toggle */}
        <button
          onClick={() => setSpeedMode(speedMode === 'fast' ? 'thorough' : 'fast')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
            speedMode === 'fast'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
              : 'bg-purple-50 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300'
          }`}
          title="Fast skips crosscheck rebuttal; Thorough runs full 2-round multi-model debate"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="capitalize">{speedMode}</span>
        </button>

        {/* Live vs Replay Mode */}
        <button
          onClick={() => setMode(mode === 'live' ? 'replay' : 'live')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
            mode === 'live'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300'
          }`}
          title="Click to toggle between Live LLM calls and Pre-recorded Offline Replay"
        >
          <span className={`w-2 h-2 rounded-full ${mode === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-sky-500'}`} />
          <span className="uppercase tracking-wider">{mode}</span>
        </button>

        {/* Provider Status Chips */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-700/60">
          <Cpu className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
          {(['gemini', 'groq', 'nvidia'] as const).map((p) => {
            const status = providers[p];
            const isOk = status === 'configured';
            return (
              <span
                key={p}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                  isOk
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}
                title={`${p === 'groq' ? 'GPT-OSS via Groq' : p}: ${status} (keys kept on server)`}
              >
                {p === 'groq' ? 'GPT-OSS' : p}
              </span>
            );
          })}
          <button
            onClick={refreshProviders}
            className="p-0.5 text-slate-600 hover:text-slate-600 dark:hover:text-slate-200 dark:text-slate-400"
            title="Refresh status"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* Access Code Gate button */}
        <button
          onClick={() => setIsAccessModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
            hasAccess
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-400'
          }`}
          title={hasAccess ? 'Access Authorized' : 'Click to enter Demo Access Code'}
        >
          {hasAccess ? (
            <>
              <Unlock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
              <span>Gate: Unlocked</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
              <span>Access Code</span>
            </>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
          title="Toggle Dark/Light Mode"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>
    </header>
  );
};
