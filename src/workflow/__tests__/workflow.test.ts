import { describe, it, expect } from 'vitest';
import { Finding, Role } from '@/src/types';
import { StorageAdapter } from '@/src/storage';
import { WorkflowPost } from '@/src/workflow/types';
import {
  canApprove,
  canOverride,
  canTransition,
  canEdit,
  getTransitionMatrix,
  missingApprovals,
  requiredApprovers,
} from '@/src/workflow/permissions';
import {
  ActionContext,
  WorkflowPermissionError,
  addComment,
  addRevision,
  approve,
  overrideFinding,
  publishMock,
  requestChanges,
  submitForReview,
} from '@/src/workflow/actions';
import { revisionWordDiff, summarizeWordDiff } from '@/src/workflow/diff';
import { WORKFLOW_KEY, loadWorkflowPosts, saveWorkflowPost } from '@/src/workflow/store';

const f = (id: string, severity: Finding['severity'], category: Finding['category'], clauseId = 'TM-002'): Finding => ({
  id, source: 'gate', category, severity, clauseId, clauseQuote: 'q', postField: 'caption', postQuote: 'cheap',
  explanation: 'e', autoFixable: false, confidence: 1, verified: true, agreement: 'deterministic',
});

function post(findings: Finding[], state: WorkflowPost['state'] = 'draft'): WorkflowPost {
  const verdict = { status: 'REVISE' as const, score: 80, gatesFailed: [], needsHuman: [], hallucinationsBlocked: 0 };
  return {
    id: 'p1', title: 't', state, author: 'A',
    currentRevision: { id: 'p1-v1', postId: 'p1', versionNumber: 1, post: { caption: 'Cheap jeans now', hashtags: ['#ThriftIt'], format: 'feed_4_5', language: 'en' }, score: 80, verdict, findings, author: 'A', createdAt: '2026-10-01T00:00:00.000Z' },
    revisions: [], comments: [], auditLog: [], approvals: [], overrides: [], changeRequests: [],
    createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
  };
}

const ctx = (role: Role, now = '2026-10-24T10:00:00.000Z'): ActionContext => ({ role, user: `${role}-demo`, packHash: 'pack_test', now });

function memoryAdapter(): StorageAdapter & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    getItem: async <T,>(k: string) => (data.has(k) ? (structuredClone(data.get(k)) as T) : null),
    setItem: async <T,>(k: string, v: T) => { data.set(k, structuredClone(v)); },
    removeItem: async (k: string) => { data.delete(k); },
    listKeys: async () => Array.from(data.keys()),
    clear: async () => data.clear(),
  };
}

describe('state machine', () => {
  it('allows only the defined transitions', () => {
    expect(canTransition('draft', 'in_review', 'creator').allowed).toBe(true);
    expect(canTransition('draft', 'approved', 'manager').allowed).toBe(false);
    expect(canTransition('draft', 'published_mock', 'manager').allowed).toBe(false);
    expect(canTransition('changes_requested', 'in_review', 'creator').allowed).toBe(true);
    expect(canTransition('published_mock', 'draft', 'manager').allowed).toBe(false);
  });

  it('every state except published_mock has an outgoing transition', () => {
    const m = getTransitionMatrix();
    for (const [state, targets] of Object.entries(m)) {
      const out = Object.values(targets).some((roles) => roles.length > 0);
      expect(out).toBe(state !== 'published_mock');
    }
  });

  it('rejects unauthorised roles', () => {
    expect(canTransition('draft', 'in_review', 'reviewer').allowed).toBe(false);
    expect(canTransition('in_review', 'changes_requested', 'creator').allowed).toBe(false);
    expect(canTransition('approved', 'published_mock', 'creator').allowed).toBe(false);
    expect(canTransition('approved', 'published_mock', 'reviewer').allowed).toBe(false);
    expect(canTransition('approved', 'published_mock', 'manager').allowed).toBe(true);
  });

  it('actions throw WorkflowPermissionError for unauthorised roles (not just hidden buttons)', () => {
    expect(() => submitForReview(post([]), ctx('reviewer'))).toThrow(WorkflowPermissionError);
    const inReview = submitForReview(post([]), ctx('creator')).post;
    expect(() => approve(inReview, ctx('creator'))).toThrow(WorkflowPermissionError);
    expect(() => requestChanges(inReview, ctx('creator'), { reason: 'tone', text: 'no' })).toThrow(WorkflowPermissionError);
  });
});

