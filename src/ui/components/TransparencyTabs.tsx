'use client';
// Transparency section (spec §17): nine tabs. Content describes the code as it is; unknown facts are marked for the author.
import React, { useEffect, useRef, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { ArchitectureDiagram } from '@/src/ui/components/ArchitectureDiagram';
import { SafeMarkdown } from '@/src/ui/components/SafeMarkdown';
import { AiBadge } from '@/src/ui/components/AiBadge';
import { FeedbackEntry, FeedbackSchema, addFeedback, clearFeedback, feedbackExport, loadFeedback } from '@/src/feedback/store';
import { useApp } from '@/src/ui/context/AppContext';

export const TABS = [
  ['architecture', 'Architecture'],
  ['models', 'Models & services'],
  ['disclosure', 'AI disclosure'],
  ['dataflow', 'Data flow'],
  ['responsible', 'Responsible design'],
  ['limitations', 'Known limitations'],
  ['testing', 'User testing'],
  ['team', 'Team & contribution'],
  ['source', 'Source & submission'],
] as const;
type TabId = (typeof TABS)[number][0];

const TODO = ({ children = 'Author to fill with real results' }: { children?: React.ReactNode }) => (
  <span className="inline-block px-2 py-0.5 rounded border border-dashed border-amber-500 text-amber-800 dark:text-amber-200 text-xs font-semibold">{children}</span>
);

const Table = ({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs text-left">
      <thead><tr className="border-b border-slate-200 dark:border-slate-700">{head.map((h) => <th key={h} scope="col" className="py-2 pr-3 font-semibold text-slate-800 dark:text-slate-100">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-slate-100 dark:border-slate-800 align-top">{r.map((c, j) => <td key={j} className="py-2 pr-3 text-slate-700 dark:text-slate-300">{c}</td>)}</tr>)}</tbody>
    </table>
  </div>
);

export function TransparencyTabs({ decisions, limitations }: { decisions: string; limitations: string }) {
  const [tab, setTab] = useState<TabId>('architecture');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKey = (e: React.KeyboardEvent, i: number) => {
    const n = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i - 1 + TABS.length) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault();
    setTab(TABS[n][0]);
    refs.current[TABS[n][0]]?.focus();
  };

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Transparency topics" className="flex flex-wrap gap-2">
        {TABS.map(([id, label], i) => (
          <button
            key={id}
            ref={(el) => { refs.current[id] = el; }}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            tabIndex={tab === id ? 0 : -1}
            onClick={() => setTab(id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border ${tab === id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-slate-200 space-y-4">
        {tab === 'architecture' && <ArchitectureTab decisions={decisions} />}
        {tab === 'models' && <ModelsTab />}
        {tab === 'disclosure' && <DisclosureTab />}
        {tab === 'dataflow' && <DataFlowTab />}
        {tab === 'responsible' && <ResponsibleTab />}
        {tab === 'limitations' && <SafeMarkdown source={limitations} />}
        {tab === 'testing' && <UserTestingTab />}
        {tab === 'team' && <TeamTab />}
        {tab === 'source' && <SourceTab />}
      </div>
    </div>
  );
}

function ArchitectureTab({ decisions }: { decisions: string }) {
  return (
    <>
      <p>Order of authority: deterministic gates &gt; verified LLM findings &gt; human reviewer, with the human always holding the publish decision. The diagram shows every component that exists in the code; select one for its source location.</p>
      <ArchitectureDiagram />
      <h3 className="font-bold text-slate-900 dark:text-white">Technical decisions (rendered from docs/DECISIONS.md)</h3>
      <div className="max-h-[28rem] overflow-y-auto pr-2"><SafeMarkdown source={decisions} /></div>
    </>
  );
}

function ModelsTab() {
  const { providers } = useApp();
  const retention = <TODO>Not verified — author to confirm from the provider’s current terms</TODO>;
  return (
    <>
      <p>Model IDs are never hard-coded: each comes from the environment variable named below. Values and keys are never sent to the browser; the status column only says whether both the key and the model variable are set on the server.</p>
      <Table
        head={['Provider', 'Model env var', 'Used for', 'Data sent', 'Status', 'Retention']}
        rows={[
          ['Google Gemini (text)', <code key="g">GEMINI_TEXT_MODEL</code>, 'Post drafting (Build), fix suggestions, Compare columns A/B, clarification drafts', 'Brief, routed clause texts and active facts (draft); post + findings (fix); brief + all 8 policy docs (Compare B); one clause + evidence (clarify)', providers.gemini, retention],
          ['Google Gemini (vision)', <code key="v">GEMINI_VISION_MODEL</code>, 'Perceive: structured description of an uploaded image', 'Re-encoded JPEG (max 1080 px, EXIF/GPS removed)', providers.gemini, retention],
          ['Google Gemini (image)', <code key="i">GEMINI_IMAGE_MODEL</code>, 'Base image for Build drafts', 'Image prompt text only', 'needs GEMINI_API_KEY + GEMINI_IMAGE_MODEL (not shown in the status chip)', retention],
          ['xAI Grok', <code key="x">XAI_MODEL</code>, 'Reviewer A; fallback drafter if Gemini takes over 10 s', 'Post + clauses routed to tone/terminology/messaging/claims/regional', providers.xai, retention],
          ['NVIDIA', <code key="n">NVIDIA_MODEL</code>, 'Reviewer B; cross-examination in thorough mode', 'Post + routed clauses; Reviewer A’s verified findings (cross-check)', providers.nvidia, retention],
          ['Upstash Redis (optional)', <code key="u">UPSTASH_REDIS_REST_URL</code>, 'Rate-limit and daily-budget counters', 'Counter keys containing the client IP and the date; no post content', 'server-only', retention],
          ['Supabase (optional)', <code key="s">SUPABASE_URL</code>, 'Shared key-value storage instead of browser IndexedDB', 'Workflow records, insight events, drafts (only if enabled)', 'server-only', retention],
        ]}
      />
      <p className="text-xs">The verdict is never decided by a model: scoring and BLOCKED/REVISE/READY are computed in <code>src/verify/scoring.ts</code>. The intent-preservation check in this build is deterministic (required-element survival), not an LLM judge.</p>
    </>
  );
}

function DisclosureTab() {
  return (
    <>
      <p>Every artefact a model produced carries a badge like <AiBadge /> where it is shown.</p>
      <Table
        head={['Artefact', 'Produced by', 'Where it is badged']}
        rows={[
          ['Draft caption, hashtags, alt text, voice-over script', 'Gemini (or xAI fallback)', 'Build draft card and final card'],
          ['Base image', 'Gemini image model; wordmark and offer band composited in the browser', 'Build draft card'],
          ['Fix suggestions', 'Gemini (rule dictionary when offline)', 'Verify → Fix Suggestions'],
          ['Reviewer findings', 'xAI and NVIDIA, then verified by code', 'Verify findings show source model and agreement'],
          ['Clarification suggestions', 'Gemini, or a deterministic template when offline (labelled as such)', 'Insights → Ambiguity Index'],
          ['Benchmark labels and synthetic posts', 'Written with AI assistance; not human-reviewed (0/60)', 'Compare → Benchmark'],
          ['Illustrative Compare fixtures', 'Hand-written examples, not model output', 'Replay badge “Illustrative fixture”'],
        ]}
      />
    </>
  );
}

function DataFlowTab() {
  return (
    <>
      <p>What leaves your browser, and where it goes. Each reviewer receives only the clauses its categories need (routing map in <code>src/kb/routing.ts</code>); call logs record clause IDs, not clause text or full prompts.</p>
      <Table
        head={['Step', 'Leaves the browser?', 'Goes to', 'Notes']}
        rows={[
          ['Ingest & purpose extraction', 'No', '—', 'Deterministic, in the browser'],
          ['Perceive (image)', 'Yes', 'Our server → Gemini vision', 'Server re-encodes the image and strips EXIF/GPS before forwarding'],
          ['Deterministic gates', 'Yes', 'Our server (/api/gates)', 'No model involved'],
          ['Independent review', 'Yes', 'Our server → xAI and NVIDIA', 'Post wrapped in <post> delimiters as untrusted data, routed clauses only'],
          ['Citation verifier, consensus, scoring', 'No', '—', 'Pure TypeScript in the browser'],
          ['Cross-examination (thorough)', 'Yes', 'Our server → NVIDIA', 'Reviewer A’s verified findings + routed clauses'],
          ['Build drafting / image', 'Yes', 'Our server → Gemini (xAI fallback)', 'Brief, routed clauses, active facts; image prompt'],
          ['Compare live run', 'Yes', 'Our server → Gemini, xAI, NVIDIA', 'Column B sends all 8 policy documents by design (that is what it measures)'],
          ['Workflow, comments, audit log, insights, feedback', 'No (default)', 'Browser IndexedDB', 'With NEXT_PUBLIC_STORAGE_MODE=supabase: our server (/api/storage) → Supabase'],
          ['Replay mode', 'No model calls', 'Our server (/api/replay) reads recorded files', 'Works without any API key'],
        ]}
      />
    </>
  );
}

function ResponsibleTab() {
  const items: [string, string][] = [
    ['Human oversight', 'No verdict means “published”. Publishing is a separate, Manager-only, simulated step after the escalation-matrix approvers have signed off.'],
    ['No auto-publish', 'There is no code path that posts to Instagram; published_mock is a simulation and is labelled as one.'],
    ['Override logging', 'Overrides need a written justification (≥20 characters); critical findings can only be overridden by a Manager. Every action is appended to the audit log with role, before/after state, timestamp and policy pack hash.'],
    ['Confidentiality', 'Minimum-necessary routing of clauses; keys stay on the server; uploaded images are re-encoded without metadata; workflow data stays in the browser unless Supabase is enabled.'],
    ['Prompt-injection handling', 'Posts are wrapped as untrusted data in every prompt, and a deterministic rule flags instructions aimed at the reviewer (e.g. “ignore previous instructions”) as a critical security finding.'],
    ['Hallucination control', 'Reviewer findings must quote the clause and the post verbatim; code drops any that do not match and counts them.'],
    ['Bias and failure modes', 'Reviewers can over-flag Hinglish or informal tone; disputes carry zero penalty and go to a human. Deterministic rules miss paraphrases (see Known limitations). Synthetic benchmark data is small and self-labelled.'],
    ['Abuse controls', 'Access code (httpOnly cookie), per-IP rate limit, daily call budget, request size limits and schema validation on every API route.'],
  ];
  return <dl className="space-y-3">{items.map(([t, d]) => <div key={t}><dt className="font-semibold text-slate-900 dark:text-white">{t}</dt><dd>{d}</dd></div>)}</dl>;
}

function UserTestingTab() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [form, setForm] = useState({ task: '', completed: 'yes', ease: 3, comment: '' });
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const { role } = useApp();

  useEffect(() => {
    loadFeedback().then(setEntries).catch(() => setStatus('Could not read saved feedback from browser storage.'));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = FeedbackSchema.safeParse({ ...form, role });
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message));
      return;
    }
    setErrors([]);
    try {
      setEntries(await addFeedback(parsed.data));
      setForm({ task: '', completed: 'yes', ease: 3, comment: '' });
      setStatus('Thank you — saved in this browser.');
    } catch {
      setStatus('Saving failed; your browser may block storage.');
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([feedbackExport(entries)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `brand-gate-feedback-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <h3 className="font-bold text-slate-900 dark:text-white">User-testing results</h3>
      <p>No user testing results are reported here yet. The fields below are a template for real sessions; nothing in them is invented.</p>
      <Table
        head={['Field', 'Result']}
        rows={[
          ['Participants (number, roles)', <TODO key="1" />],
          ['Tasks attempted', <TODO key="2" />],
          ['Task success rate', <TODO key="3" />],
          ['Representative quotes (with consent)', <TODO key="4" />],
          ['Changes made in response', <TODO key="5" />],
        ]}
      />
      <h3 className="font-bold text-slate-900 dark:text-white pt-2">Give feedback</h3>
      <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2 text-xs">
        <label className="flex flex-col gap-1">Which task did you try? *
          <select required value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} aria-invalid={errors.length > 0 && !form.task} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
            <option value="">Choose…</option>
            {['Watch the recorded demo', 'Verify a sample post', 'Generate a post in Build', 'Approve or reject in Workflow', 'Read Insights', 'Compare the three systems'].map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend>Did you complete it?</legend>
          <div className="flex gap-3">{(['yes', 'partly', 'no'] as const).map((v) => <label key={v} className="flex items-center gap-1"><input type="radio" name="completed" value={v} checked={form.completed === v} onChange={() => setForm({ ...form, completed: v })} />{v}</label>)}</div>
        </fieldset>
        <label className="flex flex-col gap-1">How easy was it? (1 = very hard, 5 = very easy)
          <input type="range" min={1} max={5} value={form.ease} onChange={(e) => setForm({ ...form, ease: Number(e.target.value) })} aria-valuetext={`${form.ease} of 5`} />
          <span aria-hidden>{form.ease} / 5</span>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">Comments (optional)
          <textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} rows={3} maxLength={2000} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700" />
        </label>
        {errors.length > 0 && <div role="alert" className="sm:col-span-2 text-red-700 dark:text-red-300">{errors.join(' ')}</div>}
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold">Save feedback</button>
          <button type="button" onClick={download} disabled={entries.length === 0} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-50"><Download className="w-3.5 h-3.5" aria-hidden />Export JSON ({entries.length})</button>
          <button type="button" onClick={async () => { await clearFeedback(); setEntries([]); setStatus('Saved feedback cleared.'); }} disabled={entries.length === 0} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" aria-hidden />Clear</button>
          <span role="status" aria-live="polite">{status}</span>
        </div>
      </form>
      <p className="text-xs">Feedback is stored only in this browser (IndexedDB) and leaves it only when you export the JSON file.</p>
    </>
  );
}

function TeamTab() {
  return (
    <>
      <p>The build brief describes this as a solo build by Bless Mascarenhas. <TODO>Author to confirm attribution</TODO> — commits in this repository are recorded under more than one git author name, and AI coding assistants (including Claude) wrote substantial parts of the code, tests and documentation.</p>
      <Table
        head={['Area', 'Main locations']}
        rows={[
          ['Policy pack and knowledge base', 'data/thrift-it, src/kb'],
          ['Deterministic rule engine', 'src/rules'],
          ['LLM layer, prompts, gatekeeper', 'src/llm, app/api/llm'],
          ['Verify pipeline, verifier, consensus, scoring', 'src/pipeline, src/verify'],
          ['Build chat, governance loop, canvas compositing', 'app/(shell)/build, src/build, src/canvas'],
          ['Workflow and Insights', 'src/workflow, src/insights'],
          ['Compare, benchmark, calibration, replay', 'src/compare, src/benchmark, src/replay, scripts'],
          ['Start here, Transparency, accessibility', 'app/(shell)/start, app/(shell)/transparency, src/ui'],
        ]}
      />
    </>
  );
}

function SourceTab() {
  return (
    <>
      <Table
        head={['Item', 'Value']}
        rows={[
          ['Repository', <a key="r" href="https://github.com/Bless-Mascarenhas/brand-gate" className="text-indigo-700 dark:text-indigo-300 underline" rel="noreferrer" target="_blank">github.com/Bless-Mascarenhas/brand-gate</a>],
          ['Deployed URL', <TODO key="d">Not deployed yet — author to fill</TODO>],
          ['Run locally', <code key="l">npm ci; npm run dev</code>],
          ['Run all checks', <code key="c">npm run check</code>],
          ['Rerun the benchmark', <code key="b">npm run benchmark</code>],
          ['Rerun calibration (dev split only)', <code key="k">npm run calibrate</code>],
          ['Record or validate replays', <code key="p">npm run record-replay (-- --check)</code>],
        ]}
      />
      <p className="text-xs">Full instructions are in README.md.</p>
    </>
  );
}
