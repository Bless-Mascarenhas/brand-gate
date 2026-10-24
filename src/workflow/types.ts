import { Role, PostContent, Verdict, Finding, Category, Severity } from '@/src/types';

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
  createdAt: string;
  updatedAt: string;
  isSampleData?: boolean;
}

export interface StateTransitionResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: Role;
  escalationClause?: string;
}
