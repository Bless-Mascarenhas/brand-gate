// src/workflow/permissions.ts
/**
 * Permission and state-transition logic for the workflow system — the single
 * place that decides who may do what. UI components only render what these
 * functions allow; `src/workflow/actions.ts` re-checks every call, so hiding a
 * button is never the enforcement.
 *
 * States: draft → in_review → changes_requested → approved → published_mock
 * Roles:  creator | manager | reviewer (simulated in the demo, see EM-008)
 *
 * Escalation matrix (data/thrift-it/escalation-matrix.md):
 *   EM-001 creator self-resolves minor tone/terminology — still needs one human sign-off
 *   EM-002 major, factual or claims findings → Manager approval
 *   EM-003 critical or disclosure findings   → Manager AND Reviewer (dual concurrence)
 *   EM-004 visual identity findings          → Reviewer (Brand Designer)
 *   EM-006 never auto-publish; a human publishes
 *   EM-007 critical findings overridable only by a Manager with ≥20-char rationale
 */

import { Finding, Role } from '@/src/types';
import { PostState, StateTransitionResult, WorkflowPost } from '@/src/workflow/types';

/**
 * Allowed transitions per role. First key = current state, nested key = target.
 */
const transitionMatrix: Record<PostState, Record<PostState, Role[]>> = {
  draft: {
    in_review: ['creator', 'manager'], // submit for review
    changes_requested: [],
    approved: [],
    published_mock: [],
    draft: [],
  },
  in_review: {
    changes_requested: ['reviewer', 'manager'],
    approved: ['reviewer', 'manager'], // only via approve(); also needs every required approver
    draft: ['manager'], // manager can revert to draft in exceptional cases
    in_review: [],
    published_mock: [],
  },
  changes_requested: {
    draft: ['creator', 'manager'],
    in_review: ['creator', 'manager'], // resubmit
    changes_requested: [],
    approved: [],
    published_mock: [],
  },
  approved: {
    published_mock: ['manager'], // EM-006: a human with authority makes the publishing decision
    in_review: ['manager'], // rollback for last-minute fixes
    approved: [],
    draft: [],
    changes_requested: [],
  },
  published_mock: {
    published_mock: [],
    draft: [],
    in_review: [],
    changes_requested: [],
    approved: [],
  },
};

export const MIN_OVERRIDE_JUSTIFICATION = 20; // EM-007

/** Findings on the current revision that are neither informational nor overridden. */
export function openFindings(post: WorkflowPost): Finding[] {
  const overridden = new Set((post.overrides ?? []).map((o) => o.findingId));
  return post.currentRevision.findings.filter((f) => f.severity !== 'info' && !overridden.has(f.id));
}

export interface ApproverRequirement {
  role: Role;
  clause: string;
  because: string;
}

/**
 * Roles that must each approve before a post with these open findings may move
 * to `approved`. Returns one entry per role with the escalation clause that
 * requires it.
 */
export function requiredApprovers(findings: Finding[]): ApproverRequirement[] {
  const req = new Map<Role, ApproverRequirement>();
  const add = (role: Role, clause: string, because: string) => {
    if (!req.has(role)) req.set(role, { role, clause, because });
  };
  for (const f of findings) {
    if (f.severity === 'info') continue;
    if (f.severity === 'critical' || f.category === 'disclosure') {
      add('manager', 'EM-003', `${f.severity} ${f.category} finding on ${f.clauseId}`);
      add('reviewer', 'EM-003', `${f.severity} ${f.category} finding on ${f.clauseId}`);
    }
    if (f.severity === 'major' || f.category === 'factual_accuracy' || f.category === 'claims') {
      add('manager', 'EM-002', `${f.severity} ${f.category} finding on ${f.clauseId}`);
    }
    if (f.category === 'visual') {
      add('reviewer', 'EM-004', `visual finding on ${f.clauseId}`);
    }
  }
  if (req.size === 0) add('reviewer', 'EM-006', 'every post needs one human sign-off');
  return Array.from(req.values());
}

