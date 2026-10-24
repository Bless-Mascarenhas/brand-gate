// src/insights/aggregate.ts
/** Pure aggregations over stored insight events. No hardcoded figures. */
import { Category, PolicyPack, Role } from '@/src/types';
import { CheckEvent, HumanEvent, InsightEvent } from '@/src/insights/types';

const checks = (events: InsightEvent[]) => events.filter((e): e is CheckEvent => e.kind === 'check');
const humans = (events: InsightEvent[]) => events.filter((e): e is HumanEvent => e.kind !== 'check');

/** ISO week start (Monday) of a timestamp, as YYYY-MM-DD. */
export function weekOf(ts: string): string {
  const d = new Date(ts);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

export function violationsByCategoryOverTime(events: InsightEvent[]): { week: string; counts: Partial<Record<Category, number>> }[] {
  const byWeek = new Map<string, Partial<Record<Category, number>>>();
  for (const c of checks(events)) {
    const w = weekOf(c.ts);
    const row = byWeek.get(w) ?? {};
    for (const f of c.findings) row[f.category] = (row[f.category] ?? 0) + 1;
    byWeek.set(w, row);
  }
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, counts]) => ({ week, counts }));
}

export function topViolatedClauses(events: InsightEvent[], limit = 10): { clauseId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of checks(events)) for (const f of c.findings) counts.set(f.clauseId, (counts.get(f.clauseId) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([clauseId, count]) => ({ clauseId, count }))
    .sort((a, b) => b.count - a.count || a.clauseId.localeCompare(b.clauseId))
    .slice(0, limit);
}

export const SCORE_BUCKETS = ['0–49', '50–69', '70–79', '80–89', '90–100'] as const;
const bucketOf = (s: number) => (s < 50 ? 0 : s < 70 ? 1 : s < 80 ? 2 : s < 90 ? 3 : 4);

export function scoreDistribution(events: InsightEvent[]): { bucket: string; firstPass: number; afterFix: number }[] {
  const rows = SCORE_BUCKETS.map((bucket) => ({ bucket: bucket as string, firstPass: 0, afterFix: 0 }));
  for (const c of checks(events)) {
    const row = rows[bucketOf(c.score)];
    if (c.pass === 'first') row.firstPass++;
    else row.afterFix++;
  }
  return rows;
}

/** Mean governance-loop iterations of checks that reached READY_FOR_HUMAN; null when none recorded. */
export function averageIterationsToReady(events: InsightEvent[]): { average: number | null; runs: number } {
  const ready = checks(events).filter((c) => c.verdict === 'READY_FOR_HUMAN' && typeof c.iterations === 'number');
  if (ready.length === 0) return { average: null, runs: 0 };
  return { average: ready.reduce((s, c) => s + (c.iterations as number), 0) / ready.length, runs: ready.length };
}

export interface AmbiguityRow {
  clauseId: string;
  disputed: number;
  overrides: number;
  rejections: number;
  totalChecks: number;
  /** (disputed + overrides + rejections) / totalChecks; null when the clause was never checked. */
  index: number | null;
  evidence: { kind: 'disputed' | 'human_override' | 'human_rejection'; text: string; sample: boolean }[];
}

/**
 * Ambiguity Index for one clause:
 *   (disputed findings + human overrides + human rejections citing it) / total checks citing it
 * where a check "cites" a clause when the clause was evaluated in that check.
 */
export function ambiguityForClause(events: InsightEvent[], clauseId: string): AmbiguityRow {
  const row: AmbiguityRow = { clauseId, disputed: 0, overrides: 0, rejections: 0, totalChecks: 0, index: null, evidence: [] };
  for (const c of checks(events)) {
    const cited = c.checkedClauseIds.includes(clauseId) || c.findings.some((f) => f.clauseId === clauseId);
    if (!cited) continue;
    row.totalChecks++;
    for (const f of c.findings) {
      if (f.clauseId === clauseId && f.agreement === 'disputed') {
        row.disputed++;
        row.evidence.push({ kind: 'disputed', text: f.quote ? `Reviewers disagreed on “${f.quote}”` : 'Reviewers disagreed', sample: c.sample });
      }
    }
  }
  for (const h of humans(events)) {
    if (!h.clauseIds.includes(clauseId)) continue;
    if (h.kind === 'human_override') row.overrides++;
    else row.rejections++;
    row.evidence.push({ kind: h.kind, text: `${h.role}: ${h.reason}`, sample: h.sample });
  }
  row.index = row.totalChecks === 0 ? null : (row.disputed + row.overrides + row.rejections) / row.totalChecks;
  return row;
}

/** All clauses with a defined index, highest first. Clauses never checked are excluded (index null). */
export function ambiguityRanking(events: InsightEvent[], clauseIds: string[]): AmbiguityRow[] {
  return clauseIds
    .map((id) => ambiguityForClause(events, id))
    .filter((r) => r.index !== null && r.index > 0)
    .sort((a, b) => (b.index as number) - (a.index as number) || b.totalChecks - a.totalChecks);
}

export interface CoverageRow {
  clauseId: string;
  docTitle: string;
  ruleIds: string[];
  coverage: 'deterministic' | 'llm_only';
}

/** Which clauses have at least one deterministic rule vs LLM-only coverage (purpose clauses -000 excluded). */
export function ruleCoverage(pack: Pick<PolicyPack, 'clauses' | 'rules'>): CoverageRow[] {
  return pack.clauses
    .filter((c) => !c.id.endsWith('-000'))
    .map((c) => {
      const ruleIds = pack.rules.filter((r) => r.clause === c.id).map((r) => r.id);
      return { clauseId: c.id, docTitle: c.docTitle, ruleIds, coverage: ruleIds.length ? 'deterministic' : 'llm_only' };
    });
}

export function hallucinationsBlocked(events: InsightEvent[]): { total: number; byModel: { model: string; count: number; reasons: string[] }[] } {
  const by = new Map<string, { count: number; reasons: string[] }>();
  for (const c of checks(events)) {
    for (const h of c.hallucinations) {
      const e = by.get(h.model) ?? { count: 0, reasons: [] };
      e.count++;
      if (e.reasons.length < 3 && !e.reasons.includes(h.reason)) e.reasons.push(h.reason);
      by.set(h.model, e);
    }
  }
  const byModel = Array.from(by.entries()).map(([model, v]) => ({ model, ...v })).sort((a, b) => b.count - a.count);
  return { total: byModel.reduce((s, m) => s + m.count, 0), byModel };
}

/** Human decisions aggregated by role only — never by individual. */
export function humanDecisionsByRole(events: InsightEvent[]): { role: Role; overrides: number; rejections: number }[] {
  const roles: Role[] = ['creator', 'reviewer', 'manager'];
  return roles.map((role) => ({
    role,
    overrides: humans(events).filter((h) => h.role === role && h.kind === 'human_override').length,
    rejections: humans(events).filter((h) => h.role === role && h.kind === 'human_rejection').length,
  }));
}

export function eventCounts(events: InsightEvent[]): { sample: number; live: number; checks: number; human: number } {
  return {
    sample: events.filter((e) => e.sample).length,
    live: events.filter((e) => !e.sample).length,
    checks: checks(events).length,
    human: humans(events).length,
  };
}
