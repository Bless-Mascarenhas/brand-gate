// src/workflow/audit.ts
/**
 * Helper to create an immutable audit‑log entry whenever a post changes state
 * or a comment/revision is added.
 */
import { Role } from '@/src/types';
import { AuditLogEntry, WorkflowPost } from '@/src/workflow/types';

/**
 * Append a new log entry to the post's `auditLog` array and return an updated
 * post object (immutable pattern).
 */
export function addAuditLog(
  post: WorkflowPost,
  {
    user,
    role,
    action,
    beforeState,
    afterState,
    details,
    packHash,
  }: {
    user: string;
    role: Role;
    action: string;
    beforeState?: string;
    afterState?: string;
    details?: string;
    packHash: string; // hash of the policy pack used for this post
  }
): WorkflowPost {
  const entry: AuditLogEntry = {
    id: Math.random().toString(36).substring(2, 10),
    postId: post.id,
    user,
    role,
    action,
    beforeState,
    afterState,
    details,
    timestamp: new Date().toISOString(),
    packHash,
  };
  return { ...post, auditLog: [...post.auditLog, entry] };
}
