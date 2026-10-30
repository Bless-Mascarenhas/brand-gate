'use client';
// Section navigation for narrow screens (the sidebar is hidden below the md breakpoint).
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navItems } from '@/src/ui/components/SideBar';

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
      <ul className="flex gap-1 px-2 py-2 min-w-max">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap ${active ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-300'}`}
              >
                <Icon className="w-4 h-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
