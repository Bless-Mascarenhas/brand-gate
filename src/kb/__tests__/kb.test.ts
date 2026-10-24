import { describe, it, expect } from 'vitest';
import { getPolicyPack } from '../parser';
import { getRoutedClauses } from '../routing';

describe('Knowledge Base & Policy Pack (Phase 2)', () => {
  const pack = getPolicyPack();

  it('indexes all 8 policy documents', () => {
    expect(pack.docs).toHaveLength(8);
    const prefixes = pack.docs.map((d) => d.prefix).sort();
    expect(prefixes).toEqual(['AF', 'AR', 'BV', 'CL', 'EM', 'SR', 'TM', 'VI']);
  });

  it('indexes at least 90 total clauses', () => {
    expect(pack.clauses.length).toBeGreaterThanOrEqual(90);
  });

  it('ensures every document has at least 10 clauses', () => {
    for (const doc of pack.docs) {
      expect(doc.clauses.length).toBeGreaterThanOrEqual(10);
    }
  });

  it('contains at least 45 machine-checkable rules', () => {
    expect(pack.rules.length).toBeGreaterThanOrEqual(45);
  });

  it('ensures EVERY rule clause ID resolves to a real indexed clause', () => {
    const clauseIds = new Set(pack.clauses.map((c) => c.id));
    for (const rule of pack.rules) {
      expect(
        clauseIds.has(rule.clause),
        `Rule ${rule.id} references clause ${rule.clause} which does not exist!`
      ).toBe(true);
    }
  });

  it('ensures every fact clause ID resolves to a real indexed clause', () => {
    const clauseIds = new Set(pack.clauses.map((c) => c.id));
    for (const fact of pack.facts) {
      expect(
        clauseIds.has(fact.clauseId),
        `Fact ${fact.id} references clause ${fact.clauseId} which does not exist!`
      ).toBe(true);
    }
  });

  it('generates a deterministic snapshot pack hash', () => {
    expect(pack.hash).toMatch(/^pack_[a-f0-9]{12}$/);
  });

  it('routes categories strictly to appropriate document clauses', () => {
    const toneClauses = getRoutedClauses('tone', pack);
    expect(toneClauses.length).toBeGreaterThan(0);
    for (const c of toneClauses) {
      expect(c.id.startsWith('BV')).toBe(true);
    }

    const claimClauses = getRoutedClauses('claims', pack);
    expect(claimClauses.length).toBeGreaterThan(0);
    for (const c of claimClauses) {
      const prefix = c.id.split('-')[0];
      expect(['CL', 'AF']).toContain(prefix);
    }
  });
});

describe('Company edits: re-indexing, version history, pack hash (Phase 2 completion)', async () => {
  const { getPolicyPack } = await import('@/src/kb');
  const { computePackHash } = await import('@/src/kb/clauses');
  const edits = await import('@/src/kb/edits');
  const pack = getPolicyPack();
  const bv = pack.docs.find((d) => d.prefix === 'BV')!;
  const memory = () => {
    const data = new Map<string, unknown>();
    return {
      getItem: async <T,>(k: string) => (data.has(k) ? (structuredClone(data.get(k)) as T) : null),
      setItem: async <T,>(k: string, v: T) => { data.set(k, structuredClone(v)); },
      removeItem: async (k: string) => { data.delete(k); },
      listKeys: async () => Array.from(data.keys()),
      clear: async () => data.clear(),
    };
  };

  it('browser hash of the unedited pack equals the server hash', async () => {
    expect(await computePackHash(pack.docs, pack.facts, pack.rules)).toBe(pack.hash);
    expect(await edits.editedPackHash(pack, {})).toBe(pack.hash);
  });

  it('an edit re-indexes clauses and bumps the pack hash; history keeps every version', async () => {
    const a = memory();
    const clarified = bv.content.replace('Keep the tone friendly but not too casual.', 'Keep the tone friendly but not too casual: no slang outside TM-006 and at most one joke per caption.');
    expect(clarified).not.toBe(bv.content);
    let h = await edits.saveDocEdit(bv, clarified, { role: 'manager', user: 'manager-demo', note: 'Clarify BV-007', now: '2026-10-24T10:00:00.000Z' }, a);
    h = await edits.saveDocEdit(bv, clarified + '\n\n[BV-012] Do not use sarcasm about customers.', { role: 'manager', user: 'manager-demo', note: 'Add BV-012' }, a);
    expect(h[bv.id].map((v) => v.version)).toEqual([1, 2]);
    const docs = edits.applyEdits(pack.docs, h);
    const edited = docs.find((d) => d.id === bv.id)!;
    expect(edited.clauses.find((c) => c.id === 'BV-007')?.text).toMatch(/at most one joke/);
    expect(edited.clauses.some((c) => c.id === 'BV-012')).toBe(true);
    expect(edited.version).toMatch(/\+local\.2$/);
    const hash = await edits.editedPackHash(pack, h);
    expect(hash).not.toBe(pack.hash);
    expect(await edits.loadEditHistory(a)).toEqual(h); // persisted
    const back = await edits.discardDocEdits(bv.id, 'manager', a);
    expect(await edits.editedPackHash(pack, back)).toBe(pack.hash);
  });

  it('only the Manager may edit or discard (EM-005), enforced in the edit module', async () => {
    const a = memory();
    for (const role of ['creator', 'reviewer'] as const) {
      await expect(edits.saveDocEdit(bv, bv.content, { role, user: 'x', note: '' }, a)).rejects.toThrow(/Manager/);
      await expect(edits.discardDocEdits(bv.id, role, a)).rejects.toThrow(/Manager/);
    }
  });

  it('rejects edits that break clause structure and warns on removed clauses', () => {
    expect(edits.checkEdit(bv, 'no clauses here').ok).toBe(false);
    expect(edits.checkEdit(bv, '[TM-001] wrong prefix').errors.join()).toMatch(/BV prefix/);
    expect(edits.checkEdit(bv, '[BV-001] a\n[BV-001] b').errors.join()).toMatch(/Duplicate/);
    const shortened = edits.checkEdit(bv, '[BV-001] Only one clause left.');
    expect(shortened.ok).toBe(true);
    expect(shortened.warnings.join()).toMatch(/BV-007/);
  });
});
