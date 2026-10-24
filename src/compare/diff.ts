// src/compare/diff.ts
/**
 * Utility functions to compute a diff between two post revisions.
 * The diff is expressed as a `ComparisonResult` defined in
 * `src/compare/types.ts`.
 */
import { PostContent } from '@/src/types';
import { ComparisonResult, DiffChunk } from '@/src/compare/types';
import { Revision } from '@/src/workflow/types';

/**
 * Convert a `PostContent` object into a plain key/value map where the values
 * are JSON‑stringified. This makes deep comparison straightforward.
 */
function serializeContent(content: PostContent): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of Object.keys(content) as (keyof PostContent)[]) {
    const value = (content as any)[key];
    result[key as string] = JSON.stringify(value);
  }
  return result;
}

/**
 * Compute a list of `DiffChunk`s between two `PostContent` objects.
 */
function computeDiffChunks(a: PostContent, b: PostContent): DiffChunk[] {
  const aMap = serializeContent(a);
  const bMap = serializeContent(b);
  const diffs: DiffChunk[] = [];
  const allKeys = new Set([...Object.keys(aMap), ...Object.keys(bMap)]);
  for (const key of allKeys) {
    const before = aMap[key] ?? 'undefined';
    const after = bMap[key] ?? 'undefined';
    if (before !== after) {
      diffs.push({ field: key, before, after });
    }
  }
  return diffs;
}

/**
 * Produce a `ComparisonResult` for two revisions.
 * The function does **not** perform any permission checks – it is a pure
 * utility that can be used on the client or server.
 */
export function computeDiff(post: any, revAId: string, revBId: string): DiffChunk[] {
  // Gather all revisions (including the current one)
  const allRevs: any[] = [...(post.revisions ?? []), post.currentRevision];
  const revA = allRevs.find((r) => r.id === revAId);
  const revB = allRevs.find((r) => r.id === revBId);
  if (!revA || !revB) {
    console.warn('Revision not found for comparison');
    return [];
  }
  return compareRevisions(revA, revB).diffs;
}

export function compareRevisions(
  revisionA: Revision,
  revisionB: Revision
): ComparisonResult {
  return {
    postId: revisionA.postId,
    revisionAId: revisionA.id,
    revisionBId: revisionB.id,
    diffs: computeDiffChunks(revisionA.post, revisionB.post),
  };
}
