// src/compare/types.ts
/**
 * Types supporting the Compare feature (Phase 8).
 * A ComparisonResult captures the diff between two revisions of a post.
 */
export interface DiffChunk {
  /** The field that changed, e.g. 'caption' or 'hashtags' */
  field: string;
  /** JSON‑stringified value from the older revision */
  before: string;
  /** JSON‑stringified value from the newer revision */
  after: string;
}

export interface ComparisonResult {
  /** Identifier of the post being compared */
  postId: string;
  /** Revision identifier for the older version */
  revisionAId: string;
  /** Revision identifier for the newer version */
  revisionBId: string;
  /** List of changed fields */
  diffs: DiffChunk[];
}
