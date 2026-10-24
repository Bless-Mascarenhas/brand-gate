import { describe, it, expect } from 'vitest';
import { getPolicyPack } from '@/src/kb';
import { evaluatePost } from '@/src/rules/engine';
import { verifyCitations } from '@/src/verify/citationVerifier';
import { computeScoreAndVerdict } from '@/src/verify/scoring';
import { verifyIntentPreservation, extractPurposeFromPost } from '@/src/verify/intent';
import { PostContent, Purpose } from '@/src/types';

describe('Phase 6: Governance Loop & Intent Preservation', () => {
  const pack = getPolicyPack();
  const DEMO_DATE = '2026-10-24';

  it('stops immediately at Iteration 1 when the initial draft is fully compliant', () => {
    const cleanPost: PostContent = {
      caption:
        'Bright festive styles this Diwali at Thrift-It! Up to 30% off on curated vintage pieces at our Bandra pop-up. Tap the link in bio to explore.',
      hashtags: ['#ThriftIt', '#DiwaliThriftFest', '#PreLovedFashion'],
      altText: 'Curated vintage festive jacket displayed in warm natural studio lighting.',
      format: 'feed_4_5',
      language: 'en',
    };

    const gateResult = evaluatePost(cleanPost, pack, DEMO_DATE);
    const verification = verifyCitations(gateResult.findings, pack, cleanPost);
    const scoreResult = computeScoreAndVerdict(
      verification.verifiedFindings,
      gateResult.gatesFailed,
      verification.hallucinationsBlocked
    );

    expect(scoreResult.score).toBeGreaterThanOrEqual(90);
    expect(scoreResult.verdict.status).toBe('READY_FOR_HUMAN');
    expect(scoreResult.verdict.gatesFailed).toHaveLength(0);
  });

  it('improves score from Iteration 1 to Iteration 2 when feedback is resolved', () => {
    // Draft 1 has a banned term 'cheap' (TM-002) and missing hyphen 'ThriftIt' (TM-004)
    const draft1: PostContent = {
      caption: 'Get cheap vintage jackets at ThriftIt Bandra today! Flat 20% off. Tap link in bio.',
      hashtags: ['#ThriftIt', '#Vintage'],
      altText: 'Vintage jackets on rack.',
      format: 'feed_4_5',
      language: 'en',
    };

    const gate1 = evaluatePost(draft1, pack, DEMO_DATE);
    const ver1 = verifyCitations(gate1.findings, pack, draft1);
    const score1 = computeScoreAndVerdict(ver1.verifiedFindings, gate1.gatesFailed, ver1.hallucinationsBlocked);

    expect(score1.verdict.status).not.toBe('READY_FOR_HUMAN');
    expect(score1.score).toBeLessThan(90);

    // Draft 2 resolves 'cheap' -> 'pre-loved' and 'ThriftIt' -> 'Thrift-It'
    const draft2: PostContent = {
      caption: 'Get curated pre-loved vintage jackets at Thrift-It Bandra today! Flat 20% off. Tap link in bio.',
      hashtags: ['#ThriftIt', '#VintageJackets'],
      altText: 'Curated pre-loved vintage denim jacket on a hanger in a Bandra studio.',
      format: 'feed_4_5',
      language: 'en',
    };

    const gate2 = evaluatePost(draft2, pack, DEMO_DATE);
    const ver2 = verifyCitations(gate2.findings, pack, draft2);
    const score2 = computeScoreAndVerdict(ver2.verifiedFindings, gate2.gatesFailed, ver2.hallucinationsBlocked);

    expect(score2.score).toBeGreaterThan(score1.score);
    expect(score2.verdict.status).toBe('READY_FOR_HUMAN');
  });

  it('preserves creator purpose across self-correction iterations', () => {
    const originalPost: PostContent = {
      caption:
        'Celebrate Diwali with up to 30% off on vintage denim jackets at Thrift-It Bandra pop-up! Shop the drop at the link in bio.',
      hashtags: ['#ThriftIt', '#DiwaliThriftFest'],
      format: 'feed_4_5',
      language: 'en',
    };

    const purpose: Purpose = extractPurposeFromPost(originalPost);
    expect(purpose.offer).toBeTruthy(); // 'up to 30%'
    expect(purpose.product).toBeTruthy(); // 'denim' or 'jackets'

    // Revised caption keeping offer and product
    const revisedCaption =
      'Shubh Diwali! Up to 30% off on curated vintage denim jackets at the Thrift-It weekend pop-up in Bandra. Tap link in bio to shop.';
    const intentRes = verifyIntentPreservation(purpose, revisedCaption);

    expect(intentRes.preservationScore).toBeGreaterThanOrEqual(4);
    expect(intentRes.requiredElementsPreserved).toBe(true);
    expect(intentRes.missingElements).toHaveLength(0);
  });
});
