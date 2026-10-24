import { Purpose, PostContent } from '@/src/types';

export interface IntentEvaluationResult {
  preservationScore: number; // 1 to 5
  requiredElementsPreserved: boolean;
  missingElements: string[];
  summary: string;
}

/**
 * Deterministically extracts purpose elements from an original post
 */
export function extractPurposeFromPost(post: PostContent): Purpose {
  const caption = post.caption || '';
  const requiredElements: string[] = [];

  // Check for discount/offer keywords
  let offer: string | undefined;
  const offerMatch = caption.match(/(?:flat\s*\d+%|up\s*to\s*\d+%|\d+%\s*off|free\s*shipping)/i);
  if (offerMatch) {
    offer = offerMatch[0];
    requiredElements.push(offer);
  }

  // Check for product keywords
  let product: string | undefined;
  const productMatch = caption.match(/(?:vintage|denim|jackets|tees|shirts|dresses|pre-loved|collection)/i);
  if (productMatch) {
    product = productMatch[0];
    requiredElements.push(product);
  }

  // Check for CTA keywords
  let cta: string | undefined;
  const ctaMatch = caption.match(/(?:visit|shop|link in bio|dm to order|grab|drop|check out)/i);
  if (ctaMatch) {
    cta = ctaMatch[0];
    requiredElements.push(cta);
  }

  return {
    summary: `Marketing post promoting ${product || 'curated pre-loved clothing'}${offer ? ` with offer (${offer})` : ''}.`,
    product,
    offer,
    cta,
    audience: 'Gen-Z & young millennials in India',
    requiredElements,
  };
}

/**
 * Checks if all required purpose elements survived a revision
 */
export function verifyIntentPreservation(
  originalPurpose: Purpose,
  revisedCaption: string
): IntentEvaluationResult {
  const missingElements: string[] = [];
  const textLower = revisedCaption.toLowerCase();

  for (const elem of originalPurpose.requiredElements) {
    if (!textLower.includes(elem.toLowerCase())) {
      missingElements.push(elem);
    }
  }

  const requiredElementsPreserved = missingElements.length === 0;

  // Compute 1-5 preservation score
  let preservationScore = 5;
  if (!requiredElementsPreserved) {
    const fractionLost = missingElements.length / Math.max(1, originalPurpose.requiredElements.length);
    preservationScore = Math.max(1, Math.round(5 - fractionLost * 3));
  }

  return {
    preservationScore,
    requiredElementsPreserved,
    missingElements,
    summary: requiredElementsPreserved
      ? `All core purpose elements preserved (${originalPurpose.requiredElements.join(', ') || 'voice intact'}).`
      : `Missing required purpose elements: ${missingElements.join(', ')}.`,
  };
}
