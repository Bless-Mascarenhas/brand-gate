// "AI-generated" disclosure badge (spec §17). Put it next to every artefact a model produced.
import React from 'react';
import { Bot } from 'lucide-react';

export function AiBadge({ what = 'AI-generated' }: { what?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-fuchsia-100 dark:bg-fuchsia-950/60 text-fuchsia-800 dark:text-fuchsia-200">
      <Bot className="w-3 h-3" aria-hidden />
      {what}
    </span>
  );
}
