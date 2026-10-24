// src/workflow/permissions.ts
/**
 * Permission and state‑transition logic for the workflow system.
 *
 * The workflow defines the following post states (see src/workflow/types.ts):
 *   - draft
 *   - in_review
 *   - changes_requested
 *   - approved
 *   - published_mock
 *
 * Roles are defined in src/types/index.ts as: 'creator', 'manager', 'reviewer'.
 * This module exports utilities to:
 *   1. Determine if a role is authorized to perform a given transition.
 *   2. Compute the next state given a current state, target state, and actor role.
 *   3. Provide a human‑readable reason when a transition is denied.
 *   4. Expose the transition matrix for UI components.
 *
 * The permission matrix mirrors the escalation matrix described in the project
 * documentation (EM‑000). Critical findings require a manager approval with a
 * justification; otherwise creators can submit drafts and reviewers can approve
 * or request changes.
 */

import { Role } from '@/src/types';
import { PostState, StateTransitionResult, WorkflowPost } from '@/src/workflow/types';

/**
 * Mapping of allowed transitions per role.
 * The first level key is the current state; the nested key is the target state.
 * The value is an array of roles permitted to trigger that transition.
 */
const transitionMatrix: Record<PostState, Record<PostState, Role[]>> = {
  draft: {
    in_review: ['creator'], // creator submits for review
    changes_requested: [],
    approved: [],
    published_mock: [],
    draft: [],
  },
  in_review: {
    changes_requested: ['reviewer', 'manager'], // reviewer can request changes
    approved: ['reviewer', 'manager'], // reviewer can approve
    draft: ['manager'], // manager can revert to draft in exceptional cases
    in_review: [],
    published_mock: [],
  },
  changes_requested: {
    draft: ['creator'], // creator revises after changes requested
    in_review: ['creator'], // creator can resubmit directly to review
    changes_requested: [],
    approved: [],
    published_mock: [],
  },
  approved: {
    published_mock: ['manager', 'creator'], // manager or creator can push to mock publish
    in_review: ['manager'], // manager can rollback for last‑minute fixes
    approved: [],
    draft: [],
    changes_requested: [],
  },
  published_mock: {
    // Final state – no further transitions (could add archiving later)
    published_mock: [],
    draft: [],
    in_review: [],
    changes_requested: [],
    approved: [],
  },
};

/**
 * Evaluate whether a role may transition a post from `current` to `next`.
 * Returns a StateTransitionResult indicating if the action is allowed and a
 * reason when it is not.
 */
export function canTransition(
  current: PostState,
  next: PostState,
  actorRole: Role,
  post?: WorkflowPost // optional – used for advanced guard checks (e.g., severity escalation)
): StateTransitionResult {
  const allowedRoles = transitionMatrix[current]?.[next] ?? [];
  if (!allowedRoles || allowedRoles.length === 0) {
    return {
      allowed: false,
      reason: `Transition from '${current}' to '${next}' is not defined.`,
    };
  }

  if (!allowedRoles.includes(actorRole)) {
    return {
      allowed: false,
      reason: `Role '${actorRole}' cannot move from '${current}' to '${next}'.`,
      requiredRole: allowedRoles[0],
    };
  }

  // Escalation guard: critical findings require manager approval for approve/publish.
  if (post && (next === 'approved' || next === 'published_mock')) {
    const hasCritical = post.currentRevision.findings.some(
      (f) => f.severity === 'critical'
    );
    if (hasCritical && actorRole !== 'manager') {
      return {
        allowed: false,
        reason: 'Critical findings require manager approval.',
        requiredRole: 'manager',
        escalationClause: 'EM-000',
      };
    }
  }

  return { allowed: true };
}

/**
 * Apply a state transition after permission validation.
 * Throws an Error if the transition is not allowed.
 */
export function transitionState(
  post: WorkflowPost,
  nextState: PostState,
  actorRole: Role
): WorkflowPost {
  const result = canTransition(post.state, nextState, actorRole, post);
  if (!result.allowed) {
    throw new Error(result.reason ?? 'Transition not allowed');
  }
  return { ...post, state: nextState, updatedAt: new Date().toISOString() };
}

/**
 * Simple helper to decide whether a user can edit a post in its current state.
 * Managers may edit any state; creators can edit drafts and posts with changes
 * requested; reviewers cannot edit directly.
 */
export function canEdit(
  post: WorkflowPost,
  actorRole: Role,
  actorId: string
): boolean {
  if (actorRole === 'manager') return true;
  if (post.state === 'draft' && actorRole === 'creator') return true;
  if (post.state === 'changes_requested' && actorRole === 'creator') return true;
  return false;
}

/**
 * Export the raw transition matrix for UI components that need to render the
 * allowed actions per role/state.
 */
export const getTransitionMatrix = () => transitionMatrix;
