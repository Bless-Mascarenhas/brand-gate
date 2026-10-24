import { Finding } from '@/src/types';

export interface CrosscheckEvaluation {
  findingId: string;
  stance: 'agree' | 'disagree';
  reason: string;
}

export interface ConsensusInput {
  reviewerAFindings: Finding[];
  reviewerBFindings: Finding[];
  evaluationsFromA?: CrosscheckEvaluation[]; // Reviewer A evaluating B's findings
  evaluationsFromB?: CrosscheckEvaluation[]; // Reviewer B evaluating A's findings
}

/**
 * Normalizes and resolves consensus between Reviewer A (Grok/Groq) and Reviewer B (NVIDIA).
 * Both agree -> 'agreed'
 * Reviewer disagrees -> 'disputed' (penalties waived, surfaced to human)
 * Found by one reviewer without rebuttal -> 'single_source'
 */
export function adjudicateConsensus(input: ConsensusInput): Finding[] {
  const { reviewerAFindings, reviewerBFindings, evaluationsFromA = [], evaluationsFromB = [] } = input;

  const evalMapA = new Map<string, CrosscheckEvaluation>(evaluationsFromA.map((e) => [e.findingId, e]));
  const evalMapB = new Map<string, CrosscheckEvaluation>(evaluationsFromB.map((e) => [e.findingId, e]));

  const resolvedFindings: Finding[] = [];
  const processedKeys = new Set<string>();

  // 1. Process Reviewer A findings
  for (const fA of reviewerAFindings) {
    const key = `${fA.clauseId}::${fA.postField}::${fA.postQuote.toLowerCase().trim()}`;
    processedKeys.add(key);

    // Look for direct evaluation from Reviewer B
    const evalFromB = evalMapB.get(fA.id);

    // Also check if Reviewer B independently produced an identical finding
    const matchingB = reviewerBFindings.find(
      (fB) =>
        fB.clauseId === fA.clauseId &&
        (fB.postQuote.toLowerCase().includes(fA.postQuote.toLowerCase()) ||
          fA.postQuote.toLowerCase().includes(fB.postQuote.toLowerCase()))
    );

    if (evalFromB) {
      if (evalFromB.stance === 'agree') {
        resolvedFindings.push({
          ...fA,
          agreement: 'agreed',
          disputeNotes: [
            {
              model: 'Reviewer B',
              stance: 'agree',
              reason: evalFromB.reason || 'Verified policy alignment',
            },
          ],
        });
      } else {
        resolvedFindings.push({
          ...fA,
          agreement: 'disputed',
          disputeNotes: [
            {
              model: 'Reviewer B',
              stance: 'disagree',
              reason: evalFromB.reason || 'Deemed unwarranted or compliant',
            },
          ],
        });
      }
    } else if (matchingB) {
      // Independent consensus from both models
      resolvedFindings.push({
        ...fA,
        agreement: 'agreed',
        confidence: Math.max(fA.confidence, matchingB.confidence),
      });
    } else {
      resolvedFindings.push({
        ...fA,
        agreement: 'single_source',
      });
    }
  }

  // 2. Process Reviewer B findings not already matched
  for (const fB of reviewerBFindings) {
    const key = `${fB.clauseId}::${fB.postField}::${fB.postQuote.toLowerCase().trim()}`;
    if (processedKeys.has(key)) continue;

    const evalFromA = evalMapA.get(fB.id);

    if (evalFromA) {
      if (evalFromA.stance === 'agree') {
        resolvedFindings.push({
          ...fB,
          agreement: 'agreed',
          disputeNotes: [
            {
              model: 'Reviewer A',
              stance: 'agree',
              reason: evalFromA.reason || 'Verified policy alignment',
            },
          ],
        });
      } else {
        resolvedFindings.push({
          ...fB,
          agreement: 'disputed',
          disputeNotes: [
            {
              model: 'Reviewer A',
              stance: 'disagree',
              reason: evalFromA.reason || 'Deemed unwarranted or compliant',
            },
          ],
        });
      }
    } else {
      resolvedFindings.push({
        ...fB,
        agreement: 'single_source',
      });
    }
  }

  return resolvedFindings;
}
