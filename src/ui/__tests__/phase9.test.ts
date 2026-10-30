import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getContrastRatio } from '@/src/rules/color';
import { STEP_TO_NODE, NODES } from '@/src/ui/components/ArchitectureDiagram';
import { TOUR_STEPS } from '@/src/ui/components/GuidedTour';
import { navItems } from '@/src/ui/components/SideBar';
import { TABS } from '@/src/ui/components/TransparencyTabs';
import { SafeMarkdown, parseBlocks } from '@/src/ui/components/SafeMarkdown';
import { addFeedback, clearFeedback, feedbackExport, loadFeedback } from '@/src/feedback/store';
import { StorageAdapter } from '@/src/storage';

const ROOT = process.cwd();
function sourceFiles(dir: string, ext = '.tsx'): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === '__tests__' ? [] : sourceFiles(p, ext);
    return p.endsWith(ext) ? [p] : [];
  });
}
const UI_FILES = [...sourceFiles(path.join(ROOT, 'app')), ...sourceFiles(path.join(ROOT, 'src'))];

// Tailwind v3 palette values for the tokens the app uses for text.
const PALETTE: Record<string, string> = {
  white: '#ffffff', 'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0', 'slate-300': '#cbd5e1', 'slate-400': '#94a3b8', 'slate-600': '#475569', 'slate-700': '#334155', 'slate-800': '#1e293b', 'slate-900': '#0f172a',
  'indigo-300': '#a5b4fc', 'indigo-600': '#4f46e5', 'indigo-700': '#4338ca', 'amber-300': '#fcd34d', 'amber-700': '#b45309', 'emerald-300': '#6ee7b7', 'emerald-700': '#047857',
  'red-300': '#fca5a5', 'red-600': '#dc2626', 'red-700': '#b91c1c', 'sky-300': '#7dd3fc', 'sky-700': '#0369a1', 'fuchsia-700': '#a21caf', 'fuchsia-800': '#86198f', 'fuchsia-100': '#fae8ff',
  appDark: '#090d16',
};

