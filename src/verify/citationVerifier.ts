import { Finding, PolicyPack, PostContent } from '@/src/types';

/**
 * Normalizes text by lowercasing, collapsing whitespace, and stripping
 * punctuation/quotes for resilient citation matching.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D"']/g, '') // strip single/double curly and straight quotes
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ') // replace punctuation with spaces
    .replace(/\s+/g, ' ') // collapse multiple spaces
    .trim();
}

/**
 * Computes Token Jaccard similarity between two text snippets
 */
export function tokenJaccardSimilarity(textA: string, textB: string): number {
  const tokensA = new Set(normalizeText(textA).split(' ').filter(Boolean));
  const tokensB = new Set(normalizeText(textB).split(' ').filter(Boolean));

  if (tokensA.size === 0 && tokensB.size === 0) return 1.0;
  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersectionCount = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersectionCount++;
    }
  }

  const unionCount = tokensA.size + tokensB.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

export interface VerificationResult {
  verifiedFindings: Finding[];
  droppedFindings: Finding[];
  /** Why each dropped finding failed verification, keyed by finding id. */
  droppedReasons: Record<string, string>;
  hallucinationsBlocked: number;
}

/**
 * Validates candidate findings against the official policy pack and target post:
 * 1. Clause ID must exist in pack.clauses
 * 2. Clause quote must be a substring of the clause text (normalized or token-Jaccard >= 0.9)
 * 3. Post quote must exist in the target post field
 */
export function verifyCitations(
  candidateFindings: Finding[],
  pack: PolicyPack,
  post: PostContent,
  imageEvidence = ''
): VerificationResult {
  const verifiedFindings: Finding[] = [];
  const droppedFindings: Finding[] = [];
  const droppedReasons: Record<string, string> = {};

  const clauseMap = new Map(pack.clauses.map((c) => [c.id, c]));

  // Post fields lookup
  const postFields: Record<string, string> = {
    caption: post.caption || '',
    hashtags: (post.hashtags || []).join(' '),
    alt_text: post.altText || '',
    image: imageEvidence,
    meta: `${post.format || ''} ${post.imageMeta ? `${post.imageMeta.width}x${post.imageMeta.height} (${(post.imageMeta.width / post.imageMeta.height).toFixed(2)})` : ''}`,
  };

  for (const finding of candidateFindings) {
    // 1. Check Clause existence
    const clause = clauseMap.get(finding.clauseId);
    if (!clause) {
      droppedFindings.push(finding);
      droppedReasons[finding.id] = 'clauseId does not exist in the policy pack';
      continue;
    }

    // 2. Check Clause Quote in clause text
    const normClauseText = normalizeText(clause.text);
    const normClauseQuote = normalizeText(finding.clauseQuote);

    let clauseQuoteValid = false;
    if (normClauseQuote && normClauseText.includes(normClauseQuote)) {
      clauseQuoteValid = true;
    } else if (normClauseQuote.length > 5) {
      // Jaccard similarity fallback for partial quotes
      const similarity = tokenJaccardSimilarity(finding.clauseQuote, clause.text);
      if (similarity >= 0.9 || clause.text.toLowerCase().includes(finding.clauseQuote.toLowerCase().trim())) {
        clauseQuoteValid = true;
      }
    }

    if (!clauseQuoteValid) {
      droppedFindings.push(finding);
      droppedReasons[finding.id] = 'clauseQuote not found in the cited clause';
      continue;
    }

    // 3. Check Post Quote in specified post field
    const targetText = postFields[finding.postField] || '';
    const normTargetText = normalizeText(targetText);
    const normPostQuote = normalizeText(finding.postQuote);

    let postQuoteValid = false;
    if (normPostQuote && normTargetText.includes(normPostQuote)) {
      postQuoteValid = true;
    } else if (finding.postQuote.toLowerCase() === 'none' || finding.postQuote.toLowerCase() === 'missing') {
      // Allow placeholder quote for missing alt text or missing required element
      postQuoteValid = true;
    } else if (finding.postQuote && targetText.toLowerCase().includes(finding.postQuote.toLowerCase().trim())) {
      postQuoteValid = true;
    }

    if (!postQuoteValid) {
      droppedFindings.push(finding);
      droppedReasons[finding.id] = `postQuote not found in the ${finding.postField} field`;
      continue;
    }

    // All 3 checks passed: Mark finding as verified
    verifiedFindings.push({
      ...finding,
      verified: true,
    });
  }

  return {
    verifiedFindings,
    droppedFindings,
    droppedReasons,
    hallucinationsBlocked: droppedFindings.length,
  };
}
