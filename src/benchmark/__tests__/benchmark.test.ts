import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getPolicyPack } from '@/src/kb';
import { BenchmarkPost, Prediction, PredictedFinding, resolveClause, scoreSystem } from '@/src/benchmark/metrics';
import { HeldOutSplitError, assertDevOnly, evaluateWeights, sweep } from '@/src/benchmark/calibrate';
import { DEFAULT_SCORING_WEIGHTS } from '@/src/verify/scoring';
import { evaluatePost } from '@/src/rules/engine';

const pack = getPolicyPack();
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'benchmark', f), 'utf-8'));
const posts: BenchmarkPost[] = read('posts.json').posts;

describe('benchmark dataset integrity', () => {
  it('has 60 posts: 30 dev / 30 test and 20 clean / 20 subtle / 20 clear', () => {
    expect(posts).toHaveLength(60);
    const count = (k: keyof BenchmarkPost, v: string) => posts.filter((p) => p[k] === v).length;
    expect([count('split', 'dev'), count('split', 'test')]).toEqual([30, 30]);
    expect([count('class', 'clean'), count('class', 'subtle'), count('class', 'clear')]).toEqual([20, 20, 20]);
    for (const cls of ['clean', 'subtle', 'clear']) {
      expect(posts.filter((p) => p.class === cls && p.split === 'dev')).toHaveLength(10);
    }
    expect(new Set(posts.map((p) => p.id)).size).toBe(60);
  });

  it('clean posts have no expected violations; the others have at least one, each resolving to a real clause', () => {
    const clauses = new Set(pack.clauses.map((c) => c.id));
    for (const p of posts) {
      if (p.class === 'clean') expect(p.expectedViolations).toEqual([]);
      else expect(p.expectedViolations.length).toBeGreaterThan(0);
      for (const e of p.expectedViolations) expect(clauses.has(resolveClause(e.ruleOrClause, pack.rules))).toBe(true);
    }
  });

  it('does not claim human-reviewed labels', () => {
    expect(posts.every((p) => p.labelsReviewed === false)).toBe(true);
    expect(read('posts.json').meta.description).toMatch(/NOT been reviewed by a human/);
  });
});

describe('benchmark metrics', () => {
  const mk = (id: string, cls: BenchmarkPost['class'], expected: string[]): BenchmarkPost => ({
    id, split: 'dev', class: cls, post: { caption: '', hashtags: [], format: 'feed_4_5', language: 'en' },
    expectedViolations: expected.map((c) => ({ ruleOrClause: c, category: 'terminology', severity: 'major' })), labelsReviewed: false,
  });
  const pf = (clauseId: string, source: 'gate' | 'llm' = 'gate'): PredictedFinding => ({ clauseId, category: 'terminology', severity: 'major', agreement: 'deterministic', source });
  const pred = (postId: string, findings: ReturnType<typeof pf>[], extra: Partial<Prediction> = {}): Prediction => ({
    postId, findings, gatesFailed: [], rawLlmCitations: 0, invalidLlmCitations: 0, debateAgreed: 0, debateDisputed: 0, ...extra,
  });

  it('computes precision, recall, clean FPR, citation validity and gate-only catches', () => {
    const ps = [mk('a', 'clear', ['TM-002', 'R-FACT-004']), mk('b', 'clean', []), mk('c', 'clean', [])];
    const m = scoreSystem(ps, [
      pred('a', [pf('TM-002'), pf('TM-002', 'llm'), pf('AF-003', 'llm'), pf('BV-007', 'llm')], { rawLlmCitations: 4, invalidLlmCitations: 1, debateAgreed: 1 }),
      pred('b', [pf('SR-008')]),
      pred('c', []),
    ], pack.rules);
    // R-FACT-004 resolves to AF-003; BV-007 and SR-008 are false positives
    expect(m).toMatchObject({ tp: 2, fp: 2, fn: 0, cleanPosts: 2, cleanPostsFlagged: 1, hallucinatedCitations: 1, caughtOnlyByGates: 0, debateAgreed: 1 });
    expect(m.precision).toBe(0.5);
    expect(m.recall).toBe(1);
    expect(m.falsePositiveRateOnClean).toBe(0.5);
    expect(m.citationValidity).toBe(0.75);
  });

  it('a violation found only by a gate counts as caught-only-by-gates', () => {
    const m = scoreSystem([mk('a', 'subtle', ['TM-002'])], [pred('a', [pf('TM-002', 'gate')])], pack.rules);
    expect(m.caughtOnlyByGates).toBe(1);
  });

  it('reports null instead of dividing by zero, and counts failed posts', () => {
    const m = scoreSystem([mk('a', 'clean', [])], [pred('a', [], { error: 'provider down' })], pack.rules);
    expect(m.precision).toBeNull();
    expect(m.recall).toBeNull();
    expect(m.citationValidity).toBeNull();
    expect(m.falsePositiveRateOnClean).toBe(0);
    expect(m.failedPosts).toBe(1);
  });

  it('info findings are ignored', () => {
    const m = scoreSystem([mk('a', 'clean', [])], [pred('a', [{ ...pf('BV-007'), severity: 'info' }])], pack.rules);
    expect(m.fp).toBe(0);
    expect(m.cleanPostsFlagged).toBe(0);
  });
});

