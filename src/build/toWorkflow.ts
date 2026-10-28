import { PostContent, Role, Verdict } from '@/src/types';
import { GovernanceLoopOutput } from '@/src/build/governanceLoop';
import { CheckEvent, checkEventFromRun } from '@/src/insights/types';
import { Revision, WorkflowPost } from '@/src/workflow/types';

/** A new draft workflow post whose revision history is the loop's iterations. */
export function workflowPostFromBuild(out: GovernanceLoopOutput, opts: { packHash: string; role: Role; now?: string; title?: string }): WorkflowPost {
  const now = opts.now ?? new Date().toISOString();
  const id = `build-${Date.parse(now)}`;
  const user = opts.role === 'creator' ? 'Creator' : opts.role === 'manager' ? 'Manager' : 'Reviewer';
  const revisions: Revision[] = out.iterations.map((it) => ({
    id: `${id}-v${it.iteration}`,
    postId: id,
    versionNumber: it.iteration,
    post: it.post,
    score: it.score,
    verdict: it.verdict,
    findings: it.findings,
    diffSummary: it.summary,
    author: `governance loop (iteration ${it.iteration})`,
    createdAt: now,
  }));
  const current = revisions.at(-1);
  if (!current) throw new Error('Governance loop produced no iterations');
  return {
    id,
    title: opts.title ?? (out.purpose?.summary || 'Build draft').slice(0, 60),
    state: 'draft',
    author: user,
    currentRevision: current,
    revisions: revisions.slice(0, -1),
    comments: [],
    auditLog: [
      {
        id: `${id}-a1`, postId: id, user, role: opts.role, action: 'create_from_build', afterState: 'draft',
        details: `${revisions.length} governance iteration(s), final score ${current.score} (${current.verdict.status})`,
        timestamp: now, packHash: opts.packHash,
      },
    ],
    approvals: [],
    overrides: [],
    changeRequests: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** A new draft workflow post from a Verify pipeline run. */
export function workflowPostFromVerify(opts: {
  post: { caption: string; hashtags: string[]; altText?: string; format?: any; paidPartnership?: boolean; language?: any };
  verdict: { status: any; score: number; gatesFailed?: string[]; needsHuman?: string[]; hallucinationsBlocked?: number };
  findings: any[];
  packHash: string;
  role: Role;
  now?: string;
  title?: string;
}): WorkflowPost {
  const now = opts.now ?? new Date().toISOString();
  const id = `verify-${Date.parse(now)}`;
  const user = opts.role === 'creator' ? 'Creator' : opts.role === 'manager' ? 'Manager' : 'Reviewer';
  const fullPost: PostContent = {
    caption: opts.post.caption,
    hashtags: opts.post.hashtags,
    altText: opts.post.altText,
    format: opts.post.format || 'feed_4_5',
    paidPartnership: opts.post.paidPartnership,
    language: opts.post.language || 'en',
  };
  const fullVerdict: Verdict = {
    status: opts.verdict.status,
    score: opts.verdict.score,
    gatesFailed: opts.verdict.gatesFailed || [],
    needsHuman: opts.verdict.needsHuman || [],
    hallucinationsBlocked: opts.verdict.hallucinationsBlocked || 0,
  };
  const revision: Revision = {
    id: `${id}-v1`,
    postId: id,
    versionNumber: 1,
    post: fullPost,
    score: opts.verdict.score,
    verdict: fullVerdict,
    findings: opts.findings,
    diffSummary: 'Initial verification run',
    author: user,
    createdAt: now,
  };
  return {
    id,
    title: opts.title ?? (opts.post.caption.slice(0, 60) || 'Verified post'),
    state: 'draft',
    author: user,
    currentRevision: revision,
    revisions: [],
    comments: [],
    auditLog: [
      {
        id: `${id}-a1`,
        postId: id,
        user,
        role: opts.role,
        action: 'create_from_verify',
        afterState: 'draft',
        details: `Initial verification score ${opts.verdict.score} (${opts.verdict.status})`,
        timestamp: now,
        packHash: opts.packHash,
      },
    ],
    approvals: [],
    overrides: [],
    changeRequests: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** First-pass and final check events for Insights (iterations recorded on the final one). */
export function checkEventsFromBuild(out: GovernanceLoopOutput, checkedClauseIds: string[], role: Role): CheckEvent[] {
  const first = out.iterations[0];
  const last = out.iterations.at(-1);
  if (!first || !last) return [];
  const n = out.iterations.length;
  const events = [
    checkEventFromRun({ origin: 'build', pass: 'first', verdict: first.verdict, findings: first.findings, checkedClauseIds, iterations: n === 1 ? 1 : undefined, role }),
  ];
  if (n > 1) {
    events.push(checkEventFromRun({ origin: 'build', pass: 'after_fix', verdict: last.verdict, findings: last.findings, checkedClauseIds, iterations: n, role }));
  }
  return events;
}