describe('escalation matrix', () => {
  it('no findings → one reviewer sign-off (EM-006)', () => {
    expect(requiredApprovers([]).map((r) => r.role)).toEqual(['reviewer']);
  });
  it('minor terminology only → reviewer (EM-001 self-resolution still needs human sign-off)', () => {
    expect(requiredApprovers([f('a', 'minor', 'terminology')]).map((r) => r.role)).toEqual(['reviewer']);
  });
  it('major or factual findings → manager (EM-002)', () => {
    expect(requiredApprovers([f('a', 'major', 'terminology')]).map((r) => r.role)).toEqual(['manager']);
    expect(requiredApprovers([f('a', 'minor', 'factual_accuracy')]).map((r) => r.role)).toEqual(['manager']);
  });
  it('critical or disclosure findings → manager + reviewer (EM-003)', () => {
    const roles = requiredApprovers([f('a', 'minor', 'disclosure')]).map((r) => r.role).sort();
    expect(roles).toEqual(['manager', 'reviewer']);
    expect(requiredApprovers([f('a', 'critical', 'claims')]).every((r) => r.clause === 'EM-003' || r.clause === 'EM-002')).toBe(true);
  });
  it('visual findings → reviewer (EM-004)', () => {
    expect(requiredApprovers([f('a', 'minor', 'visual')])).toEqual([expect.objectContaining({ role: 'reviewer', clause: 'EM-004' })]);
  });
  it('info findings do not escalate', () => {
    expect(requiredApprovers([f('a', 'info', 'claims')]).map((r) => r.role)).toEqual(['reviewer']);
  });

  it('a major finding cannot be approved by a reviewer; the manager alone completes it', () => {
    const p = submitForReview(post([f('m', 'major', 'factual_accuracy')]), ctx('creator')).post;
    expect(canApprove(p, 'reviewer').allowed).toBe(false);
    const after = approve(p, ctx('manager')).post;
    expect(after.state).toBe('approved');
  });

  it('dual approval: first approval keeps the post in review, second approves it', () => {
    let p = submitForReview(post([f('d', 'minor', 'disclosure', 'SR-006')]), ctx('creator')).post;
    p = approve(p, ctx('reviewer')).post;
    expect(p.state).toBe('in_review');
    expect(missingApprovals(p).map((m) => m.role)).toEqual(['manager']);
    expect(() => approve(p, ctx('reviewer'))).toThrow(/already approved/);
    p = approve(p, ctx('manager')).post;
    expect(p.state).toBe('approved');
  });
});

