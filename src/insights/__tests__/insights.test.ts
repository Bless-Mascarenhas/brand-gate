import { describe, it, expect } from 'vitest';
import { CheckEvent, HumanEvent, InsightEvent } from '@/src/insights/types';
import {
  ambiguityForClause,
  ambiguityRanking,
  averageIterationsToReady,
  eventCounts,
  hallucinationsBlocked,
  humanDecisionsByRole,
  ruleCoverage,
  scoreDistribution,
  topViolatedClauses,
  violationsByCategoryOverTime,
  weekOf,
} from '@/src/insights/aggregate';
import { SEEDED_INSIGHT_EVENTS, appendInsightEvents, loadAllEvents } from '@/src/insights/store';
import { StorageAdapter } from '@/src/storage';
import { getPolicyPack } from '@/src/kb';

const check = (over: Partial<CheckEvent>): CheckEvent => ({
  kind: 'check', id: Math.random().toString(36), ts: '2026-10-21T10:00:00.000Z', sample: false, origin: 'verify', pass: 'first',
  score: 80, verdict: 'REVISE', checkedClauseIds: ['BV-007', 'TM-002'], findings: [], hallucinations: [], ...over,
});
const human = (over: Partial<HumanEvent>): HumanEvent => ({
  kind: 'human_override', id: Math.random().toString(36), ts: '2026-10-21T11:00:00.000Z', sample: false, role: 'manager', clauseIds: ['BV-007'], reason: 'r', ...over,
});

describe('Ambiguity Index', () => {
  it('= (disputed + overrides + rejections) / total checks citing the clause', () => {
    const events: InsightEvent[] = [
      check({ findings: [{ clauseId: 'BV-007', category: 'tone', severity: 'minor', agreement: 'disputed', source: 'groq', quote: 'lowkey' }] }),
      check({}),
      check({}),
      check({ checkedClauseIds: ['TM-002'] }), // does not cite BV-007
      human({ kind: 'human_override' }),
      human({ kind: 'human_rejection', role: 'reviewer' }),
    ];
    const row = ambiguityForClause(events, 'BV-007');
    expect(row).toMatchObject({ disputed: 1, overrides: 1, rejections: 1, totalChecks: 3 });
    expect(row.index).toBeCloseTo(3 / 3);
    expect(row.evidence).toHaveLength(3);
  });

  it('returns null (not 0, not NaN) when the clause was never checked', () => {
    const row = ambiguityForClause([human({ clauseIds: ['SR-009'] })], 'SR-009');
    expect(row.totalChecks).toBe(0);
    expect(row.index).toBeNull();
  });

  it('a finding citing a clause counts as a check of it even if not listed', () => {
    const row = ambiguityForClause([check({ checkedClauseIds: [], findings: [{ clauseId: 'CL-004', category: 'claims', severity: 'major', agreement: 'agreed', source: 'nvidia' }] })], 'CL-004');
    expect(row.totalChecks).toBe(1);
    expect(row.index).toBe(0);
  });

  it('ranking excludes never-checked and zero-index clauses', () => {
    const events = [check({ findings: [{ clauseId: 'BV-007', category: 'tone', severity: 'minor', agreement: 'disputed', source: 'groq' }] })];
    const ranked = ambiguityRanking(events, ['BV-007', 'TM-002', 'SR-009']);
    expect(ranked.map((r) => r.clauseId)).toEqual(['BV-007']);
  });
});

