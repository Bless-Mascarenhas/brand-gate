// src/workflow/actions.ts
/**
 * Every workflow mutation goes through these pure functions. Each one re-checks
 * permissions (src/workflow/permissions.ts), throws WorkflowPermissionError when
 * the actor may not act, appends an audit entry, and returns the human
 * override / rejection events that Insights consumes.
 */
import { Finding, PostContent, Role, Verdict } from '@/src/types';
import { HumanEvent } from '@/src/insights/types';
import { ChangeReason, Comment, PostState, Revision, WorkflowPost } from '@/src/workflow/types';
import { canApprove, canEdit, canOverride, canTransition, missingApprovals, openFindings } from '@/src/workflow/permissions';
import { addAuditLog } from '@/src/workflow/audit';

export class WorkflowPermissionError extends Error {
  constructor(message: string, public readonly escalationClause?: string) {
    super(message);
    this.name = 'WorkflowPermissionError';
  }
}

export interface ActionContext {
  user: string;
  role: Role;
  packHash: string;
  now?: string; // injectable clock for tests
}

export interface ActionResult {
  post: WorkflowPost;
  events: HumanEvent[];
}

const nowOf = (ctx: ActionContext) => ctx.now ?? new Date().toISOString();

function log(post: WorkflowPost, ctx: ActionContext, action: string, before?: string, after?: string, details?: string) {
  return addAuditLog(post, {
    user: ctx.user,
    role: ctx.role,
    action,
    beforeState: before,
    afterState: after,
    details,
    packHash: ctx.packHash,
    timestamp: nowOf(ctx),
  });
}

function move(post: WorkflowPost, next: PostState, ctx: ActionContext, action: string, details?: string): WorkflowPost {
  const res = canTransition(post.state, next, ctx.role, post);
  if (!res.allowed) throw new WorkflowPermissionError(res.reason ?? 'Not allowed', res.escalationClause);
  const moved = { ...post, state: next, updatedAt: nowOf(ctx) };
  return log(moved, ctx, action, post.state, next, details);
}

export function submitForReview(post: WorkflowPost, ctx: ActionContext): ActionResult {
  return { post: move({ ...post, approvals: [] }, 'in_review', ctx, 'submit_for_review'), events: [] };
}

/**
 * Record this role's approval. The post moves to `approved` only once every
 * approver the escalation matrix requires has signed off.
 */
export function approve(post: WorkflowPost, ctx: ActionContext): ActionResult {
  const res = canApprove(post, ctx.role);
  if (!res.allowed) throw new WorkflowPermissionError(res.reason ?? 'Not allowed', res.escalationClause);
  const at = nowOf(ctx);
  let next: WorkflowPost = { ...post, approvals: [...(post.approvals ?? []), { role: ctx.role, user: ctx.user, at }], updatedAt: at };
  const missing = missingApprovals(next);
  next = log(
    next,
    ctx,
    'approve',
    post.state,
    missing.length === 0 ? 'approved' : post.state,
    missing.length === 0
      ? `Final approval (${res.escalationClause}).`
      : `Approval recorded (${res.escalationClause}); still waiting for ${missing.map((m) => m.role).join(' + ')}.`
  );
  if (missing.length === 0) next = { ...next, state: 'approved' };
  return { post: next, events: [] };
}

export function requestChanges(
  post: WorkflowPost,
  ctx: ActionContext,
  input: { reason: ChangeReason; text: string; clauseIds?: string[] }
): ActionResult {
  if (!input.text.trim()) throw new WorkflowPermissionError('A reason is required when requesting changes.');
  const clauseIds = input.clauseIds?.length
    ? input.clauseIds
    : Array.from(new Set(openFindings(post).map((f) => f.clauseId)));
  const at = nowOf(ctx);
  const moved = move(
    {
      ...post,
      approvals: [],
      changeRequests: [...(post.changeRequests ?? []), { reason: input.reason, text: input.text, clauseIds, role: ctx.role, user: ctx.user, at }],
    },
    'changes_requested',
    ctx,
    'request_changes',
    `[${input.reason}] ${input.text}${clauseIds.length ? ` (clauses: ${clauseIds.join(', ')})` : ''}`
  );
  const events: HumanEvent[] = clauseIds.length
    ? [{ kind: 'human_rejection', id: `${post.id}-rej-${moved.auditLog.length}`, ts: at, role: ctx.role, clauseIds, reason: input.text, postId: post.id }]
    : [];
  return { post: moved, events };
}

