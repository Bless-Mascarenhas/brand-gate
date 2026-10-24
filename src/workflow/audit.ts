// src/workflow/audit.ts
/**
 * Append-only audit log (EM-009): entries are only ever appended, never edited
 * or removed. Ids are sequential per post so they are stable across reloads.
 */
import { Role } from '@/src/types';
import { AuditLogEntry, WorkflowPost } from '@/src/workflow/types';

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
    timestamp,
  }: {
    user: string;
    role: Role;
    action: string;
    beforeState?: string;
    afterState?: string;
    details?: string;
    packHash: string; // hash of the policy pack in force for this action
    timestamp?: string;
  }
): WorkflowPost {
  const entry: AuditLogEntry = {
    id: `${post.id}-a${post.auditLog.length + 1}`,
    postId: post.id,
    user,
    role,
    action,
    beforeState,
    afterState,
    details,
    timestamp: timestamp ?? new Date().toISOString(),
    packHash,
  };
  return { ...post, auditLog: [...post.auditLog, Object.freeze(entry)] };
}
