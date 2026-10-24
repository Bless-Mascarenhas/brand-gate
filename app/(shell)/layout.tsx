import React from 'react';
import { SideBar } from '@/src/ui/components/SideBar';
import { TopBar } from '@/src/ui/components/TopBar';
import { MobileNav } from '@/src/ui/components/MobileNav';
import { GuidedTour } from '@/src/ui/components/GuidedTour';

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 dark:bg-[#090d16]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-indigo-600 focus:text-white">
        Skip to main content
      </a>
      <SideBar />
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <TopBar />
        <MobileNav />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 focus:outline-none">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
      <GuidedTour />
    </div>
  );
}
