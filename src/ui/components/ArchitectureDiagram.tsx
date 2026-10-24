'use client';
// Interactive architecture diagram (spec §16, §17). Every node maps to code that exists;
// `activeStep` takes a pipeline trace step name and highlights the matching node.
import React, { useState } from 'react';

export type NodeId =
  | 'sources' | 'gemini' | 'kb' | 'gates' | 'reviewerA' | 'reviewerB' | 'verifier' | 'crosscheck'
  | 'consensus' | 'verdict' | 'human' | 'publish' | 'storage';

interface NodeDef { id: NodeId; label: string; sub: string; x: number; y: number; w?: number; side: 'browser' | 'server' | 'external'; detail: string; code: string }

export const NODES: NodeDef[] = [
  { id: 'sources', label: 'Content sources', sub: 'Build chat · Verify input', x: 20, y: 120, side: 'browser', detail: 'A post arrives from the Build chat (generated) or the Verify form (pasted/uploaded). Post text is treated as untrusted data.', code: 'app/(shell)/build, app/(shell)/verify' },
  { id: 'gemini', label: 'Gemini', sub: 'generation · perception', x: 20, y: 20, side: 'external', detail: 'Gemini drafts posts (/api/llm/generate), images (/api/llm/image) and describes uploaded images as structured JSON (/api/llm/perceive). Images are re-encoded without EXIF first.', code: 'app/api/llm/{generate,image,perceive}' },
  { id: 'kb', label: 'Knowledge base', sub: '8 docs · facts · 47 rules', x: 200, y: 20, side: 'server', detail: 'Policy pack loaded from data/thrift-it, indexed into clauses and hashed. The routing map sends each reviewer only the clauses for its categories.', code: 'src/kb' },
  { id: 'gates', label: 'Deterministic gates', sub: 'rule engine · /api/gates', x: 200, y: 120, side: 'server', detail: 'Pure TypeScript rules: banned terms, facts and validity windows, claims, disclosure, accessibility, aspect ratio, contrast, injection. Hard-gate findings are final.', code: 'src/rules/engine.ts' },
  { id: 'reviewerA', label: 'Reviewer A', sub: 'XAI_MODEL slot', x: 380, y: 70, side: 'external', detail: 'OpenAI-compatible endpoint set by XAI_BASE_URL/XAI_MODEL (xAI, or Groq in the recorded runs). Independent soft-category review (tone, messaging, claims, regional) with routed clauses only; must cite clause ID and quote verbatim.', code: 'app/api/llm/review (provider xai)' },
  { id: 'reviewerB', label: 'Reviewer B', sub: 'NVIDIA', x: 380, y: 170, side: 'external', detail: 'Second independent reviewer; neither sees the other in round 0.', code: 'app/api/llm/review (provider nvidia)' },
  { id: 'verifier', label: 'Citation verifier', sub: 'drops hallucinations', x: 560, y: 120, side: 'browser', detail: 'Code checks the clause exists, the clause quote is in the clause and the post quote is in the stated field. Failures are discarded and counted.', code: 'src/verify/citationVerifier.ts' },
  { id: 'crosscheck', label: 'Cross-examination', sub: 'thorough mode', x: 560, y: 20, side: 'external', detail: 'Reviewer B agrees or disagrees with Reviewer A’s verified findings. Skipped in fast mode.', code: 'app/api/llm/crosscheck' },
  { id: 'consensus', label: 'Consensus', sub: 'agreed · disputed · single', x: 740, y: 120, side: 'browser', detail: 'Code labels findings agreed, disputed (zero penalty, shown to a human) or single-source.', code: 'src/verify/consensus.ts' },
  { id: 'verdict', label: 'Score & verdict', sub: 'code decides', x: 740, y: 220, side: 'browser', detail: 'Penalties 40/15/5, BLOCKED / REVISE / READY_FOR_HUMAN. No LLM decides the verdict.', code: 'src/verify/scoring.ts' },
  { id: 'human', label: 'Human approval', sub: 'Workflow · roles', x: 560, y: 260, side: 'browser', detail: 'Required approvers come from the escalation matrix; only a Manager can override a critical finding, with a logged justification.', code: 'src/workflow' },
  { id: 'publish', label: 'Mock publish', sub: 'simulated only', x: 380, y: 280, side: 'browser', detail: 'published_mock is a simulation; nothing is posted to Instagram.', code: 'src/workflow/actions.ts publishMock' },
  { id: 'storage', label: 'Storage', sub: 'IndexedDB · optional Supabase', x: 200, y: 260, side: 'browser', detail: 'Runs, workflow records and insight events live in the browser (IndexedDB). Optional Supabase only via the server route /api/storage.', code: 'src/storage' },
];

