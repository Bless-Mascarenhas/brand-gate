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
