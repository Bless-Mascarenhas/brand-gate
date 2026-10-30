'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export const navItems = [
  { href: '/company', label: 'Company Documents', icon: Building2, badge: 'Policies' },
  { href: '/build', label: 'Create', icon: Sparkles, badge: 'Draft' },
  { href: '/verify', label: 'Evaluate', icon: ShieldCheck, badge: 'Review' },
];

export const SideBar: React.FC = () => {
  const pathname = usePathname();

  return (
    <aside aria-label="Sections" className="hidden md:flex w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex-col justify-between shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
              BG
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Brand Gate
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 font-semibold uppercase">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                Governing <span className="text-[#0E7C7B] font-semibold">Thrift-It</span> (@thriftit.in)
              </p>
            </div>
          </div>
        </div>

        {/* Navigation items in strict specified order */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-600 dark:text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Box */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[11px]">
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/50 space-y-1">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
            <span className="font-semibold">Order of Authority</span>
          </div>
          <p className="text-[10px] text-slate-600 dark:text-slate-300 font-mono leading-relaxed">
            Gates &gt; LLM Findings &gt; Human Decision
          </p>
        </div>
      </div>
    </aside>
  );
};
