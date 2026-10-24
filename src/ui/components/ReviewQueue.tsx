'use client';
// src/ui/components/ReviewQueue.tsx
/**
 * Workflow review queue. Reads and writes workflow records through
 * src/workflow/store (StorageAdapter), and performs every change through
 * src/workflow/actions, which re-check permissions — buttons are only hidden
 * as a convenience, never as the enforcement.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, GitCompare, History, MessageSquare, RotateCcw, ShieldAlert, Send, XCircle } from 'lucide-react';
import { Category, Finding, PostContent, Role, Severity } from '@/src/types';
import { CHANGE_REASONS, ChangeReason, PostState, WorkflowPost } from '@/src/workflow/types';
import { canApprove, canEdit, canOverride, canTransition, missingApprovals, openFindings, requiredApprovers, MIN_OVERRIDE_JUSTIFICATION } from '@/src/workflow/permissions';
import {
  ActionResult, addComment, addRevision, approve, overrideFinding, publishMock, requestChanges, revertToDraft, rollbackToReview, submitForReview,
} from '@/src/workflow/actions';
import { loadWorkflowPosts, resetWorkflow, saveWorkflowPost } from '@/src/workflow/store';
import { allRevisions, revisionWordDiff, summarizeWordDiff } from '@/src/workflow/diff';
import { appendInsightEvents } from '@/src/insights/store';
import { checkEventFromRun } from '@/src/insights/types';
import { computeScoreAndVerdict } from '@/src/verify/scoring';
import { useApp } from '@/src/ui/context/AppContext';

const STATES: PostState[] = ['draft', 'in_review', 'changes_requested', 'approved', 'published_mock'];
const SEVERITIES: Severity[] = ['critical', 'major', 'minor', 'info'];
const CATEGORIES: Category[] = ['tone', 'terminology', 'messaging', 'factual_accuracy', 'claims', 'visual', 'accessibility', 'disclosure', 'regional', 'security'];
const ROLES: Role[] = ['creator', 'reviewer', 'manager'];

const sevClass: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  major: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  minor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  info: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
};

const ClauseLink = ({ id }: { id: string }) => (
  <Link href={`/company#${id}`} className="font-mono text-indigo-600 dark:text-indigo-400 hover:underline">[{id}]</Link>
);

/** Who the post is waiting on: the role(s) that must act next. */
function waitingOn(p: WorkflowPost): Role[] {
  if (p.state === 'draft' || p.state === 'changes_requested') return ['creator'];
  if (p.state === 'in_review') {
    const critical = openFindings(p).some((f) => f.severity === 'critical');
    return critical ? ['manager'] : missingApprovals(p).map((m) => m.role);
  }
  if (p.state === 'approved') return ['manager'];
  return [];
}

