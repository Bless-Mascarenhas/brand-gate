import { describe, it, expect } from 'vitest';
import { getPolicyPack } from '@/src/kb';
import { CallLlmParams, CallLlmResult } from '@/src/llm/callLLM';
import { BARE_INSTRUCTION, buildBaselineGeneratorPrompt, buildSingleModelReviewerPrompt } from '@/src/llm/prompts/baseline';
import { LlmCaller, runGovernedGeneration, runGovernedReview } from '@/src/pipeline/governed';
import { COMPARE_SCENARIOS } from '@/src/compare/scenarios';
import { compareMetrics, runCost, ruleIdOf } from '@/src/compare/metrics';
import { evaluatePost } from '@/src/rules/engine';
import { PostContent } from '@/src/types';

const pack = getPolicyPack();

type Call = CallLlmParams<unknown>;
function mockLlm(reply: (p: Call) => unknown): { llm: LlmCaller; calls: Call[] } {
  const calls: Call[] = [];
  const llm = (async (p: Call) => {
    calls.push(p);
    const data = reply(p);
    return { ok: data !== null, data, error: data === null ? 'mock failure' : undefined, log: { provider: p.provider, model: 'mock', purpose: p.purpose, clauseIdsSent: p.clauseIdsSent, tokensIn: 100, tokensOut: 20, ms: 1, ok: data !== null } } as CallLlmResult<unknown>;
  }) as LlmCaller;
  return { llm, calls };
}

const clean: PostContent = {
  caption: 'Diwali Thrift Fest is on: up to 30% off curated pre-loved jackets. Tap the link in bio to shop. #ThriftIt',
  hashtags: ['#ThriftIt'],
  altText: 'Rack of pre-loved denim jackets on a wooden rail in daylight',
  format: 'feed_4_5',
  language: 'en',
};

describe('Compare scenarios', () => {
  it('has the six required scenarios', () => {
    expect(COMPARE_SCENARIOS.map((s) => s.id)).toEqual([
      'expired-offer', 'sustainability-claim', 'wrong-price', 'competitor-jab', 'undisclosed-collab', 'festival-greeting',
    ]);
    const ids = new Set(pack.clauses.map((c) => c.id));
    for (const s of COMPARE_SCENARIOS) for (const c of s.watchClauses) expect(ids.has(c)).toBe(true);
  });
});

describe('prompt routing per column', () => {
  it('Column A gets only the minimal instruction — no policy text', () => {
    const p = buildBaselineGeneratorPrompt('bare', 'brief', pack);
    expect(p.system.startsWith(BARE_INSTRUCTION)).toBe(true);
    expect(p.system).not.toMatch(/\[[A-Z]{2}-\d{3}\]/);
    expect(p.user).toBe('brief');
  });

  it('Column B gets the same instruction plus every policy document', () => {
    const p = buildBaselineGeneratorPrompt('policies', 'brief', pack);
    expect(p.system.startsWith(BARE_INSTRUCTION)).toBe(true);
    for (const c of pack.clauses) expect(p.system).toContain(`[${c.id}]`);
  });

  it('the single-model benchmark reviewer sees all policies and wraps the post as untrusted', () => {
    const p = buildSingleModelReviewerPrompt(pack, clean);
    expect(p.system).toContain('[EM-007]');
    expect(p.system).toMatch(/untrusted/);
    expect(p.user).toMatch(/^<post>[\s\S]*<\/post>$/);
  });
});

