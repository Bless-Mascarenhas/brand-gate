// src/compare/metrics.ts
/**
 * The ONE independent scorer applied to every Compare column: the
 * deterministic gate engine's result, summarised the same way regardless of
 * which system produced the post. Pure; works on client and server.
 */
import { Finding, LlmCallLog, Rule, Severity, Verdict } from '@/src/types';
import { computeScoreAndVerdict } from '@/src/verify/scoring';

export interface GateLike {
  findings: Finding[];
  gatesFailed: string[];
}

export interface CompareMetrics {
  gateFailures: number;
  staleOrWrongFacts: number;
  bannedTerms: number;
  unsupportedClaims: number;
  accessibilityGaps: number;
  bySeverity: Record<Severity, number>;
  score: number;
  verdict: Verdict['status'];
}

export interface RunCost {
  wallMs: number | null;
  llmCallCount: number;
  tokensIn: number | null;
  tokensOut: number | null;
  /** true when at least one call did not report token usage (totals are then a lower bound or null). */
  tokensIncomplete: boolean;
}

/** Gate findings carry the rule id in their id: `finding-<RULE-ID>-<ts>-<n>`. */
export function ruleIdOf(f: Finding): string | undefined {
  return /^finding-(R-[A-Z]+-\d+)-/.exec(f.id)?.[1];
}

export function compareMetrics(gate: GateLike, rules: Pick<Rule, 'id' | 'type'>[]): CompareMetrics {
  const typeOf = new Map(rules.map((r) => [r.id, r.type]));
  const bySeverity: Record<Severity, number> = { critical: 0, major: 0, minor: 0, info: 0 };
  let bannedTerms = 0;
  for (const f of gate.findings) {
    bySeverity[f.severity]++;
    const id = ruleIdOf(f);
    if (id && typeOf.get(id) === 'banned_term' && f.category === 'terminology') bannedTerms++;
  }
  const { verdict } = computeScoreAndVerdict(gate.findings, gate.gatesFailed);
  return {
    gateFailures: gate.gatesFailed.length,
    staleOrWrongFacts: gate.findings.filter((f) => f.category === 'factual_accuracy').length,
    bannedTerms,
    unsupportedClaims: gate.findings.filter((f) => f.category === 'claims').length,
    accessibilityGaps: gate.findings.filter((f) => f.category === 'accessibility').length,
    bySeverity,
    score: verdict.score,
    verdict: verdict.status,
  };
}

export function runCost(logs: LlmCallLog[], wallMs: number | null): RunCost {
  const missing = logs.some((l) => typeof l.tokensIn !== 'number' || typeof l.tokensOut !== 'number');
  const sum = (k: 'tokensIn' | 'tokensOut') => (logs.length === 0 ? 0 : logs.reduce((s, l) => s + (l[k] ?? 0), 0));
  return {
    wallMs,
    llmCallCount: logs.length,
    tokensIn: missing && logs.every((l) => typeof l.tokensIn !== 'number') ? null : sum('tokensIn'),
    tokensOut: missing && logs.every((l) => typeof l.tokensOut !== 'number') ? null : sum('tokensOut'),
    tokensIncomplete: missing,
  };
}
