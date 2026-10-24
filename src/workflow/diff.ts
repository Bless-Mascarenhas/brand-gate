import { diffWords } from 'diff';
import { Revision } from '@/src/workflow/types';

export interface WordPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface FieldDiff {
  field: 'caption' | 'hashtags' | 'altText';
  parts: WordPart[];
  changed: boolean;
}

const FIELDS: { field: FieldDiff['field']; get: (r: Revision) => string }[] = [
  { field: 'caption', get: (r) => r.post.caption ?? '' },
  { field: 'hashtags', get: (r) => (r.post.hashtags ?? []).join(' ') },
  { field: 'altText', get: (r) => r.post.altText ?? '' },
];

/** Word-level diff of the text fields of two revisions (a = before, b = after). */
export function revisionWordDiff(a: Revision, b: Revision): FieldDiff[] {
  return FIELDS.map(({ field, get }) => {
    const parts = diffWords(get(a), get(b)).map((p) => ({ value: p.value, added: p.added, removed: p.removed }));
    return { field, parts, changed: parts.some((p) => p.added || p.removed) };
  });
}

/** One-line summary such as "caption: +4/−2 words; hashtags unchanged". */
export function summarizeWordDiff(diffs: FieldDiff[]): string {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  return diffs
    .map((d) => {
      if (!d.changed) return `${d.field} unchanged`;
      const add = d.parts.filter((p) => p.added).reduce((n, p) => n + words(p.value), 0);
      const rem = d.parts.filter((p) => p.removed).reduce((n, p) => n + words(p.value), 0);
      return `${d.field}: +${add}/−${rem} words`;
    })
    .join('; ');
}

/** Every revision of a post, oldest first, including the current one. */
export function allRevisions(post: { revisions: Revision[]; currentRevision: Revision }): Revision[] {
  return [...post.revisions, post.currentRevision].sort((x, y) => x.versionNumber - y.versionNumber);
}
