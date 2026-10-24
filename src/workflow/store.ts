// src/workflow/store.ts
/**
 * Workflow persistence through the shared StorageAdapter (IndexedDB by default).
 * The first load seeds the six labelled sample posts from data/seed/workflow.json.
 */
import seed from '@/data/seed/workflow.json';
import { StorageAdapter, storage as defaultStorage } from '@/src/storage';
import { WorkflowPost } from '@/src/workflow/types';

export const WORKFLOW_KEY = 'workflow:posts:v1';

export const SEEDED_WORKFLOW_POSTS = seed as unknown as WorkflowPost[];

function isWorkflowPostArray(v: unknown): v is WorkflowPost[] {
  return (
    Array.isArray(v) &&
    v.every((p) => p && typeof p.id === 'string' && typeof p.state === 'string' && p.currentRevision && Array.isArray(p.auditLog))
  );
}

export interface LoadResult {
  posts: WorkflowPost[];
  /** Set when stored data was unreadable and the seed was restored instead. */
  recoveredFrom?: string;
}

export async function loadWorkflowPosts(adapter: StorageAdapter = defaultStorage): Promise<LoadResult> {
  const stored = await adapter.getItem<unknown>(WORKFLOW_KEY);
  if (stored === null) {
    const posts = structuredClone(SEEDED_WORKFLOW_POSTS);
    await adapter.setItem(WORKFLOW_KEY, posts);
    return { posts };
  }
  if (!isWorkflowPostArray(stored)) {
    const posts = structuredClone(SEEDED_WORKFLOW_POSTS);
    await adapter.setItem(WORKFLOW_KEY, posts);
    return { posts, recoveredFrom: 'Stored workflow data was unreadable; the sample posts were restored.' };
  }
  return { posts: stored };
}

export async function saveWorkflowPost(post: WorkflowPost, adapter: StorageAdapter = defaultStorage): Promise<WorkflowPost[]> {
  const { posts } = await loadWorkflowPosts(adapter);
  const idx = posts.findIndex((p) => p.id === post.id);
  const next = idx === -1 ? [post, ...posts] : posts.map((p) => (p.id === post.id ? post : p));
  await adapter.setItem(WORKFLOW_KEY, next);
  return next;
}

export async function resetWorkflow(adapter: StorageAdapter = defaultStorage): Promise<WorkflowPost[]> {
  const posts = structuredClone(SEEDED_WORKFLOW_POSTS);
  await adapter.setItem(WORKFLOW_KEY, posts);
  return posts;
}