describe('calibration uses the dev split only', () => {
  const gateFindings = (ps: BenchmarkPost[]) =>
    new Map(ps.map((p) => {
      const g = evaluatePost(p.post, pack);
      return [p.id, { findings: g.findings.map((f) => ({ clauseId: f.clauseId, category: f.category, severity: f.severity, agreement: f.agreement, source: 'gate' as const })), gatesFailed: g.gatesFailed }];
    }));

  it('rejects any held-out post', () => {
    const test = posts.find((p) => p.split === 'test')!;
    expect(() => assertDevOnly([test])).toThrow(HeldOutSplitError);
    expect(() => sweep(posts, gateFindings(posts))).toThrow(HeldOutSplitError);
    expect(() => evaluateWeights(posts, gateFindings(posts), DEFAULT_SCORING_WEIGHTS)).toThrow(HeldOutSplitError);
  });

  it('sweeps every valid configuration and selects by Youden J with a deterministic tie-break', () => {
    const dev = posts.filter((p) => p.split === 'dev');
    const a = sweep(dev, gateFindings(dev));
    const b = sweep(dev, gateFindings(dev));
    expect(a.rows.length).toBe(324);
    expect(a.selected).toEqual(b.selected);
    const bestJ = Math.max(...a.rows.map((r) => r.youdenJ ?? -1));
    expect(a.selected.youdenJ).toBe(bestJ);
    expect(a.rows.every((r) => r.tp + r.fp + r.fn + r.tn === 30)).toBe(true);
  });

  it('the committed calibration.json used dev posts only', () => {
    const cal = read('calibration.json');
    expect(cal.meta.split).toBe('dev');
    expect(cal.meta.devPosts).toBe(30);
    expect(cal.meta.heldOutPostsUsed).toBe(0);
    expect(cal.rows.every((r: { tp: number; fp: number; fn: number; tn: number }) => r.tp + r.fp + r.fn + r.tn === 30)).toBe(true);
  });
});

describe('committed benchmark results are honestly labelled', () => {
  const res = read('results.json');
  it('records what actually executed', () => {
    expect(['live', 'partial_live', 'deterministic_only']).toContain(res.meta.execution);
    expect(res.meta.generator).toBe('scripts/benchmark.ts');
    expect(res.meta.labelsHumanReviewed).toBe('0/60');
    if (res.systems.baseline.status === 'not_run') {
      expect(res.systems.baseline.metrics).toBeUndefined();
      expect(res.meta.caveats.join(' ')).toMatch(/Baseline .* was NOT run/);
    }
    if (res.systems.governed.reviewers === 'not_run') expect(res.meta.execution).not.toBe('live');
  });

  it('per-post governed findings re-score to the stored metrics (no hand-edited numbers)', () => {
    const preds: Prediction[] = Object.entries(res.perPost).map(([postId, p]) => ({ ...(p as { governed: Prediction }).governed, postId }));
    const recomputed = scoreSystem(posts, preds, pack.rules);
    const stored = res.systems.governed.metrics.all;
    expect({ tp: recomputed.tp, fp: recomputed.fp, fn: recomputed.fn }).toEqual({ tp: stored.tp, fp: stored.fp, fn: stored.fn });
  });
});