describe('critical findings and overrides (EM-007)', () => {
  const critical = f('c', 'critical', 'disclosure', 'SR-006');

  it('a post with an open critical finding cannot be approved by anyone', () => {
    const p = submitForReview(post([critical]), ctx('creator')).post;
    for (const role of ['creator', 'reviewer', 'manager'] as Role[]) {
      expect(canApprove(p, role).allowed).toBe(false);
      expect(() => approve(p, ctx(role))).toThrow(WorkflowPermissionError);
    }
  });

  it('only a manager can override a critical finding', () => {
    const why = 'Paid partnership label added in the app; #ad is in the caption.';
    expect(canOverride(critical, 'reviewer', why).allowed).toBe(false);
    expect(canOverride(critical, 'creator', why).allowed).toBe(false);
    expect(canOverride(critical, 'manager', why).allowed).toBe(true);
  });

  it('requires a written justification of at least 20 characters', () => {
    expect(canOverride(critical, 'manager', 'ok').allowed).toBe(false);
    expect(canOverride(critical, 'manager', '                         ').allowed).toBe(false);
    expect(canOverride(f('x', 'major', 'tone'), 'reviewer', 'short').allowed).toBe(false);
  });

  it('manager override unblocks approval, is audited and emits a human_override event', () => {
    let p = submitForReview(post([critical]), ctx('creator')).post;
    const res = overrideFinding(p, ctx('manager'), 'c', 'Disclosure verified with the stylist contract on file.');
    p = res.post;
    expect(res.events).toEqual([expect.objectContaining({ kind: 'human_override', role: 'manager', clauseIds: ['SR-006'] })]);
    expect(p.auditLog.at(-1)).toMatchObject({ action: 'override_finding', role: 'manager', packHash: 'pack_test' });
    // overridden finding no longer blocks; nothing left open → one reviewer
    p = approve(p, ctx('reviewer')).post;
    expect(p.state).toBe('approved');
  });

  it('a reviewer attempting a critical override is rejected in the action layer', () => {
    const p = submitForReview(post([critical]), ctx('creator')).post;
    expect(() => overrideFinding(p, ctx('reviewer'), 'c', 'I think this is fine actually, trust me.')).toThrow(/Manager/);
  });
});

describe('audit log', () => {
  it('records who, role, action, before/after, timestamp and pack hash for every action', () => {
    let p = post([f('m', 'major', 'tone')]);
    p = submitForReview(p, ctx('creator', '2026-10-24T01:00:00.000Z')).post;
    p = requestChanges(p, ctx('reviewer', '2026-10-24T02:00:00.000Z'), { reason: 'tone', text: 'Too casual for BV-007.' }).post;
    expect(p.auditLog).toHaveLength(2);
    expect(p.auditLog[0]).toEqual({
      id: 'p1-a1', postId: 'p1', user: 'creator-demo', role: 'creator', action: 'submit_for_review',
      beforeState: 'draft', afterState: 'in_review', details: undefined, timestamp: '2026-10-24T01:00:00.000Z', packHash: 'pack_test',
    });
    expect(p.auditLog[1]).toMatchObject({ role: 'reviewer', action: 'request_changes', beforeState: 'in_review', afterState: 'changes_requested' });
  });

  it('is append-only: actions never rewrite earlier entries', () => {
    let p = submitForReview(post([]), ctx('creator')).post;
    const first = p.auditLog[0];
    p = addComment(p, ctx('reviewer'), 'Looks good').post;
    p = approve(p, ctx('reviewer')).post;
    expect(p.auditLog[0]).toBe(first);
    expect(p.auditLog.map((a) => a.id)).toEqual(['p1-a1', 'p1-a2', 'p1-a3']);
  });

  it('request changes needs a reason and records a human_rejection against open clauses', () => {
    const p = submitForReview(post([f('m', 'major', 'tone', 'BV-007')]), ctx('creator')).post;
    expect(() => requestChanges(p, ctx('reviewer'), { reason: 'tone', text: '  ' })).toThrow();
    const res = requestChanges(p, ctx('reviewer'), { reason: 'tone', text: 'Too casual' });
    expect(res.events[0]).toMatchObject({ kind: 'human_rejection', clauseIds: ['BV-007'], role: 'reviewer' });
    expect(res.post.changeRequests?.[0]).toMatchObject({ reason: 'tone', text: 'Too casual' });
  });

  it('publish is simulated and only from approved', () => {
    let p = submitForReview(post([]), ctx('creator')).post;
    expect(() => publishMock(p, ctx('manager'))).toThrow();
    p = approve(p, ctx('reviewer')).post;
    p = publishMock(p, ctx('manager')).post;
    expect(p.state).toBe('published_mock');
    expect(p.auditLog.at(-1)?.details).toMatch(/Simulated/);
  });
});

