import { Role, PostContent, Verdict, Finding } from '@/src/types';

export type PostState = 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'published_mock';

export interface Comment {
  id: string;
  postId: string;
  findingId?: string; // Optional: finding-level comment
  author: string;
  role: Role;
  text: string;
  timestamp: string;
}

export interface Revision {
  id: string;
  postId: string;
  versionNumber: number;
  post: PostContent;
  score: number;
  verdict: Verdict;
  findings: Finding[];
  diffSummary?: string;
  author: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  postId: string;
  user: string;
  role: Role;
  action: string;
  beforeState?: string;
  afterState?: string;
  details?: string;
  timestamp: string;
  packHash: string;
}

export interface Approval {
  role: Role;
  user: string;
  at: string;
}

export interface FindingOverride {
  findingId: string;
  clauseId: string;
  severity: Finding['severity'];
  role: Role;
  user: string;
  justification: string;
  at: string;
}

export const CHANGE_REASONS = ['tone', 'wrong_fact', 'visual', 'claim', 'other'] as const;
export type ChangeReason = (typeof CHANGE_REASONS)[number];

export interface ChangeRequest {
  reason: ChangeReason;
  text: string;
  clauseIds: string[];
  role: Role;
  user: string;
  at: string;
}

export interface WorkflowPost {
  id: string;
  title: string;
  state: PostState;
  author: string;
  assignedRole?: Role;
  currentRevision: Revision;
  revisions: Revision[];
  comments: Comment[];
  auditLog: AuditLogEntry[];
  approvals?: Approval[]; // reset whenever a new revision is added or changes are requested
  overrides?: FindingOverride[]; // scoped to the current revision
  changeRequests?: ChangeRequest[];
  createdAt: string;
  updatedAt: string;
}

export interface StateTransitionResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: Role;
  escalationClause?: string;
}