describe('aggregations', () => {
  const ev: InsightEvent[] = [
    check({ ts: '2026-10-12T10:00:00.000Z', findings: [{ clauseId: 'TM-002', category: 'terminology', severity: 'major', agreement: 'deterministic', source: 'gate' }], score: 40 }),
    check({ ts: '2026-10-13T10:00:00.000Z', findings: [{ clauseId: 'TM-002', category: 'terminology', severity: 'major', agreement: 'deterministic', source: 'gate' }, { clauseId: 'CL-002', category: 'claims', severity: 'critical', agreement: 'deterministic', source: 'gate' }], hallucinations: [{ model: 'nvidia', reason: 'clauseId does not exist' }] }),
    check({ ts: '2026-10-20T10:00:00.000Z', pass: 'after_fix', score: 95, verdict: 'READY_FOR_HUMAN', iterations: 2 }),
    check({ ts: '2026-10-21T10:00:00.000Z', pass: 'after_fix', score: 100, verdict: 'READY_FOR_HUMAN', iterations: 1, hallucinations: [{ model: 'groq (GPT-OSS)', reason: 'postQuote not found' }, { model: 'nvidia', reason: 'clauseQuote not found' }] }),
    human({ role: 'reviewer', kind: 'human_rejection', sample: true }),
  ];

  it('violations by category per week', () => {
    expect(weekOf('2026-10-14T10:00:00.000Z')).toBe('2026-10-12');
    expect(violationsByCategoryOverTime(ev)).toEqual([
      { week: '2026-10-12', counts: { terminology: 2, claims: 1 } },
      { week: '2026-10-19', counts: {} },
    ]);
  });

  it('most-violated clauses', () => {
    expect(topViolatedClauses(ev)).toEqual([{ clauseId: 'TM-002', count: 2 }, { clauseId: 'CL-002', count: 1 }]);
  });

  it('first-pass vs after-fix distribution', () => {
    const d = scoreDistribution(ev);
    expect(d.reduce((s, r) => s + r.firstPass, 0)).toBe(2);
    expect(d.reduce((s, r) => s + r.afterFix, 0)).toBe(2);
    expect(d.find((r) => r.bucket === '90–100')?.afterFix).toBe(2);
    expect(d.find((r) => r.bucket === '0–49')?.firstPass).toBe(1);
  });

  it('average iterations to READY, null without data', () => {
    expect(averageIterationsToReady(ev)).toEqual({ average: 1.5, runs: 2 });
    expect(averageIterationsToReady([])).toEqual({ average: null, runs: 0 });
  });

  it('hallucinations blocked by model', () => {
    const h = hallucinationsBlocked(ev);
    expect(h.total).toBe(3);
    expect(h.byModel[0]).toMatchObject({ model: 'nvidia', count: 2 });
  });

  it('human decisions aggregate by role only', () => {
    const rows = humanDecisionsByRole(ev);
    expect(rows.map((r) => r.role)).toEqual(['creator', 'reviewer', 'manager']);
    expect(rows.find((r) => r.role === 'reviewer')?.rejections).toBe(1);
    expect(JSON.stringify(rows)).not.toMatch(/user/);
  });

  it('sample vs live counts', () => {
    expect(eventCounts(ev)).toEqual({ sample: 1, live: 4, checks: 4, human: 1 });
  });

  it('rule coverage is computed from the real pack', () => {
    const pack = getPolicyPack();
    const rows = ruleCoverage(pack);
    const tm002 = rows.find((r) => r.clauseId === 'TM-002')!;
    expect(tm002.coverage).toBe('deterministic');
    expect(tm002.ruleIds).toContain('R-TERM-001');
    expect(rows.find((r) => r.clauseId === 'BV-007')?.coverage).toBe('llm_only');
    expect(rows.some((r) => r.clauseId.endsWith('-000'))).toBe(false);
  });
});

describe('seeded vs live events', () => {
  it('seed has ~120 events, all labelled sample, all clauses real', () => {
    const ids = new Set(getPolicyPack().clauses.map((c) => c.id));
    expect(SEEDED_INSIGHT_EVENTS.length).toBeGreaterThanOrEqual(110);
    expect(SEEDED_INSIGHT_EVENTS.length).toBeLessThanOrEqual(130);
    expect(SEEDED_INSIGHT_EVENTS.every((e) => e.sample === true)).toBe(true);
    for (const e of SEEDED_INSIGHT_EVENTS) {
      const cited = e.kind === 'check' ? e.findings.map((f) => f.clauseId) : e.clauseIds;
      for (const c of cited) expect(ids.has(c)).toBe(true);
    }
  });

  it('live events are stored separately and always labelled live', async () => {
    const data = new Map<string, unknown>();
    const adapter: StorageAdapter = {
      getItem: async <T,>(k: string) => (data.get(k) as T) ?? null,
      setItem: async <T,>(k: string, v: T) => { data.set(k, v); },
      removeItem: async (k: string) => { data.delete(k); },
      listKeys: async () => Array.from(data.keys()),
      clear: async () => data.clear(),
    };
    await appendInsightEvents([check({ sample: true, id: 'live-1' })], adapter); // caller cannot smuggle sample:true in
    const all = await loadAllEvents(adapter);
    expect(all.filter((e) => !e.sample).map((e) => e.id)).toEqual(['live-1']);
    expect(all.filter((e) => e.sample)).toHaveLength(SEEDED_INSIGHT_EVENTS.length);
  });
});

describe('clarification suggestions', () => {
  it('template fallback is deterministic, de-duplicates evidence and points to EM-005', async () => {
    const { templateClarification, buildClarifyPrompt } = await import('@/src/llm/prompts/clarify');
    const clause = getPolicyPack().clauses.find((c) => c.id === 'BV-007')!;
    const ev = ['Reviewers disagreed on “lowkey insane”', 'Reviewers disagreed on “lowkey insane”', 'manager: fine'];
    const t = templateClarification(clause, ev);
    expect(t.match(/lowkey insane/g)).toHaveLength(1);
    expect(t).toContain('EM-005');
    const p = buildClarifyPrompt(clause, ev);
    expect(p.system).toMatch(/suggestion/i);
    expect(p.user).toContain('<evidence>');
    expect(p.user).toContain('[BV-007]');
  });
});
