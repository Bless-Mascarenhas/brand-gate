// Server component: reads the real docs at build time and hands them to the client tabs.
import fs from 'fs';
import path from 'path';
import { FileCode2 } from 'lucide-react';
import { TransparencyTabs } from '@/src/ui/components/TransparencyTabs';

const readDoc = (name: string) => {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'docs', name), 'utf-8');
  } catch {
    return `# ${name}\n\nThis document could not be read when the page was built.`;
  }
};

export default function TransparencyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <FileCode2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" aria-hidden />
          Transparency
        </h1>
        <p className="text-sm text-slate-700 dark:text-slate-300">
          How Brand Gate is built, which models it uses and what they receive, how AI output is disclosed, and what it cannot do yet.
        </p>
      </div>
      <TransparencyTabs decisions={readDoc('DECISIONS.md')} limitations={readDoc('KNOWN_LIMITATIONS.md')} />
    </div>
  );
}
