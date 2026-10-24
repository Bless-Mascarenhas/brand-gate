// src/workflow/seedData.ts
/**
 * Sample seeded workflow posts used by the Review Queue UI.
 * They cover every lifecycle state and include a few findings so that the
 * permission and escalation logic can be demonstrated.
 *
 * IMPORTANT: IDs are static strings (not Math.random()) to prevent
 * hydration mismatches between the server and client renders.
 */
import { Category, Severity, Finding } from '@/src/types';
import { PostState, Revision, WorkflowPost } from '@/src/workflow/types';

const makeFinding = (
  id: string,
  severity: Severity,
  category: Category,
  postQuote: string
): Finding => ({
  id,
  source: 'gate',
  category,
  severity,
  clauseId: `clause-${id}`,
  clauseQuote: `Guideline for ${category}`,
  postField: 'caption',
  postQuote,
  explanation: `Sample ${category} issue`,
  suggestedFix: '',
  autoFixable: false,
  confidence: 0.9,
  verified: false,
  agreement: 'single_source',
});

const makeRevision = (
  id: string,
  postId: string,
  versionNumber: number,
  state: PostState,
  findings: Finding[],
  caption = 'Sample caption'
): Revision => ({
  id,
  postId,
  versionNumber,
  post: {
    caption,
    hashtags: ['#sample'],
    altText: 'Sample alt',
    format: 'feed_4_5',
    language: 'en',
    paidPartnership: false,
  },
  score: 80,
  verdict: {
    status: 'READY_FOR_HUMAN',
    score: 80,
    gatesFailed: [],
    needsHuman: [],
    hallucinationsBlocked: 0,
  },
  findings,
  author: 'creator',
  createdAt: '2026-10-20T09:00:00.000Z',
});

export const seededWorkflowPosts: WorkflowPost[] = [
  {
    id: 'post-001',
    title: 'Draft Post – New Collection',
    state: 'draft',
    author: 'Ria',
    assignedRole: 'creator',
    currentRevision: makeRevision('rev-001-v1', 'post-001', 1, 'draft', []),
    revisions: [],
    comments: [],
    auditLog: [],
    createdAt: '2026-10-18T09:00:00.000Z',
    updatedAt: '2026-10-18T09:00:00.000Z',
    isSampleData: true,
  },
  {
    id: 'post-002',
    title: 'In Review – Festival Offer',
    state: 'in_review',
    author: 'Karan',
    assignedRole: 'reviewer',
    currentRevision: makeRevision('rev-002-v1', 'post-002', 1, 'in_review', [
      makeFinding('f-002-1', 'major', 'tone', 'Tone sounds too promotional'),
    ]),
    revisions: [],
    comments: [],
    auditLog: [],
    createdAt: '2026-10-19T09:00:00.000Z',
    updatedAt: '2026-10-19T09:00:00.000Z',
    isSampleData: true,
  },
  {
    id: 'post-003',
    title: 'Changes Requested – Safety Banner',
    state: 'changes_requested',
    author: 'Pooja',
    assignedRole: 'creator',
    currentRevision: makeRevision('rev-003-v2', 'post-003', 2, 'changes_requested', [
      makeFinding('f-003-1', 'critical', 'visual', 'Contrast is below AA'),
    ], 'Updated caption after review comments'),
    // Previous revision to enable comparison
    revisions: [
      makeRevision('rev-003-v1', 'post-003', 1, 'in_review', [], 'Sample caption'),
    ],
    comments: [],
    auditLog: [],
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-21T09:00:00.000Z',
    isSampleData: true,
  },
  {
    id: 'post-004',
    title: 'Approved – Summer Reel',
    state: 'approved',
    author: 'Amit',
    assignedRole: 'manager',
    currentRevision: makeRevision('rev-004-v1', 'post-004', 1, 'approved', []),
    revisions: [],
    comments: [],
    auditLog: [],
    createdAt: '2026-10-21T09:00:00.000Z',
    updatedAt: '2026-10-22T09:00:00.000Z',
    isSampleData: true,
  },
  {
    id: 'post-005',
    title: 'Published Mock – Holiday Card',
    state: 'published_mock',
    author: 'Sneha',
    assignedRole: 'manager',
    currentRevision: makeRevision('rev-005-v1', 'post-005', 1, 'published_mock', []),
    revisions: [],
    comments: [],
    auditLog: [],
    createdAt: '2026-10-22T09:00:00.000Z',
    updatedAt: '2026-10-23T09:00:00.000Z',
    isSampleData: true,
  },
];