const EDGES: [NodeId, NodeId][] = [
  ['gemini', 'sources'], ['sources', 'gates'], ['kb', 'gates'], ['kb', 'reviewerA'], ['kb', 'reviewerB'],
  ['gates', 'reviewerA'], ['gates', 'reviewerB'], ['reviewerA', 'verifier'], ['reviewerB', 'verifier'],
  ['verifier', 'crosscheck'], ['crosscheck', 'consensus'], ['verifier', 'consensus'], ['consensus', 'verdict'],
  ['verdict', 'human'], ['human', 'publish'], ['human', 'storage'],
];

/** Maps trace step names emitted by usePipeline / governed pipeline to diagram nodes. */
export const STEP_TO_NODE: Record<string, NodeId[]> = {
  Ingest: ['sources'],
  Perceive: ['gemini'],
  Gates: ['gates', 'kb'],
  'Independent Review': ['reviewerA', 'reviewerB'],
  'Citation Verifier': ['verifier'],
  'Cross-Examination': ['crosscheck'],
  Consensus: ['consensus'],
  'Scoring & Verdict': ['verdict'],
  'Fix Suggestions': ['gemini'],
  Persist: ['storage'],
  Complete: ['human'],
};

const W = 130;
const H = 50;
const center = (n: NodeDef) => ({ cx: n.x + W / 2, cy: n.y + H / 2 });
const sideClass: Record<NodeDef['side'], string> = {
  browser: 'fill-white dark:fill-slate-900 stroke-indigo-400',
  server: 'fill-white dark:fill-slate-900 stroke-emerald-500',
  external: 'fill-white dark:fill-slate-900 stroke-amber-500',
};

export function ArchitectureDiagram({ activeStep, title = 'Brand Gate architecture' }: { activeStep?: string | null; title?: string }) {
  const [selected, setSelected] = useState<NodeId>('gates');
  const active = new Set(activeStep ? STEP_TO_NODE[activeStep] ?? [] : []);
  const sel = NODES.find((n) => n.id === selected)!;
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n])) as Record<NodeId, NodeDef>;

  return (
    <figure className="space-y-3" data-tour="architecture">
      <div className="overflow-x-auto">
        <svg viewBox="0 0 890 340" role="group" aria-label={`${title}. Select a component to read what it does.`} className="min-w-[640px] w-full h-auto">
          <title>{title}</title>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" className="fill-slate-400" />
            </marker>
          </defs>
          {EDGES.map(([a, b]) => {
            const p = center(byId[a]);
            const q = center(byId[b]);
            const lit = active.has(a) && active.has(b);
            return <line key={`${a}-${b}`} x1={p.cx} y1={p.cy} x2={q.cx} y2={q.cy} markerEnd="url(#arrow)" className={lit ? 'stroke-indigo-500' : 'stroke-slate-300 dark:stroke-slate-600'} strokeWidth={lit ? 2.5 : 1.25} />;
          })}
          {NODES.map((n) => {
            const isActive = active.has(n.id);
            const isSel = selected === n.id;
            return (
              <g
                key={n.id}
                role="button"
                tabIndex={0}
                aria-pressed={isSel}
                aria-label={`${n.label}: ${n.sub}${isActive ? ' (active in this run)' : ''}`}
                onClick={() => setSelected(n.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(n.id); } }}
                className="cursor-pointer focus:outline-none [&:focus-visible>rect]:stroke-[3px]"
              >
                <rect x={n.x} y={n.y} width={W} height={H} rx={10} className={`${sideClass[n.side]} ${isActive ? 'fill-indigo-100 dark:fill-indigo-900' : ''}`} strokeWidth={isSel || isActive ? 3 : 1.5} />
                {isActive && <circle cx={n.x + W - 8} cy={n.y + 8} r={4} className="fill-indigo-600 motion-safe:animate-pulse" />}
                <text x={n.x + W / 2} y={n.y + 21} textAnchor="middle" className="fill-slate-900 dark:fill-white text-[12px] font-semibold">{n.label}</text>
                <text x={n.x + W / 2} y={n.y + 37} textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-[10px]">{n.sub}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption className="text-xs space-y-1">
        <div className="flex flex-wrap gap-3 text-slate-600 dark:text-slate-300">
          <span><span aria-hidden className="inline-block w-3 h-3 align-middle rounded border-2 border-indigo-400 mr-1" />Runs in the browser</span>
          <span><span aria-hidden className="inline-block w-3 h-3 align-middle rounded border-2 border-emerald-500 mr-1" />Our server (Next.js API routes)</span>
          <span><span aria-hidden className="inline-block w-3 h-3 align-middle rounded border-2 border-amber-500 mr-1" />External model provider (called from our server)</span>
        </div>
        <div aria-live="polite" className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <strong className="text-slate-900 dark:text-white">{sel.label}</strong> — {sel.detail} <code className="text-[11px]">{sel.code}</code>
        </div>
      </figcaption>
    </figure>
  );
}