describe('WCAG AA contrast of the app theme tokens (spec §16)', () => {
  const light = ['slate-600', 'slate-700', 'slate-800', 'slate-900', 'indigo-600', 'indigo-700', 'amber-700', 'emerald-700', 'red-600', 'red-700', 'sky-700', 'fuchsia-800'];
  const dark = ['slate-200', 'slate-300', 'slate-400', 'indigo-300', 'amber-300', 'emerald-300', 'red-300', 'sky-300', 'white'];

  it.each(light)('light text %s ≥ 4.5:1 on white and slate-50', (t) => {
    expect(getContrastRatio(PALETTE[t], PALETTE.white)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(PALETTE[t], PALETTE['slate-50'])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(dark)('dark text %s ≥ 4.5:1 on slate-900 and the app background', (t) => {
    expect(getContrastRatio(PALETTE[t], PALETTE['slate-900'])).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(PALETTE[t], PALETTE.appDark)).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on the button fills we use passes', () => {
    for (const bg of ['indigo-600', 'emerald-700', 'amber-700', 'red-600', 'fuchsia-700']) expect(getContrastRatio(PALETTE.white, PALETTE[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it('the failing light-mode text shades are not used anywhere (regression barrier)', () => {
    const banned = /(^|[\s"'`])(text-slate-400|text-slate-500|text-indigo-500|text-amber-500|text-amber-600|text-emerald-500|text-emerald-600|text-red-500|text-sky-600|dark:text-slate-500)(?=[\s"'`])/;
    const offenders = UI_FILES.filter((f) => banned.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f));
    expect(offenders).toEqual([]);
  });
});

describe('architecture diagram', () => {
  it('maps every pipeline trace step to existing nodes', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/pipeline/usePipeline.ts'), 'utf8') + fs.readFileSync(path.join(ROOT, 'src/pipeline/governed.ts'), 'utf8');
    const steps = new Set([...src.matchAll(/addTrace\('([^']+)'/g), ...src.matchAll(/step: '([^']+)'/g)].map((m) => m[1]));
    steps.delete('Error');
    const ids = new Set(NODES.map((n) => n.id));
    for (const s of steps) {
      expect(STEP_TO_NODE[s], `no node for step ${s}`).toBeDefined();
      for (const id of STEP_TO_NODE[s]) expect(ids.has(id)).toBe(true);
    }
  });

  it('every node points at code that exists', () => {
    for (const n of NODES) {
      const first = n.code.split(/[ ,]/)[0].replace(/\{.*$/, '');
      expect(fs.existsSync(path.join(ROOT, first)), `${n.id} → ${first}`).toBe(true);
    }
  });
});

describe('guided tour', () => {
  it('has three steps whose targets exist on the pages they navigate to', () => {
    expect(TOUR_STEPS).toHaveLength(3);
    const all = UI_FILES.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
    for (const s of TOUR_STEPS) {
      expect(all).toContain(`data-tour="${s.target}"`);
      expect(fs.existsSync(path.join(ROOT, 'app', '(shell)', s.path.slice(1), 'page.tsx'))).toBe(true);
    }
  });

  it('exposes only Company Documents, Create, and Evaluate in the primary navigation', () => {
    expect(navItems.map(({ href, label }) => [href, label])).toEqual([
      ['/company', 'Company Documents'],
      ['/build', 'Create'],
      ['/verify', 'Evaluate'],
    ]);
    expect(fs.readFileSync(path.join(ROOT, 'app/page.tsx'), 'utf8')).toContain("redirect('/build')");
  });
});

describe('transparency', () => {
  it('has the nine tabs required by spec §17', () => {
    expect(TABS.map((t) => t[1])).toEqual([
      'Architecture', 'Models & services', 'AI disclosure', 'Data flow', 'Responsible design', 'Known limitations', 'User testing', 'Team & contribution', 'Source & submission',
    ]);
  });

  it('renders markdown as escaped text (no HTML injection)', () => {
    const html = renderToStaticMarkup(React.createElement(SafeMarkdown, { source: '# Title\n1. **bold** item\n<script>alert(1)</script> `code`' }));
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('keeps the real KNOWN_LIMITATIONS.md numbering across sections', () => {
    const blocks = parseBlocks(fs.readFileSync(path.join(ROOT, 'docs/KNOWN_LIMITATIONS.md'), 'utf8'));
    const numbers = blocks.flatMap((b) => (b.kind === 'ol' ? b.items.map((_, i) => b.start + i) : []));
    expect(numbers.length).toBeGreaterThan(10);
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1));
    const html = renderToStaticMarkup(React.createElement(SafeMarkdown, { source: '1. a\n## H\n2. b' }));
    expect(html).toContain('<ol start="2"');
  });

  it('user-testing results are not fabricated: the tab contains only author-to-fill markers', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/ui/components/TransparencyTabs.tsx'), 'utf8');
    expect(src).toMatch(/Author to fill with real results/);
    expect(src).not.toMatch(/\d+% success|participants: \d/i);
  });
});

describe('feedback form storage and export', () => {
  const memory = (): StorageAdapter => {
    const d = new Map<string, unknown>();
    return {
      getItem: async <T,>(k: string) => (d.has(k) ? (d.get(k) as T) : null),
      setItem: async <T,>(k: string, v: T) => { d.set(k, v); },
      removeItem: async (k: string) => { d.delete(k); },
      listKeys: async () => Array.from(d.keys()),
      clear: async () => d.clear(),
    };
  };

  it('validates, stores locally and exports self-describing JSON', async () => {
    const a = memory();
    await expect(addFeedback({ task: '', completed: 'yes', ease: 3, comment: '' }, a)).rejects.toThrow();
    await expect(addFeedback({ task: 'Verify a sample post', completed: 'maybe', ease: 3, comment: '' }, a)).rejects.toThrow();
    await addFeedback({ task: 'Verify a sample post', completed: 'yes', ease: 4, comment: 'clear', role: 'creator' }, a, new Date('2026-10-24T10:00:00Z'));
    const entries = await loadFeedback(a);
    expect(entries).toHaveLength(1);
    const exported = JSON.parse(feedbackExport(entries, new Date('2026-10-24T11:00:00Z')));
    expect(exported).toMatchObject({ kind: 'brand-gate-feedback', count: 1, exportedAt: '2026-10-24T11:00:00.000Z' });
    expect(exported.entries[0]).toMatchObject({ task: 'Verify a sample post', ease: 4, submittedAt: '2026-10-24T10:00:00.000Z' });
    await clearFeedback(a);
    expect(await loadFeedback(a)).toEqual([]);
  });
});
