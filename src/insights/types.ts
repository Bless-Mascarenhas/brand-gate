import { Category, Finding, Role, Severity, Verdict } from '@/src/types';

/** A finding as remembered for Insights: no post text beyond a short quote. */
export interface EventFinding {
  clauseId: string;
  category: Category;
  severity: Severity;
  agreement: Finding['agreement'];
  source: Finding['source'];
  quote?: string;
}

export interface CheckEvent {
  kind: 'check';
  id: string;
  ts: string;
  origin: 'verify' | 'build' | 'workflow' | 'compare';
  pass: 'first' | 'after_fix';
  score: number;
  verdict: Verdict['status'];
  /** Governance-loop iterations it took to reach this verdict (Build), when known. */
  iterations?: number;
  /** Clauses that were evaluated in this check (rules run + clauses routed to reviewers). */
  checkedClauseIds: string[];
  findings: EventFinding[];
  hallucinations: { model: string; reason: string }[];
  role?: Role;
}

export interface HumanEvent {
  kind: 'human_override' | 'human_rejection';
  id: string;
  ts: string;
  role: Role;
  clauseIds: string[];
  reason: string;
  postId?: string;
}

export type InsightEvent = CheckEvent | HumanEvent;

const MODEL_NAMES: Record<Finding['source'], string> = {
  groq: 'Reviewer A (Groq 2)',
  nvidia: 'Reviewer B (Groq 3)',
  groq1: 'Groq 1 (Drafter)',
  groq2: 'Reviewer A (Groq 2)',
  groq3: 'Reviewer B (Groq 3)',
  crosscheck: 'crosscheck',
  gate: 'gate',
};

/** Build a live check event from one pipeline run. */
export function checkEventFromRun(input: {
  origin: CheckEvent['origin'];
  pass: CheckEvent['pass'];
  verdict: Verdict;
  findings: Finding[];
  checkedClauseIds: string[];
  dropped?: Finding[];
  droppedReasons?: Record<string, string>;
  iterations?: number;
  role?: Role;
  ts?: string;
}): CheckEvent {
  const ts = input.ts ?? new Date().toISOString();
  return {
    kind: 'check',
    id: `${input.origin}-${Date.parse(ts)}-${Math.random().toString(36).slice(2, 7)}`,
    ts,
    origin: input.origin,
    pass: input.pass,
    score: input.verdict.score,
    verdict: input.verdict.status,
    iterations: input.iterations,
    checkedClauseIds: Array.from(new Set([...input.checkedClauseIds, ...input.findings.map((f) => f.clauseId)])),
    findings: input.findings.map(toEventFinding),
    hallucinations: (input.dropped ?? []).map((f) => ({
      model: MODEL_NAMES[f.source] ?? f.source,
      reason: input.droppedReasons?.[f.id] ?? 'failed citation verification',
    })),
    role: input.role,
  };
}

export function toEventFinding(f: Finding): EventFinding {
  return {
    clauseId: f.clauseId,
    category: f.category,
    severity: f.severity,
    agreement: f.agreement,
    source: f.source,
    quote: f.postQuote.slice(0, 80),
  };
}
