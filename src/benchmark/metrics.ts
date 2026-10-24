// src/benchmark/metrics.ts — pure benchmark scoring. A prediction matches a label when it cites the same clause.
import { Category, PostContent, Rule, Severity, Finding } from '@/src/types';

export interface ExpectedViolation {
  ruleOrClause: string;
  category: Category;
  severity: Severity;
}

export interface BenchmarkPost {
  id: string;
  split: 'dev' | 'test';
  class: 'clean' | 'subtle' | 'clear';
  post: PostContent;
  expectedViolations: ExpectedViolation[];
  labelsReviewed: boolean;
  notes?: string;
}

export interface PredictedFinding {
  clauseId: string;
  category: Category;
  severity: Severity;
  agreement: Finding['agreement'];
  source: 'gate' | 'llm';
}

export interface Prediction {
  postId: string;
  findings: PredictedFinding[];
  gatesFailed: string[];
  /** LLM citations produced before verification (governed) or in total (baseline). */
  rawLlmCitations: number;
  invalidLlmCitations: number;
  debateAgreed: number;
  debateDisputed: number;
  error?: string;
}

export interface Counts {
  tp: number;
  fp: number;
  fn: number;
  precision: number | null;
  recall: number | null;
}

export interface SystemMetrics extends Counts {
  posts: number;
  cleanPosts: number;
  cleanPostsFlagged: number;
  falsePositiveRateOnClean: number | null;
  citationValidity: number | null;
  hallucinatedCitations: number;
  caughtOnlyByGates: number;
  debateAgreed: number;
  debateDisputed: number;
  failedPosts: number;
  perCategory: Partial<Record<Category, Counts>>;
}

const ratio = (a: number, b: number) => (b === 0 ? null : a / b);
const withRates = (c: { tp: number; fp: number; fn: number }): Counts => ({ ...c, precision: ratio(c.tp, c.tp + c.fp), recall: ratio(c.tp, c.tp + c.fn) });

/** Labels may name a rule (R-TERM-001) or a clause (TM-002); everything is compared at clause level. */
export function resolveClause(ruleOrClause: string, rules: Pick<Rule, 'id' | 'clause'>[]): string {
  return rules.find((r) => r.id === ruleOrClause)?.clause ?? ruleOrClause;
}

export function scoreSystem(posts: BenchmarkPost[], predictions: Prediction[], rules: Pick<Rule, 'id' | 'clause'>[]): SystemMetrics {
  const byId = new Map(predictions.map((p) => [p.postId, p]));
  const perCat = new Map<Category, { tp: number; fp: number; fn: number }>();
  const cat = (c: Category) => perCat.get(c) ?? (perCat.set(c, { tp: 0, fp: 0, fn: 0 }), perCat.get(c)!);
  let tp = 0, fp = 0, fn = 0, cleanPosts = 0, cleanPostsFlagged = 0, caughtOnlyByGates = 0, failedPosts = 0;
  let raw = 0, invalid = 0, agreed = 0, disputed = 0;

  for (const post of posts) {
    const pred = byId.get(post.id);
    if (!pred || pred.error) failedPosts++;
    const found = (pred?.findings ?? []).filter((f) => f.severity !== 'info');
    const predicted = new Map<string, PredictedFinding[]>();
    for (const f of found) predicted.set(f.clauseId, [...(predicted.get(f.clauseId) ?? []), f]);
    const expected = new Map(post.expectedViolations.map((e) => [resolveClause(e.ruleOrClause, rules), e]));

    for (const [clauseId, e] of expected) {
      const hits = predicted.get(clauseId);
      if (hits) {
        tp++; cat(e.category).tp++;
        if (hits.every((h) => h.source === 'gate')) caughtOnlyByGates++;
      } else {
        fn++; cat(e.category).fn++;
      }
    }
    for (const [clauseId, hits] of predicted) {
      if (!expected.has(clauseId)) { fp++; cat(hits[0].category).fp++; }
    }
    if (post.class === 'clean') {
      cleanPosts++;
      if (found.length > 0) cleanPostsFlagged++;
    }
    raw += pred?.rawLlmCitations ?? 0;
    invalid += pred?.invalidLlmCitations ?? 0;
    agreed += pred?.debateAgreed ?? 0;
    disputed += pred?.debateDisputed ?? 0;
  }

  return {
    ...withRates({ tp, fp, fn }),
    posts: posts.length,
    cleanPosts,
    cleanPostsFlagged,
    falsePositiveRateOnClean: ratio(cleanPostsFlagged, cleanPosts),
    citationValidity: ratio(raw - invalid, raw),
    hallucinatedCitations: invalid,
    caughtOnlyByGates,
    debateAgreed: agreed,
    debateDisputed: disputed,
    failedPosts,
    perCategory: Object.fromEntries(Array.from(perCat.entries()).map(([k, v]) => [k, withRates(v)])),
  };
}

export const pct = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);
