import { describe, it, expect } from 'vitest';
import { SAMPLE_POSTS } from '@/data/samples/samplePosts';
import { getPolicyPack } from '@/src/kb';
import { evaluatePost } from '@/src/rules/engine';
import { verifyCitations } from '../citationVerifier';
import { computeScoreAndVerdict } from '../scoring';

describe('Phase 5 End-to-End: 12 Reference Sample Posts (Fast Mode)', () => {
  const pack = getPolicyPack();
  const DEMO_DATE = '2026-10-24';

  it('runs all 12 sample posts through gates, citation verification, and scoring', () => {
    expect(SAMPLE_POSTS).toHaveLength(12);

    for (const sample of SAMPLE_POSTS) {
      // 1. Run deterministic gates
      const gateResult = evaluatePost(sample.post, pack, DEMO_DATE);

      // 2. Verify citations on gate findings
      const verification = verifyCitations(gateResult.findings, pack, sample.post);
      expect(verification.hallucinationsBlocked).toBe(0); // All gate findings must have genuine citations

      // 3. Compute score and verdict
      const scoreResult = computeScoreAndVerdict(
        verification.verifiedFindings,
        gateResult.gatesFailed,
        verification.hallucinationsBlocked
      );

      // 4. Assert against expected verdict
      if (sample.id === 1) {
        // Control post: clean, ready for human
        expect(scoreResult.score).toBeGreaterThanOrEqual(90);
        expect(scoreResult.verdict.status).toBe('READY_FOR_HUMAN');
        expect(scoreResult.verdict.gatesFailed).toHaveLength(0);
      } else if (sample.id === 10) {
        // Prompt injection: hard gate critical failure forces BLOCKED
        expect(scoreResult.verdict.status).toBe('BLOCKED');
        expect(scoreResult.verdict.gatesFailed.length).toBeGreaterThan(0);
      } else {
        // Planted violations produce verified findings
        expect(verification.verifiedFindings.length).toBeGreaterThan(0);
        for (const f of verification.verifiedFindings) {
          expect(f.verified).toBe(true);
          expect(f.clauseId).toBeTruthy();
          expect(f.clauseQuote).toBeTruthy();
        }
      }
    }
  });

  it('verifies planted issues appear for each specific sample post', () => {
    // Sample 2: Stale Monsoon offer
    const res2 = evaluatePost(SAMPLE_POSTS[1].post, pack, DEMO_DATE);
    expect(res2.findings.some((f) => f.clauseId === 'AF-003')).toBe(true);

    // Sample 3: Greenwashing claim
    const res3 = evaluatePost(SAMPLE_POSTS[2].post, pack, DEMO_DATE);
    expect(res3.findings.some((f) => f.clauseId === 'CL-002' || f.clauseId === 'CL-003')).toBe(true);

    // Sample 4: Banned term 'cheap'
    const res4 = evaluatePost(SAMPLE_POSTS[3].post, pack, DEMO_DATE);
    expect(res4.findings.some((f) => f.clauseId === 'TM-002')).toBe(true);

    // Sample 5: Free shipping contradiction
    const res5 = evaluatePost(SAMPLE_POSTS[4].post, pack, DEMO_DATE);
    expect(res5.findings.some((f) => f.clauseId === 'AF-001' || f.clauseId === 'AF-005')).toBe(true);

    // Sample 6: Collab without disclosure
    const res6 = evaluatePost(SAMPLE_POSTS[5].post, pack, DEMO_DATE);
    expect(res6.findings.some((f) => f.clauseId === 'SR-006')).toBe(true);

    // Sample 7: Preachy guilt-trip tone
    const res7 = evaluatePost(SAMPLE_POSTS[6].post, pack, DEMO_DATE);
    expect(res7.findings.some((f) => f.clauseId === 'BV-003')).toBe(true);

    // Sample 8: Accessibility failures
    const res8 = evaluatePost(SAMPLE_POSTS[7].post, pack, DEMO_DATE);
    expect(res8.findings.some((f) => f.clauseId === 'AR-001')).toBe(true);

    // Sample 9: Aspect ratio 16:9
    const res9 = evaluatePost(SAMPLE_POSTS[8].post, pack, DEMO_DATE);
    expect(res9.findings.some((f) => f.clauseId === 'VI-005')).toBe(true);

    // Sample 10: Security injection
    const res10 = evaluatePost(SAMPLE_POSTS[9].post, pack, DEMO_DATE);
    expect(res10.findings.some((f) => f.category === 'security')).toBe(true);

    // Sample 11: 3 emojis SR-005 limit
    const res11 = evaluatePost(SAMPLE_POSTS[10].post, pack, DEMO_DATE);
    expect(res11.findings.some((f) => f.clauseId === 'SR-005')).toBe(true);

    // Sample 12: Prohibited slang TM-007
    const res12 = evaluatePost(SAMPLE_POSTS[11].post, pack, DEMO_DATE);
    expect(res12.findings.some((f) => f.clauseId === 'TM-007')).toBe(true);
  });
});