export function overrideFinding(post: WorkflowPost, ctx: ActionContext, findingId: string, justification: string): ActionResult {
  const finding = post.currentRevision.findings.find((f) => f.id === findingId);
  if (!finding) throw new WorkflowPermissionError(`Finding ${findingId} is not on the current revision.`);
  if ((post.overrides ?? []).some((o) => o.findingId === findingId)) {
    throw new WorkflowPermissionError('This finding has already been overridden.');
  }
  if (post.state === 'approved' || post.state === 'published_mock') {
    throw new WorkflowPermissionError(`Findings cannot be overridden once a post is ${post.state}.`);
  }
  const res = canOverride(finding, ctx.role, justification);
  if (!res.allowed) throw new WorkflowPermissionError(res.reason ?? 'Not allowed', res.escalationClause);
  const at = nowOf(ctx);
  const next = log(
    {
      ...post,
      overrides: [
        ...(post.overrides ?? []),
        { findingId, clauseId: finding.clauseId, severity: finding.severity, role: ctx.role, user: ctx.user, justification: justification.trim(), at },
      ],
      updatedAt: at,
    },
    ctx,
    'override_finding',
    post.state,
    post.state,
    `${finding.severity} ${finding.clauseId}: ${justification.trim()}`
  );
  return {
    post: next,
    events: [{ kind: 'human_override', id: `${post.id}-ovr-${next.auditLog.length}`, ts: at, role: ctx.role, clauseIds: [finding.clauseId], reason: justification.trim(), postId: post.id }],
  };
}

export function addRevision(
  post: WorkflowPost,
  ctx: ActionContext,
  input: { content: PostContent; findings: Finding[]; verdict: Verdict; diffSummary?: string }
): ActionResult {
  if (!canEdit(post, ctx.role)) {
    throw new WorkflowPermissionError(`Role '${ctx.role}' cannot edit a post in state '${post.state}'.`);
  }
  const at = nowOf(ctx);
  const version = post.currentRevision.versionNumber + 1;
  const revision: Revision = {
    id: `${post.id}-v${version}`,
    postId: post.id,
    versionNumber: version,
    post: input.content,
    score: input.verdict.score,
    verdict: input.verdict,
    findings: input.findings,
    diffSummary: input.diffSummary,
    author: ctx.user,
    createdAt: at,
  };
  const next = log(
    { ...post, revisions: [...post.revisions, post.currentRevision], currentRevision: revision, approvals: [], overrides: [], updatedAt: at },
    ctx,
    'add_revision',
    `v${post.currentRevision.versionNumber} score ${post.currentRevision.score}`,
    `v${version} score ${revision.score}`,
    input.diffSummary
  );
  return { post: next, events: [] };
}

export function addComment(post: WorkflowPost, ctx: ActionContext, text: string, findingId?: string): ActionResult {
  if (!text.trim()) throw new WorkflowPermissionError('Comment text is empty.');
  if (findingId && !post.currentRevision.findings.some((f) => f.id === findingId) && !post.revisions.some((r) => r.findings.some((f) => f.id === findingId))) {
    throw new WorkflowPermissionError(`Finding ${findingId} does not belong to this post.`);
  }
  const at = nowOf(ctx);
  const comment: Comment = {
    id: `${post.id}-c${post.comments.length + 1}`,
    postId: post.id,
    findingId,
    author: ctx.user,
    role: ctx.role,
    text: text.trim(),
    timestamp: at,
  };
  const next = log({ ...post, comments: [...post.comments, comment], updatedAt: at }, ctx, 'comment', undefined, undefined, findingId ? `on finding ${findingId}` : 'post-level');
  return { post: next, events: [] };
}

/** Simulated publish only — nothing leaves the browser. */
export function publishMock(post: WorkflowPost, ctx: ActionContext): ActionResult {
  return { post: move(post, 'published_mock', ctx, 'publish_mock', 'Simulated publish (no Instagram API call).'), events: [] };
}

export function revertToDraft(post: WorkflowPost, ctx: ActionContext): ActionResult {
  return { post: move({ ...post, approvals: [] }, 'draft', ctx, 'revert_to_draft'), events: [] };
}

export function rollbackToReview(post: WorkflowPost, ctx: ActionContext): ActionResult {
  return { post: move({ ...post, approvals: [] }, 'in_review', ctx, 'rollback_to_review'), events: [] };
}
