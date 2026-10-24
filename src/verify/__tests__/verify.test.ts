import { describe, it, expect } from 'vitest';
import { verifyCitations } from '../citationVerifier';
import { computeScoreAndVerdict } from '../scoring';
import { adjudicateConsensus } from '../consensus';
import { extractPurposeFromPost, verifyIntentPreservation } from '../intent';
import { getPolicyPack } from '@/src/kb';
import { Finding, PostContent } from '@/src/types';

describe('Verify Pipeline Core Engines (Phase 5)', () => {
  const pack = getPolicyPack();

  describe('Citation Verifier & Hallucination Dropper', () => {
    const post: PostContent = {
      caption: 'Grab these cheap vintage jackets! Visit our Bandra store today.',
      hashtags: ['#ThriftIt'],
      format: 'feed_4_5',
      language: 'en',
    };

    it('approves findings with valid clause and verbatim quotes', () => {
      const candidates: Finding[] = [
        {
          id: 'cand-1',
          source: 'groq',
          category: 'terminology',
          severity: 'major',
          clauseId: 'TM-002',
          clauseQuote: 'The following terms are strictly banned in all customer-facing text: "cheap"',
          postField: 'caption',
          postQuote: 'cheap',
          explanation: 'Banned term detected',
          autoFixable: true,
          confidence: 0.95,
          verified: false,
          agreement: 'single_source',
        },
      ];

      const res = verifyCitations(candidates, pack, post);
      expect(res.verifiedFindings).toHaveLength(1);
      expect(res.hallucinationsBlocked).toBe(0);
      expect(res.verifiedFindings[0].verified).toBe(true);
    });

    it('drops and counts findings with non-existent clause IDs', () => {
      const candidates: Finding[] = [
        {
          id: 'fake-clause',
          source: 'groq',
          category: 'tone',
          severity: 'major',
          clauseId: 'FAKE-999',
          clauseQuote: 'Fabricated policy clause',
          postField: 'caption',
          postQuote: 'vintage',
          explanation: 'Fake issue',
          autoFixable: false,
          confidence: 0.9,
          verified: false,
          agreement: 'single_source',
        },
      ];

      const res = verifyCitations(candidates, pack, post);
      expect(res.verifiedFindings).toHaveLength(0);
      expect(res.hallucinationsBlocked).toBe(1);
    });

    it('drops and counts findings where clause quote does not exist in the clause', () => {
      const candidates: Finding[] = [
        {
          id: 'fake-quote',
          source: 'nvidia',
          category: 'terminology',
          severity: 'major',
          clauseId: 'TM-002',
          clauseQuote: 'Completely made up text that does not appear in clause TM-002',
          postField: 'caption',
          postQuote: 'cheap',
          explanation: 'Hallucinated quotation',
          autoFixable: false,
          confidence: 0.9,
          verified: false,
          agreement: 'single_source',
        },
      ];

      const res = verifyCitations(candidates, pack, post);
      expect(res.verifiedFindings).toHaveLength(0);
      expect(res.hallucinationsBlocked).toBe(1);
    });

    it('drops and counts findings where post quote is not in the stated post field', () => {
      const candidates: Finding[] = [
        {
          id: 'fake-post-quote',
          source: 'groq',
          category: 'terminology',
          severity: 'major',
          clauseId: 'TM-002',
          clauseQuote: 'Banned terms: "cheap", "junk", "old clothes"',
          postField: 'caption',
          postQuote: 'second-hand', // Not in this post's caption!
          explanation: 'Phantom post quote',
          autoFixable: false,
          confidence: 0.9,
          verified: false,
          agreement: 'single_source',
        },
      ];

      const res = verifyCitations(candidates, pack, post);
      expect(res.verifiedFindings).toHaveLength(0);
      expect(res.hallucinationsBlocked).toBe(1);
    });
  });

  describe('Scoring & Verdict Engine', () => {
    it('returns score 100 and READY_FOR_HUMAN when no findings exist', () => {
      const res = computeScoreAndVerdict([]);
      expect(res.score).toBe(100);
      expect(res.verdict.status).toBe('READY_FOR_HUMAN');
      expect(res.verdict.gatesFailed).toHaveLength(0);
    });

    it('forces BLOCKED on any critical finding regardless of score', () => {
      const findings: Finding[] = [
        {
          id: 'crit-1',
          source: 'gate',
          category: 'security',
          severity: 'critical',
          clauseId: 'EM-000',
          clauseQuote: 'Prompt injection',
          postField: 'caption',
          postQuote: 'ignore previous instructions',
          explanation: 'Jailbreak attempt',
          autoFixable: false,
          confidence: 1.0,
          verified: true,
          agreement: 'deterministic',
        },
      ];
      const res = computeScoreAndVerdict(findings);
      expect(res.verdict.status).toBe('BLOCKED');
      expect(res.score).toBe(60); // 100 - 40
    });

    it('deducts 15 points per major finding and sets status to REVISE', () => {
      const findings: Finding[] = [
        {
          id: 'maj-1',
          source: 'groq',
          category: 'terminology',
          severity: 'major',
          clauseId: 'TM-002',
          clauseQuote: 'cheap',
          postField: 'caption',
          postQuote: 'cheap',
          explanation: 'Banned term',
          autoFixable: true,
          confidence: 1.0,
          verified: true,
          agreement: 'agreed',
        },
      ];
      const res = computeScoreAndVerdict(findings);
      expect(res.score).toBe(85); // 100 - 15
      expect(res.verdict.status).toBe('REVISE');
    });

    it('waives penalty on disputed findings and flags them for human review', () => {
      const findings: Finding[] = [
        {
          id: 'disp-1',
          source: 'groq',
          category: 'tone',
          severity: 'major',
          clauseId: 'BV-007',
          clauseQuote: 'Keep tone friendly but not too casual',
          postField: 'caption',
          postQuote: 'hey guys',
          explanation: 'Too casual',
          autoFixable: false,
          confidence: 0.8,
          verified: true,
          agreement: 'disputed',
        },
      ];
      const res = computeScoreAndVerdict(findings);
      expect(res.score).toBe(100); // 0 penalty
      expect(res.verdict.status).toBe('REVISE'); // major dispute requires human resolution
      expect(res.verdict.needsHuman.length).toBeGreaterThan(0);
    });
  });

  describe('Consensus Adjudication', () => {
    it('marks findings as agreed when Reviewer B agrees with Reviewer A', () => {
      const findingA: Finding = {
        id: 'f-1',
        source: 'groq',
        category: 'tone',
        severity: 'major',
        clauseId: 'BV-003',
        clauseQuote: 'Never guilt-trip',
        postField: 'caption',
        postQuote: 'Shame on everyone',
        explanation: 'Guilt-tripping',
        autoFixable: false,
        confidence: 0.9,
        verified: true,
        agreement: 'single_source',
      };

      const resolved = adjudicateConsensus({
        reviewerAFindings: [findingA],
        reviewerBFindings: [],
        evaluationsFromB: [
          {
            findingId: 'f-1',
            stance: 'agree',
            reason: 'Violates BV-003 prohibition against shaming',
          },
        ],
      });

      expect(resolved).toHaveLength(1);
      expect(resolved[0].agreement).toBe('agreed');
      expect(resolved[0].disputeNotes?.[0]?.stance).toBe('agree');
    });

    it('marks findings as disputed when Reviewer B disagrees', () => {
      const findingA: Finding = {
        id: 'f-2',
        source: 'groq',
        category: 'tone',
        severity: 'major',
        clauseId: 'BV-007',
        clauseQuote: 'friendly but not too casual',
        postField: 'caption',
        postQuote: 'chilled out vibe',
        explanation: 'Too casual',
        autoFixable: false,
        confidence: 0.7,
        verified: true,
        agreement: 'single_source',
      };

      const resolved = adjudicateConsensus({
        reviewerAFindings: [findingA],
        reviewerBFindings: [],
        evaluationsFromB: [
          {
            findingId: 'f-2',
            stance: 'disagree',
            reason: 'Fits stylish older cousin warmth in Indian context',
          },
        ],
      });

      expect(resolved).toHaveLength(1);
      expect(resolved[0].agreement).toBe('disputed');
      expect(resolved[0].disputeNotes?.[0]?.stance).toBe('disagree');
    });
  });

  describe('Intent Preservation', () => {
    it('extracts product, offer, and CTA from post', () => {
      const post: PostContent = {
        caption: 'Diwali drop! Flat 30% off vintage jackets. Shop now at Bandra store! #ThriftIt',
        hashtags: ['#ThriftIt'],
        format: 'feed_4_5',
        language: 'en',
      };
      const purpose = extractPurposeFromPost(post);
      expect(purpose.offer).toBeDefined();
      expect(purpose.product).toBeDefined();
      expect(purpose.cta).toBeDefined();
    });

    it('scores 5/5 when required elements survive surgical fixes', () => {
      const originalPurpose = {
        summary: 'Promote vintage jackets sale',
        requiredElements: ['vintage jackets', 'flat 30% off', 'shop now'],
      };
      const revisedCaption = 'Grab our curated vintage jackets with flat 30% off! Shop now! #ThriftIt';
      const evalRes = verifyIntentPreservation(originalPurpose, revisedCaption);
      expect(evalRes.preservationScore).toBe(5);
      expect(evalRes.requiredElementsPreserved).toBe(true);
    });

    it('penalizes score when critical offer is dropped during edits', () => {
      const originalPurpose = {
        summary: 'Promote vintage jackets sale',
        requiredElements: ['vintage jackets', 'flat 30% off'],
      };
      const revisedCaption = 'Grab our curated vintage jackets! #ThriftIt'; // offer dropped!
      const evalRes = verifyIntentPreservation(originalPurpose, revisedCaption);
      expect(evalRes.preservationScore).toBeLessThan(5);
      expect(evalRes.requiredElementsPreserved).toBe(false);
      expect(evalRes.missingElements).toContain('flat 30% off');
    });
  });
});