/** Required approver roles that have not yet approved the current revision. */
export function missingApprovals(post: WorkflowPost): ApproverRequirement[] {
  const approved = new Set((post.approvals ?? []).map((a) => a.role));
  return requiredApprovers(openFindings(post)).filter((r) => !approved.has(r.role));
}

/**
 * Evaluate whether a role may transition a post from `current` to `next`.
 */
export function canTransition(
  current: PostState,
  next: PostState,
  actorRole: Role,
  post?: WorkflowPost
): StateTransitionResult {
  const allowedRoles = transitionMatrix[current]?.[next] ?? [];
  if (allowedRoles.length === 0) {
    return { allowed: false, reason: `Transition from '${current}' to '${next}' is not defined.` };
  }
  if (!allowedRoles.includes(actorRole)) {
    return {
      allowed: false,
      reason: `Role '${actorRole}' cannot move from '${current}' to '${next}'.`,
      requiredRole: allowedRoles[0],
    };
  }

  if (post && next === 'approved') {
    const critical = openFindings(post).filter((f) => f.severity === 'critical');
    if (critical.length > 0) {
      return {
        allowed: false,
        reason: `${critical.length} open critical finding(s) must be fixed or overridden by a Manager first.`,
        requiredRole: 'manager',
        escalationClause: 'EM-007',
      };
    }
  }

  return { allowed: true };
}

/** May this role record an approval on the post right now? */
export function canApprove(post: WorkflowPost, actorRole: Role): StateTransitionResult {
  if (post.state !== 'in_review') {
    return { allowed: false, reason: `Only posts in review can be approved (state is '${post.state}').` };
  }
  const base = canTransition('in_review', 'approved', actorRole, post);
  if (!base.allowed) return base;
  const required = requiredApprovers(openFindings(post));
  const mine = required.find((r) => r.role === actorRole);
  if (!mine) {
    return {
      allowed: false,
      reason: `Approval is required from ${required.map((r) => r.role).join(' + ')}, not ${actorRole}.`,
      requiredRole: required[0]?.role,
      escalationClause: required[0]?.clause,
    };
  }
  if ((post.approvals ?? []).some((a) => a.role === actorRole)) {
    return { allowed: false, reason: `The ${actorRole} role has already approved this revision.` };
  }
  return { allowed: true, escalationClause: mine.clause };
}

/** May this role override (accept the risk of) a specific finding? */
export function canOverride(finding: Finding, actorRole: Role, justification: string): StateTransitionResult {
  if (finding.severity === 'critical' && actorRole !== 'manager') {
    return {
      allowed: false,
      reason: 'Critical findings can only be overridden by a Manager.',
      requiredRole: 'manager',
      escalationClause: 'EM-007',
    };
  }
  if (actorRole === 'creator') {
    return { allowed: false, reason: 'Creators cannot override findings; fix them or ask a reviewer.', requiredRole: 'reviewer' };
  }
  if (justification.trim().length < MIN_OVERRIDE_JUSTIFICATION) {
    return {
      allowed: false,
      reason: `A written justification of at least ${MIN_OVERRIDE_JUSTIFICATION} characters is required.`,
      escalationClause: 'EM-007',
    };
  }
  return { allowed: true };
}

/**
 * Apply a state transition after permission validation.
 * Throws an Error if the transition is not allowed.
 */
export function transitionState(post: WorkflowPost, nextState: PostState, actorRole: Role): WorkflowPost {
  const result = canTransition(post.state, nextState, actorRole, post);
  if (!result.allowed) {
    throw new Error(result.reason ?? 'Transition not allowed');
  }
  return { ...post, state: nextState, updatedAt: new Date().toISOString() };
}

/**
 * Whether a role may add a revision. Managers may edit any non-final state;
 * creators can edit drafts and posts with changes requested; reviewers cannot
 * edit directly.
 */
export function canEdit(post: WorkflowPost, actorRole: Role): boolean {
  if (post.state === 'published_mock' || post.state === 'approved') return false;
  if (actorRole === 'manager') return true;
  return actorRole === 'creator' && (post.state === 'draft' || post.state === 'changes_requested');
}

/**
 * Export the raw transition matrix for UI components that need to render the
 * allowed actions per role/state.
 */
export const getTransitionMatrix = () => transitionMatrix;
