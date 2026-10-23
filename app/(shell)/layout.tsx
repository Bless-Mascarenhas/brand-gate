import React from 'react';
import { SideBar } from '@/src/ui/components/SideBar';
import { TopBar } from '@/src/ui/components/TopBar';

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-[#090d16]">
      <SideBar />
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
