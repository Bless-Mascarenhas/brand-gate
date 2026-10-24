import { Finding, Verdict } from '@/src/types';

export interface ScoringWeights {
  critical: number;
  major: number;
  minor: number;
  info: number;
  blockedThreshold: number;
  readyThreshold: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  critical: 40,
  major: 15,
  minor: 5,
  info: 0,
  blockedThreshold: 70,
  readyThreshold: 90,
};

export interface ScoreResult {
  score: number;
  penalties: {
    critical: number;
    major: number;
    minor: number;
    total: number;
  };
  verdict: Verdict;
}

/**
 * Computes the Brand Compliance Score and final operational Verdict.
 * Rules:
 * - Only VERIFIED findings incur penalties.
 * - Disputed findings incur ZERO penalty (disagreement is data, surfaced to human).
 * - Single-source major or critical findings trigger needsHuman flag.
 * - BLOCKED: any critical finding, any failed hard gate, or score < 70.
 * - REVISE: 70 <= score < 90, or any open non-disputed major finding.
 * - READY_FOR_HUMAN: score >= 90, zero critical, zero open major, and zero major disputes.
 */
export function computeScoreAndVerdict(
  verifiedFindings: Finding[],
  gatesFailed: string[] = [],
  hallucinationsBlocked: number = 0,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): ScoreResult {
  let criticalCount = 0;
  let majorCount = 0;
  let minorCount = 0;

  const needsHuman: string[] = [];

  for (const f of verifiedFindings) {
    // Disputed findings incur zero penalty
    if (f.agreement === 'disputed') {
      needsHuman.push(`Disputed finding on clause ${f.clauseId} (${f.severity})`);
      continue;
    }

    if (f.agreement === 'single_source' && (f.severity === 'major' || f.severity === 'critical')) {
      needsHuman.push(`Single-source finding on clause ${f.clauseId} (${f.severity})`);
    }

    if (f.severity === 'critical') criticalCount++;
    else if (f.severity === 'major') majorCount++;
    else if (f.severity === 'minor') minorCount++;
  }

  const penaltyTotal =
    criticalCount * weights.critical +
    majorCount * weights.major +
    minorCount * weights.minor;

  const score = Math.max(0, 100 - penaltyTotal);

  // Status computation
  let status: 'BLOCKED' | 'REVISE' | 'READY_FOR_HUMAN' = 'READY_FOR_HUMAN';

  const hasCritical = criticalCount > 0 || gatesFailed.length > 0;
  const hasOpenMajor = majorCount > 0;
  const hasMajorDispute = verifiedFindings.some(
    (f) => f.agreement === 'disputed' && (f.severity === 'major' || f.severity === 'critical')
  );

  if (hasCritical || score < weights.blockedThreshold) {
    status = 'BLOCKED';
  } else if (hasOpenMajor || score < weights.readyThreshold || hasMajorDispute) {
    status = 'REVISE';
  } else {
    status = 'READY_FOR_HUMAN';
  }

  return {
    score,
    penalties: {
      critical: criticalCount * weights.critical,
      major: majorCount * weights.major,
      minor: minorCount * weights.minor,
      total: penaltyTotal,
    },
    verdict: {
      status,
      score,
      gatesFailed,
      needsHuman,
      hallucinationsBlocked,
    },
  };
}
