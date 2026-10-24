// src/benchmark/calibrate.ts — threshold/weight sweep over the DEV split only.
import { Finding } from '@/src/types';
import { computeScoreAndVerdict, DEFAULT_SCORING_WEIGHTS, ScoringWeights } from '@/src/verify/scoring';
import { BenchmarkPost, PredictedFinding } from '@/src/benchmark/metrics';

export class HeldOutSplitError extends Error {}

/** Refuse to calibrate on anything but the dev split (spec §13, §24). */
export function assertDevOnly(posts: BenchmarkPost[]): BenchmarkPost[] {
  const leaked = posts.filter((p) => p.split !== 'dev').map((p) => p.id);
  if (leaked.length) throw new HeldOutSplitError(`Calibration received held-out posts: ${leaked.join(', ')}`);
  return posts;
}

export const SWEEP = {
  critical: [30, 40, 50],
  major: [10, 15, 20],
  minor: [3, 5, 8, 10],
  blockedThreshold: [60, 70, 80],
  readyThreshold: [85, 90, 95],
} as const;

export interface CalibrationRow {
  weights: ScoringWeights;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number | null;
  recall: number | null;
  falsePositiveRate: number | null;
  youdenJ: number | null;
}

export interface PostFindings {
  findings: PredictedFinding[];
  gatesFailed: string[];
}

const toFinding = (f: PredictedFinding, i: number): Finding => ({
  id: `cal-${i}`, source: f.source === 'gate' ? 'gate' : 'groq', category: f.category, severity: f.severity, clauseId: f.clauseId,
  clauseQuote: '', postField: 'caption', postQuote: '', explanation: '', autoFixable: false, confidence: 1, verified: true, agreement: f.agreement,
});

/**
 * Post-level classification: "flagged" = verdict is not READY_FOR_HUMAN; a post
 * truly needs revision when it has at least one expected violation.
 */
export function evaluateWeights(posts: BenchmarkPost[], findings: Map<string, PostFindings>, weights: ScoringWeights): CalibrationRow {
  assertDevOnly(posts);
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const p of posts) {
    const pf = findings.get(p.id) ?? { findings: [], gatesFailed: [] };
    const flagged = computeScoreAndVerdict(pf.findings.map(toFinding), pf.gatesFailed, 0, weights).verdict.status !== 'READY_FOR_HUMAN';
    const positive = p.expectedViolations.length > 0;
    if (flagged && positive) tp++;
    else if (flagged) fp++;
    else if (positive) fn++;
    else tn++;
  }
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const falsePositiveRate = fp + tn ? fp / (fp + tn) : null;
  return { weights, tp, fp, fn, tn, precision, recall, falsePositiveRate, youdenJ: recall === null || falsePositiveRate === null ? null : recall - falsePositiveRate };
}

/** Distance from the shipped defaults, used only to break ties (prefer the smallest change). */
const distance = (w: ScoringWeights) =>
  (Object.keys(DEFAULT_SCORING_WEIGHTS) as (keyof ScoringWeights)[]).reduce((s, k) => s + Math.abs(w[k] - DEFAULT_SCORING_WEIGHTS[k]) / (DEFAULT_SCORING_WEIGHTS[k] || 1), 0);

export function sweep(posts: BenchmarkPost[], findings: Map<string, PostFindings>): { rows: CalibrationRow[]; selected: CalibrationRow; defaultRow: CalibrationRow } {
  assertDevOnly(posts);
  const rows: CalibrationRow[] = [];
  for (const critical of SWEEP.critical)
    for (const major of SWEEP.major)
      for (const minor of SWEEP.minor)
        for (const blockedThreshold of SWEEP.blockedThreshold)
          for (const readyThreshold of SWEEP.readyThreshold) {
            if (blockedThreshold >= readyThreshold) continue;
            rows.push(evaluateWeights(posts, findings, { critical, major, minor, info: 0, blockedThreshold, readyThreshold }));
          }
  const best = Math.max(...rows.map((r) => r.youdenJ ?? -Infinity));
  const selected = rows.filter((r) => (r.youdenJ ?? -Infinity) === best).sort((a, b) => distance(a.weights) - distance(b.weights))[0];
  return { rows, selected, defaultRow: evaluateWeights(posts, findings, DEFAULT_SCORING_WEIGHTS) };
}