describe('comments and revisions', () => {
  it('adds post-level and finding-level comments and rejects unknown findings', () => {
    let p = post([f('m', 'major', 'tone')]);
    p = addComment(p, ctx('reviewer'), 'Post-level note').post;
    p = addComment(p, ctx('creator'), 'On the finding', 'm').post;
    expect(p.comments.map((c) => c.findingId)).toEqual([undefined, 'm']);
    expect(() => addComment(p, ctx('creator'), 'x', 'nope')).toThrow();
    expect(() => addComment(p, ctx('creator'), '   ')).toThrow();
  });

  it('adds revisions with scores, resets approvals/overrides, and keeps history', () => {
    let p = post([f('m', 'major', 'tone')]);
    const verdict = { status: 'READY_FOR_HUMAN' as const, score: 100, gatesFailed: [], needsHuman: [], hallucinationsBlocked: 0 };
    p = addRevision(p, ctx('creator'), { content: { ...p.currentRevision.post, caption: 'Pre-loved jeans now' }, findings: [], verdict }).post;
    expect(p.currentRevision.versionNumber).toBe(2);
    expect(p.currentRevision.score).toBe(100);
    expect(p.revisions.map((r) => r.score)).toEqual([80]);
    expect(p.auditLog.at(-1)).toMatchObject({ action: 'add_revision', beforeState: 'v1 score 80', afterState: 'v2 score 100' });
  });

  it('reviewers cannot add revisions; nobody edits approved posts', () => {
    const p = post([]);
    expect(canEdit(p, 'reviewer')).toBe(false);
    expect(canEdit({ ...p, state: 'approved' }, 'manager')).toBe(false);
    const verdict = { status: 'READY_FOR_HUMAN' as const, score: 100, gatesFailed: [], needsHuman: [], hallucinationsBlocked: 0 };
    expect(() => addRevision(p, ctx('reviewer'), { content: p.currentRevision.post, findings: [], verdict })).toThrow(WorkflowPermissionError);
  });

  it('word-level diff between two revisions', () => {
    const a = post([]).currentRevision;
    const b = { ...a, post: { ...a.post, caption: 'Pre-loved jeans now' } };
    const d = revisionWordDiff(a, b);
    const caption = d.find((x) => x.field === 'caption')!;
    expect(caption.changed).toBe(true);
    expect(caption.parts.filter((p) => p.removed).map((p) => p.value.trim())).toEqual(['Cheap']);
    expect(caption.parts.filter((p) => p.added).map((p) => p.value.trim())).toEqual(['Pre-loved']);
    expect(summarizeWordDiff(d)).toBe('caption: +1/−1 words; hashtags unchanged; altText unchanged');
  });
});

describe('persistence through the storage adapter', () => {
  it('starts with an empty queue on first load', async () => {
    const adapter = memoryAdapter();
    const { posts } = await loadWorkflowPosts(adapter);
    expect(posts).toHaveLength(0);
  });

  it('a saved post survives a reload (new load from the same storage)', async () => {
    const adapter = memoryAdapter();
    const testPost = post([]);
    await saveWorkflowPost(testPost, adapter);
    const loaded = await loadWorkflowPosts(adapter);
    expect(loaded.posts).toHaveLength(1);
    const updated = addComment(loaded.posts[0], ctx('reviewer'), 'Persist me').post;
    await saveWorkflowPost(updated, adapter);
    const reloaded = await loadWorkflowPosts(adapter);
    expect(reloaded.posts.find((p) => p.id === testPost.id)?.comments.at(-1)?.text).toBe('Persist me');
    expect(reloaded.recoveredFrom).toBeUndefined();
  });

  it('corrupt stored data resets to empty with an explicit notice', async () => {
    const adapter = memoryAdapter();
    await adapter.setItem(WORKFLOW_KEY, { not: 'an array' });
    const res = await loadWorkflowPosts(adapter);
    expect(res.posts).toHaveLength(0);
    expect(res.recoveredFrom).toMatch(/unreadable/);
  });
});