describe('governed column runs the real verification pipeline', () => {
  it('calls both reviewers with routed soft-category clauses only, verifies citations and counts hallucinations', async () => {
    const { llm, calls } = mockLlm((p) =>
      p.provider === 'groq'
        ? { findings: [
            { category: 'tone', severity: 'minor', clauseId: 'BV-007', clauseQuote: 'Keep the tone friendly but not too casual', postField: 'caption', postQuote: 'Tap the link in bio', explanation: 'x' },
            { category: 'tone', severity: 'major', clauseId: 'BV-999', clauseQuote: 'made up', postField: 'caption', postQuote: 'Tap', explanation: 'fabricated clause' },
          ] }
        : { findings: [] }
    );
    const res = await runGovernedReview(clean, pack, { llm });
    expect(calls.map((c) => c.provider).sort()).toEqual(['groq', 'nvidia']);
    for (const c of calls) {
      expect(c.user).toContain('<post>');
      expect(c.clauseIdsSent.some((id) => id.startsWith('VI-') || id.startsWith('AR-'))).toBe(false); // minimum disclosure
      expect(c.clauseIdsSent).toContain('BV-007');
    }
    expect(res.dropped.map((f) => f.clauseId)).toEqual(['BV-999']);
    expect(res.droppedReasons[res.dropped[0].id]).toMatch(/does not exist/);
    expect(res.findings.find((f) => f.clauseId === 'BV-007')).toMatchObject({ verified: true, agreement: 'single_source', source: 'groq' });
    expect(res.score.verdict.hallucinationsBlocked).toBe(1);
    expect(res.llmCalls).toHaveLength(2);
  });

  it('skips reviewers when a critical gate fails (same as the client pipeline)', async () => {
    const { llm, calls } = mockLlm(() => ({ findings: [] }));
    const res = await runGovernedReview({ ...clean, caption: 'Flat 40% off Monsoon Clearance, ends tonight! #ThriftIt' }, pack, { llm });
    expect(calls).toHaveLength(0);
    expect(res.score.verdict.status).toBe('BLOCKED');
    expect(res.steps.find((s) => s.step === 'Independent Review')?.status).toBe('skipped');
  });

  it('deterministic-only mode makes no model calls', async () => {
    const { llm, calls } = mockLlm(() => ({ findings: [] }));
    const res = await runGovernedReview(clean, pack, { llm, reviewers: false });
    expect(calls).toHaveLength(0);
    expect(res.score.verdict.status).toBe('READY_FOR_HUMAN');
  });

  it('thorough mode cross-examines and reports debate outcomes', async () => {
    const { llm, calls } = mockLlm((p) => {
      if (p.purpose.includes('crosscheck')) return { evaluations: [{ findingId: 'groq-0', stance: 'disagree', reason: 'fine' }] };
      if (p.provider === 'groq') return { findings: [{ category: 'tone', severity: 'major', clauseId: 'BV-007', clauseQuote: 'Keep the tone friendly but not too casual', postField: 'caption', postQuote: 'Tap the link', explanation: 'x' }] };
      return { findings: [] };
    });
    const res = await runGovernedReview(clean, pack, { llm, mode: 'thorough' });
    expect(calls.filter((c) => c.purpose.includes('crosscheck'))).toHaveLength(1);
    expect(res.debateDisputed).toBe(1);
    expect(res.findings.find((f) => f.clauseId === 'BV-007')?.agreement).toBe('disputed');
    expect(res.score.score).toBe(100); // disputed → zero penalty
  });

  it('provider failure is reported, not hidden', async () => {
    const { llm } = mockLlm(() => null);
    const res = await runGovernedReview(clean, pack, { llm });
    expect(res.errors).toHaveLength(2);
    expect(res.steps.find((s) => s.step === 'Independent Review')?.status).toBe('failed');
  });

  it('governed generation uses the grounded generator, regenerates with findings, keeps the better draft', async () => {
    let gen = 0;
    const { llm, calls } = mockLlm((p) => {
      if (p.provider === 'gemini') {
        gen++;
        return gen === 1
          ? { caption: 'Cheap jeans for you. Tap the link in bio. #ThriftIt', hashtags: ['#ThriftIt'], altText: 'Pre-loved jeans folded on a shelf in daylight' }
          : { caption: 'Pre-loved jeans for you. Tap the link in bio. #ThriftIt', hashtags: ['#ThriftIt'], altText: 'Pre-loved jeans folded on a shelf in daylight' };
      }
      return { findings: [] };
    });
    const out = await runGovernedGeneration('denim brief', pack, { llm, maxIterations: 3 });
    const genCalls = calls.filter((c) => c.provider === 'gemini');
    expect(genCalls).toHaveLength(2);
    expect(genCalls[0].system).toContain('ACTIVE GROUND TRUTH FACTS');
    expect(genCalls[1].user).toContain('GOVERNANCE FEEDBACK');
    expect(genCalls[1].user).toContain('TM-002');
    expect(out.iterations.map((i) => i.verdict)).toEqual(['BLOCKED', 'READY_FOR_HUMAN']);
    expect(out.post.caption).toMatch(/^Pre-loved/);
  });
});

describe('one independent scorer for all columns', () => {
  it('identical posts get identical metrics whatever produced them', () => {
    const post = { ...clean, caption: 'Cheap used jeans at ₹299, eco-friendly too! #ThriftIt' };
    const a = compareMetrics(evaluatePost(post, pack), pack.rules);
    const b = compareMetrics(evaluatePost(post, pack), pack.rules);
    expect(a).toEqual(b);
    expect(a.bannedTerms).toBeGreaterThanOrEqual(2);
    expect(a.unsupportedClaims).toBeGreaterThanOrEqual(1);
    expect(a.verdict).toBe('BLOCKED');
  });

  it('a compliant post scores 100 with zero counts', () => {
    const m = compareMetrics(evaluatePost(clean, pack), pack.rules);
    expect(m).toMatchObject({ gateFailures: 0, bannedTerms: 0, unsupportedClaims: 0, staleOrWrongFacts: 0, accessibilityGaps: 0, score: 100, verdict: 'READY_FOR_HUMAN' });
  });

  it('rule ids are recovered from gate finding ids', () => {
    const f = evaluatePost({ ...clean, caption: 'cheap tees #ThriftIt' }, pack).findings[0];
    expect(ruleIdOf(f)).toMatch(/^R-TERM-\d{3}$/);
  });

  it('cost reports real token sums and flags missing usage instead of inventing it', () => {
    const log = (t?: number) => ({ provider: 'gemini' as const, model: 'm', purpose: 'p', clauseIdsSent: [], tokensIn: t, tokensOut: t, ms: 1, ok: true });
    expect(runCost([log(10), log(5)], 1200)).toEqual({ wallMs: 1200, llmCallCount: 2, tokensIn: 15, tokensOut: 15, tokensIncomplete: false });
    expect(runCost([log(undefined)], 10)).toMatchObject({ tokensIn: null, tokensIncomplete: true });
    expect(runCost([], 5)).toMatchObject({ llmCallCount: 0, tokensIn: 0, tokensIncomplete: false });
  });
});
