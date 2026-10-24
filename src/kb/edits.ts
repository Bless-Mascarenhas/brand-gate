// src/kb/edits.ts — Company document edits with version history (spec §16, Phase 2).
// Edits are stored in the browser through the StorageAdapter. Editing re-indexes
// clauses and produces a new local pack hash. The server-side review pipeline
// keeps using the approved pack in data/thrift-it (see KNOWN_LIMITATIONS).
import { PolicyDoc, PolicyPack, Role } from '@/src/types';
import { StorageAdapter, storage as defaultStorage } from '@/src/storage';
import { parseClausesFromMarkdown, computePackHash } from '@/src/kb/clauses';

export const KB_EDITS_KEY = 'kb:edits:v1';

export interface DocVersion {
  docId: string;
  version: number; // 1 = first local edit on top of the approved document
  content: string;
  note: string;
  role: Role;
  user: string;
  at: string;
  clauseCount: number;
}

export type EditHistory = Record<string, DocVersion[]>;

export class EditPermissionError extends Error {}

/** EM-005: policy clarifications and amendments are authored by the Manager. */
export function canEditPolicy(role: Role): boolean {
  return role === 'manager';
}

export interface EditCheck {
  ok: boolean;
  errors: string[];
  warnings: string[];
  clauseIds: string[];
}

/** Validate an edited document before saving: clauses must still parse and keep the document prefix. */
export function checkEdit(original: PolicyDoc, content: string): EditCheck {
  const clauses = parseClausesFromMarkdown(content, original.id, original.title);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (clauses.length === 0) errors.push('No clauses found. Clauses must be written as [PREFIX-NNN] text.');
  const foreign = clauses.filter((c) => !c.id.startsWith(`${original.prefix}-`)).map((c) => c.id);
  if (foreign.length) errors.push(`Clause IDs must use the ${original.prefix} prefix: ${foreign.join(', ')}`);
  const ids = clauses.map((c) => c.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`Duplicate clause IDs: ${Array.from(new Set(dupes)).join(', ')}`);
  const removed = original.clauses.map((c) => c.id).filter((id) => !ids.includes(id));
  if (removed.length) warnings.push(`Removes clause(s) ${removed.join(', ')} — findings and rules citing them will no longer resolve in this browser.`);
  return { ok: errors.length === 0, errors, warnings, clauseIds: ids };
}

export async function loadEditHistory(adapter: StorageAdapter = defaultStorage): Promise<EditHistory> {
  const stored = await adapter.getItem<unknown>(KB_EDITS_KEY);
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as EditHistory) : {};
}

export async function saveDocEdit(
  original: PolicyDoc,
  content: string,
  ctx: { role: Role; user: string; note: string; now?: string },
  adapter: StorageAdapter = defaultStorage
): Promise<EditHistory> {
  if (!canEditPolicy(ctx.role)) throw new EditPermissionError('Only the Manager role can edit policy documents (EM-005).');
  const check = checkEdit(original, content);
  if (!check.ok) throw new EditPermissionError(check.errors.join(' '));
  const history = await loadEditHistory(adapter);
  const versions = history[original.id] ?? [];
  const next: DocVersion = {
    docId: original.id,
    version: versions.length + 1,
    content,
    note: ctx.note.trim() || '(no note)',
    role: ctx.role,
    user: ctx.user,
    at: ctx.now ?? new Date().toISOString(),
    clauseCount: check.clauseIds.length,
  };
  const updated = { ...history, [original.id]: [...versions, next] };
  await adapter.setItem(KB_EDITS_KEY, updated);
  return updated;
}

/** Drop all local edits of one document (back to the approved version). Manager only. */
export async function discardDocEdits(docId: string, role: Role, adapter: StorageAdapter = defaultStorage): Promise<EditHistory> {
  if (!canEditPolicy(role)) throw new EditPermissionError('Only the Manager role can discard policy edits.');
  const history = await loadEditHistory(adapter);
  const { [docId]: _removed, ...rest } = history;
  void _removed;
  await adapter.setItem(KB_EDITS_KEY, rest);
  return rest;
}

/** Docs with their latest local edit applied and clauses re-indexed. */
export function applyEdits(docs: PolicyDoc[], history: EditHistory): PolicyDoc[] {
  return docs.map((d) => {
    const latest = history[d.id]?.at(-1);
    if (!latest) return d;
    return { ...d, content: latest.content, clauses: parseClausesFromMarkdown(latest.content, d.id, d.title), version: `${d.version}+local.${latest.version}` };
  });
}

/** Pack hash of the pack as edited in this browser (equals the server hash when there are no edits). */
export async function editedPackHash(pack: PolicyPack, history: EditHistory): Promise<string> {
  return computePackHash(applyEdits(pack.docs, history), pack.facts, pack.rules);
}