export default function ReviewQueue() {
  const { role } = useApp();
  const user = `${role}-demo`;
  const [posts, setPosts] = useState<WorkflowPost[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [packHash, setPackHash] = useState<string>('');
  const [ruleClauses, setRuleClauses] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<{ state: string; severity: string; category: string; role: string }>({ state: '', severity: '', category: '', role: '' });

  useEffect(() => {
    loadWorkflowPosts()
      .then((r) => { setPosts(r.posts); if (r.recoveredFrom) setNotice(r.recoveredFrom); })
      .catch((e) => setLoadError(`Could not load workflow records: ${e.message}`));
    fetch('/api/pack')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((p) => { setPackHash(p.hash); setRuleClauses(p.rules.map((x: { clause: string }) => x.clause)); })
      .catch((e) => setLoadError(`Could not load the policy pack (needed for the audit pack hash): ${e.message}`));
  }, []);

  const filtered = useMemo(() => {
    if (!posts) return [];
    return posts.filter((p) => {
      const open = openFindings(p);
      if (filters.state && p.state !== filters.state) return false;
      if (filters.severity && !open.some((f) => f.severity === filters.severity)) return false;
      if (filters.category && !open.some((f) => f.category === filters.category)) return false;
      if (filters.role && !waitingOn(p).includes(filters.role as Role)) return false;
      return true;
    });
  }, [posts, filters]);

  const selected = posts?.find((p) => p.id === selectedId) ?? null;

  /** Run an action, persist the result, record Insights events, surface permission errors. */
  const run = useCallback(
    async (fn: () => ActionResult | Promise<ActionResult>) => {
      setActionError(null);
      if (!packHash) { setActionError('Policy pack not loaded yet; actions need its hash for the audit log.'); return false; }
      try {
        const res = await fn();
        setPosts(await saveWorkflowPost(res.post));
        await appendInsightEvents(res.events);
        return true;
      } catch (e: unknown) {
        setActionError(e instanceof Error ? e.message : String(e));
        return false;
      }
    },
    [packHash]
  );

  const ctx = { role, user, packHash };

  if (loadError && !posts) {
    return <div role="alert" className="p-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm">{loadError}</div>;
  }
  if (!posts) return <div className="text-sm text-slate-600 py-8 text-center dark:text-slate-400">Loading workflow records…</div>;

  return (
    <div className="space-y-4" data-tour="review-queue">
      {notice && <div className="text-xs p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300">{notice}</div>}
      {loadError && <div role="alert" className="text-xs p-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300">{loadError}</div>}

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {([
          ['state', 'State', STATES],
          ['severity', 'Open severity', SEVERITIES],
          ['category', 'Open category', CATEGORIES],
          ['role', 'Waiting on role', ROLES],
        ] as const).map(([key, label, options]) => (
          <label key={key} className="text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-1">
            {label}
            <select
              value={filters[key]}
              onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
              className="px-2 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
            >
              <option value="">All</option>
              {options.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        ))}
        <button
          onClick={async () => { if (confirm('Discard all workflow changes in this browser and restore the 6 sample posts?')) { setPosts(await resetWorkflow()); setSelectedId(null); } }}
          className="ml-auto text-xs flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset sample data
        </button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
        {/* Queue */}
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-sm text-slate-600 dark:text-slate-400 p-6 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              No posts match these filters. Clear a filter, or create one from Build.
            </div>
          )}
          {filtered.map((p) => {
            const open = openFindings(p);
            return (
              <button
                key={p.id}
                onClick={() => { setSelectedId(p.id); setActionError(null); }}
                className={`w-full text-left p-3 rounded-xl border transition ${selectedId === p.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-800 dark:text-white truncate">{p.title}</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 shrink-0">{p.state}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                  {p.isSampleData && <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">sample data</span>}
                  <span>v{p.currentRevision.versionNumber} · score {p.currentRevision.score}</span>
                  {open.map((f) => <span key={f.id} className={`px-1.5 py-0.5 rounded ${sevClass[f.severity]}`}>{f.severity} {f.clauseId}</span>)}
                  {waitingOn(p).length > 0 && <span>· waiting on {waitingOn(p).join(' + ')}</span>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        {selected ? (
          <PostDetail key={`${selected.id}-v${selected.currentRevision.versionNumber}`} post={selected} ctx={ctx} run={run} actionError={actionError} ruleClauses={ruleClauses} />
        ) : (
          <div className="text-sm text-slate-600 dark:text-slate-400 p-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
            Select a post to see its findings, approvals, comments, revisions and audit log.
          </div>
        )}
      </div>
    </div>
  );
}

type Run = (fn: () => ActionResult | Promise<ActionResult>) => Promise<boolean>;

function PostDetail({ post, ctx, run, actionError, ruleClauses }: { post: WorkflowPost; ctx: { role: Role; user: string; packHash: string }; run: Run; actionError: string | null; ruleClauses: string[] }) {
  const { role } = ctx;
  const [changeReason, setChangeReason] = useState<ChangeReason>('tone');
  const [changeText, setChangeText] = useState('');
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [comment, setComment] = useState('');
  const [findingComment, setFindingComment] = useState<{ id: string; text: string } | null>(null);
  const [editing, setEditing] = useState<PostContent | null>(null);
  const [busy, setBusy] = useState(false);
  const revisions = allRevisions(post);
  const [cmpA, setCmpA] = useState(revisions.length > 1 ? revisions[revisions.length - 2].id : revisions[0].id);
  const [cmpB, setCmpB] = useState(revisions[revisions.length - 1].id);

  const overridden = new Map((post.overrides ?? []).map((o) => [o.findingId, o]));
  const required = requiredApprovers(openFindings(post));
  const approvedRoles = new Set((post.approvals ?? []).map((a) => a.role));
  const approveCheck = canApprove(post, role);

  const saveRevision = async () => {
    if (!editing) return;
    setBusy(true);
    const ok = await run(async () => {
      const res = await fetch('/api/gates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ post: editing }) });
      if (!res.ok) throw new Error(`Gate check failed (HTTP ${res.status}); revision not saved.`);
      const gate: { findings: Finding[]; gatesFailed: string[] } = await res.json();
      const findings = gate.findings.map((f, i) => ({ ...f, id: `${post.id}-v${post.currentRevision.versionNumber + 1}-f${i + 1}` }));
      const { verdict } = computeScoreAndVerdict(findings, gate.gatesFailed);
      const diffSummary = summarizeWordDiff(revisionWordDiff(post.currentRevision, { ...post.currentRevision, post: editing }));
      const result = addRevision(post, ctx, { content: editing, findings, verdict, diffSummary });
      await appendInsightEvents([checkEventFromRun({ origin: 'workflow', pass: 'after_fix', verdict, findings, checkedClauseIds: ruleClauses, role })]);
      return result;
    });
    setBusy(false);
    if (ok) setEditing(null);
  };

  const revA = revisions.find((r) => r.id === cmpA);
  const revB = revisions.find((r) => r.id === cmpB);
  const diffs = revA && revB ? revisionWordDiff(revA, revB) : [];

  const btn = 'px-3 py-1.5 text-xs font-semibold rounded-lg transition disabled:opacity-40';

  return (
    <div className="space-y-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-bold text-lg text-slate-900 dark:text-white">{post.title}</h2>
          {post.isSampleData && <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">SAMPLE DATA</span>}
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400">State <strong>{post.state}</strong> · author {post.author} · v{post.currentRevision.versionNumber} · score {post.currentRevision.score} ({post.currentRevision.verdict.status})</p>
      </div>

      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">
        {post.currentRevision.post.caption}
        <div className="mt-1 text-xs text-indigo-600 dark:text-indigo-300">{post.currentRevision.post.hashtags.join(' ')}</div>
        <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Alt text: {post.currentRevision.post.altText || <em>missing</em>}</div>
      </div>

      {/* Required approvers */}
      <section aria-label="Required approvers">
        <h3 className="text-xs font-bold uppercase text-slate-600 mb-1 dark:text-slate-400">Required approvers (escalation matrix)</h3>
        <ul className="flex flex-wrap gap-2">
          {required.map((r) => (
            <li key={r.role} className={`text-xs px-2 py-1 rounded-lg border ${approvedRoles.has(r.role) ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
              {approvedRoles.has(r.role) ? <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" /> : null}
              <strong className="capitalize">{r.role}</strong> — <ClauseLink id={r.clause} /> {r.because}
            </li>
          ))}
        </ul>
      </section>

      {/* Actions */}
      <section aria-label="Actions" className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {canTransition(post.state, 'in_review', role, post).allowed && post.state !== 'approved' && (
            <button className={`${btn} bg-indigo-600 text-white hover:bg-indigo-500`} onClick={() => run(() => submitForReview(post, ctx))}><Send className="inline w-3.5 h-3.5 mr-1" />Submit for review</button>
          )}
          {post.state === 'in_review' && (
            <button className={`${btn} bg-emerald-700 text-white hover:bg-emerald-500`} disabled={!approveCheck.allowed} title={approveCheck.reason} onClick={() => run(() => approve(post, ctx))}>
              <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />Approve as {role}
            </button>
          )}
          {canTransition(post.state, 'published_mock', role, post).allowed && (
            <button className={`${btn} bg-fuchsia-700 text-white hover:bg-fuchsia-500`} onClick={() => run(() => publishMock(post, ctx))}>Publish (mock — simulated, nothing is posted)</button>
          )}
          {post.state === 'in_review' && canTransition('in_review', 'draft', role).allowed && (
            <button className={`${btn} border border-slate-300 dark:border-slate-700`} onClick={() => run(() => revertToDraft(post, ctx))}>Revert to draft</button>
          )}
          {post.state === 'approved' && canTransition('approved', 'in_review', role).allowed && (
            <button className={`${btn} border border-slate-300 dark:border-slate-700`} onClick={() => run(() => rollbackToReview(post, ctx))}>Roll back to review</button>
          )}
          {canEdit(post, role) && !editing && (
            <button className={`${btn} border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300`} onClick={() => setEditing({ ...post.currentRevision.post })}>Edit → new revision</button>
          )}
        </div>
        {post.state === 'in_review' && !approveCheck.allowed && <p className="text-xs text-slate-600 dark:text-slate-400">Approve unavailable: {approveCheck.reason}</p>}

        {post.state === 'in_review' && canTransition('in_review', 'changes_requested', role).allowed && (
          <div className="flex flex-wrap items-end gap-2 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
            <label className="text-xs flex flex-col gap-1">Reason
              <select value={changeReason} onChange={(e) => setChangeReason(e.target.value as ChangeReason)} className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm">
                {CHANGE_REASONS.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </label>
            <label className="text-xs flex flex-col gap-1 flex-1 min-w-[12rem]">What needs to change
              <input value={changeText} onChange={(e) => setChangeText(e.target.value)} className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm" />
            </label>
            <button className={`${btn} bg-amber-700 text-white hover:bg-amber-400`} disabled={!changeText.trim()} onClick={async () => { if (await run(() => requestChanges(post, ctx, { reason: changeReason, text: changeText }))) setChangeText(''); }}>
              Request changes
            </button>
          </div>
        )}

        {actionError && <div role="alert" className="text-xs p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"><XCircle className="inline w-3.5 h-3.5 mr-1" />{actionError}</div>}
      </section>

      {editing && (
        <section aria-label="New revision" className="space-y-2 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <h3 className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">New revision (re-checked by the gate engine on save)</h3>
          <textarea value={editing.caption} onChange={(e) => setEditing({ ...editing, caption: e.target.value })} rows={4} aria-label="Caption" className="w-full p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm" />
          <input value={editing.hashtags.join(' ')} onChange={(e) => setEditing({ ...editing, hashtags: e.target.value.split(/\s+/).filter(Boolean) })} aria-label="Hashtags" className="w-full p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm" />
          <input value={editing.altText ?? ''} onChange={(e) => setEditing({ ...editing, altText: e.target.value })} aria-label="Alt text" className="w-full p-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm" />
          <div className="flex gap-2">
            <button className={`${btn} bg-indigo-600 text-white`} disabled={busy} onClick={saveRevision}>{busy ? 'Checking…' : 'Save revision'}</button>
            <button className={`${btn} border border-slate-300 dark:border-slate-700`} onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </section>
      )}

      {/* Findings */}
      <section aria-label="Findings">
        <h3 className="text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1 dark:text-slate-400"><ShieldAlert className="w-3.5 h-3.5" />Findings on v{post.currentRevision.versionNumber}</h3>
        {post.currentRevision.findings.length === 0 && <p className="text-xs text-emerald-700 dark:text-emerald-300">No findings on the current revision.</p>}
        <ul className="space-y-2">
          {post.currentRevision.findings.map((f) => {
            const ov = overridden.get(f.id);
            const fComments = post.comments.filter((c) => c.findingId === f.id);
            const ovCheck = canOverride(f, role, justification);
            return (
              <li key={f.id} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`px-1.5 py-0.5 rounded font-semibold ${sevClass[f.severity]}`}>{f.severity}</span>
                  <span className="text-slate-600 dark:text-slate-400">{f.category}</span>
                  <ClauseLink id={f.clauseId} />
                  <span className="text-slate-600 dark:text-slate-400">{f.source} · {f.agreement}</span>
                  {ov && <span className="px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">overridden by {ov.role}: “{ov.justification}”</span>}
                </div>
                <div className="text-slate-700 dark:text-slate-200">“{f.postQuote}” — {f.explanation}</div>
                {f.clauseQuote && <div className="text-slate-600 italic dark:text-slate-400">Clause: “{f.clauseQuote}”</div>}
                {fComments.map((c) => <div key={c.id} className="pl-2 border-l-2 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"><strong className="capitalize">{c.role}</strong>: {c.text}</div>)}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button className="text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => setFindingComment({ id: f.id, text: '' })}>Comment</button>
                  {!ov && role !== 'creator' && post.state !== 'approved' && post.state !== 'published_mock' && !(f.severity === 'critical' && role !== 'manager') && (
                    <button className="text-violet-600 dark:text-violet-400 hover:underline" onClick={() => { setOverrideFor(f.id); setJustification(''); }}>Override…</button>
                  )}
                  {!ov && f.severity === 'critical' && role !== 'manager' && <span className="text-slate-600 dark:text-slate-400">Only a Manager can override (EM-007)</span>}
                </div>
                {findingComment?.id === f.id && (
                  <div className="flex gap-2">
                    <input autoFocus value={findingComment.text} onChange={(e) => setFindingComment({ id: f.id, text: e.target.value })} aria-label="Finding comment" className="flex-1 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
                    <button className={`${btn} bg-indigo-600 text-white`} onClick={async () => { if (await run(() => addComment(post, ctx, findingComment.text, f.id))) setFindingComment(null); }}>Post</button>
                  </div>
                )}
                {overrideFor === f.id && (
                  <div className="space-y-1">
                    <textarea autoFocus value={justification} onChange={(e) => setJustification(e.target.value)} rows={2} aria-label="Override justification" placeholder={`Written justification (min ${MIN_OVERRIDE_JUSTIFICATION} characters, logged permanently)`} className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700" />
                    <div className="flex items-center gap-2">
                      <button className={`${btn} bg-violet-600 text-white`} disabled={!ovCheck.allowed} title={ovCheck.reason} onClick={async () => { if (await run(() => overrideFinding(post, ctx, f.id, justification))) setOverrideFor(null); }}>Confirm override</button>
                      <span className="text-slate-600 dark:text-slate-400">{ovCheck.allowed ? 'Will be logged to the audit trail and Insights.' : ovCheck.reason}</span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Post comments */}
      <section aria-label="Comments">
        <h3 className="text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1 dark:text-slate-400"><MessageSquare className="w-3.5 h-3.5" />Post comments</h3>
        <ul className="space-y-1 text-xs">
          {post.comments.filter((c) => !c.findingId).map((c) => (
            <li key={c.id} className="text-slate-700 dark:text-slate-200"><strong className="capitalize">{c.role}</strong> <span className="text-slate-600 dark:text-slate-400">{c.timestamp.slice(0, 16).replace('T', ' ')}</span>: {c.text}</li>
          ))}
          {post.comments.filter((c) => !c.findingId).length === 0 && <li className="text-slate-600 dark:text-slate-400">No comments yet.</li>}
        </ul>
        <div className="flex gap-2 mt-2">
          <input value={comment} onChange={(e) => setComment(e.target.value)} aria-label="Post comment" placeholder={`Comment as ${role}`} className="flex-1 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm" />
          <button className={`${btn} bg-indigo-600 text-white`} disabled={!comment.trim()} onClick={async () => { if (await run(() => addComment(post, ctx, comment))) setComment(''); }}>Post</button>
        </div>
      </section>

      {(post.changeRequests ?? []).length > 0 && (
        <section aria-label="Change requests">
          <h3 className="text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1 dark:text-slate-400"><AlertTriangle className="w-3.5 h-3.5" />Change requests</h3>
          <ul className="space-y-1 text-xs">
            {(post.changeRequests ?? []).map((c, i) => (
              <li key={i} className="text-slate-700 dark:text-slate-200"><strong className="capitalize">{c.role}</strong> [{c.reason.replace('_', ' ')}] {c.text} {c.clauseIds.map((id) => <ClauseLink key={id} id={id} />)}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Revisions */}
      <section aria-label="Revisions">
        <h3 className="text-xs font-bold uppercase text-slate-600 mb-1 flex items-center gap-1 dark:text-slate-400"><History className="w-3.5 h-3.5" />Revision history</h3>
        <ul className="text-xs space-y-0.5 mb-2">
          {revisions.map((r) => (
            <li key={r.id} className="text-slate-600 dark:text-slate-300">v{r.versionNumber} · score <strong>{r.score}</strong> ({r.verdict.status}) · {r.findings.length} finding(s) · {r.author}{r.diffSummary ? ` · ${r.diffSummary}` : ''}</li>
          ))}
        </ul>
        {revisions.length > 1 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <GitCompare className="w-3.5 h-3.5" />
              {[['Left', cmpA, setCmpA], ['Right', cmpB, setCmpB]].map(([label, val, set]) => (
                <label key={label as string} className="flex items-center gap-1">{label as string}
                  <select value={val as string} onChange={(e) => (set as (v: string) => void)(e.target.value)} className="px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    {revisions.map((r) => <option key={r.id} value={r.id}>v{r.versionNumber} (score {r.score})</option>)}
                  </select>
                </label>
              ))}
            </div>
            {revA && revB && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[revA, revB].map((r, side) => (
                  <div key={side} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 space-y-1">
                    <div className="font-semibold">v{r.versionNumber} · score {r.score} · {r.verdict.status}</div>
                    {diffs.map((d) => (
                      <div key={d.field}>
                        <span className="text-slate-600 dark:text-slate-400">{d.field}: </span>
                        {d.parts.filter((p) => (side === 0 ? !p.added : !p.removed)).map((p, i) => (
                          <span key={i} className={p.removed ? 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 line-through' : p.added ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' : ''}>{p.value}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-slate-600 dark:text-slate-400">Only one revision so far — edit the post to create another and compare.</p>
        )}
      </section>

      {/* Audit log */}
      <section aria-label="Audit log">
        <h3 className="text-xs font-bold uppercase text-slate-600 mb-1 dark:text-slate-400">Audit log (append-only)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead><tr className="text-left text-slate-600 dark:text-slate-400"><th className="pr-2">When</th><th className="pr-2">Who</th><th className="pr-2">Role</th><th className="pr-2">Action</th><th className="pr-2">Before → After</th><th className="pr-2">Details</th><th>Pack</th></tr></thead>
            <tbody>
              {post.auditLog.map((a) => (
                <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800 align-top text-slate-700 dark:text-slate-300">
                  <td className="pr-2 whitespace-nowrap">{a.timestamp.slice(0, 16).replace('T', ' ')}</td>
                  <td className="pr-2">{a.user}</td>
                  <td className="pr-2 capitalize">{a.role}</td>
                  <td className="pr-2 font-mono">{a.action}</td>
                  <td className="pr-2">{a.beforeState ?? '—'} → {a.afterState ?? '—'}</td>
                  <td className="pr-2">{a.details}</td>
                  <td className="font-mono">{a.packHash}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
