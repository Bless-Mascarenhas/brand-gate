// src/pipeline/governed.ts
/**
 * Server-side governed pipeline used by Compare (Column C), the benchmark and
 * the replay recorder. Same order and the same pure functions as the client
 * `usePipeline` hook: gates → independent reviewers → citation verifier →
 * (thorough: cross-check) → consensus → scoring. The LLM caller is injectable
 * so tests can prove which prompts went where without network calls.
 */
import { CallLlmParams, CallLlmResult, callLLM } from '@/src/llm/callLLM';
import { buildReviewerPrompt } from '@/src/llm/prompts/reviewer';
import { buildCrosscheckPrompt } from '@/src/llm/prompts/crosscheck';
import { buildGeneratorPrompt } from '@/src/llm/prompts/generator';
import { getRoutedClausesForCategories } from '@/src/kb/routing';
import { evaluatePost, GateEvaluationResult } from '@/src/rules/engine';
import { verifyCitations } from '@/src/verify/citationVerifier';
import { adjudicateConsensus, CrosscheckEvaluation } from '@/src/verify/consensus';
import { computeScoreAndVerdict, ScoreResult } from '@/src/verify/scoring';
import { Category, Finding, LlmCallLog, PolicyPack, PostContent, Purpose } from '@/src/types';

export type LlmCaller = <T>(params: CallLlmParams<T>) => Promise<CallLlmResult<T>>;

export const SOFT_CATEGORIES: Category[] = ['tone', 'terminology', 'messaging', 'claims', 'regional'];
const GENERATOR_CATEGORIES: Category[] = ['tone', 'terminology', 'messaging', 'claims', 'accessibility'];

export interface PipelineStep {
  step: string;
  status: 'completed' | 'skipped' | 'failed';
  message: string;
}

export interface GovernedReviewOptions {
  demoDate?: string;
  mode?: 'fast' | 'thorough';
  llm?: LlmCaller;
  /** false = deterministic stages only (no reviewer calls), e.g. when no keys are configured. */
  reviewers?: boolean;
}

export interface GovernedReviewResult {
  gate: GateEvaluationResult;
  rawLlmFindings: Finding[];
  dropped: Finding[];
  droppedReasons: Record<string, string>;
  findings: Finding[];
  score: ScoreResult;
  llmCalls: LlmCallLog[];
  /** Single-reviewer findings the cross-check settled by agreeing. */
  debateAgreed: number;
  /** Findings the cross-check left disputed (zero penalty, routed to a human). */
  debateDisputed: number;
  steps: PipelineStep[];
  errors: string[];
}

const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback);

/** Coerce a model's raw finding into the Finding shape; the verifier then decides if it is real. */
function toFinding(raw: Record<string, unknown>, source: 'grok' | 'nvidia', i: number): Finding {
  return {
    id: `${source}-${i}`,
    source,
    category: (str(raw.category, 'tone') as Category),
    severity: (['critical', 'major', 'minor', 'info'].includes(str(raw.severity)) ? raw.severity : 'minor') as Finding['severity'],
    clauseId: str(raw.clauseId),
    clauseQuote: str(raw.clauseQuote),
    postField: (['caption', 'hashtags', 'alt_text', 'image', 'meta'].includes(str(raw.postField)) ? raw.postField : 'caption') as Finding['postField'],
    postQuote: str(raw.postQuote),
    explanation: str(raw.explanation),
    suggestedFix: str(raw.suggestedFix) || undefined,
    autoFixable: false,
    confidence: 0.9,
    verified: false,
    agreement: 'single_source',
  };
}

export async function runGovernedReview(post: PostContent, pack: PolicyPack, opts: GovernedReviewOptions = {}): Promise<GovernedReviewResult> {
  const { demoDate = '2026-10-24', mode = 'fast', llm = callLLM, reviewers = true } = opts;
  const steps: PipelineStep[] = [];
  const llmCalls: LlmCallLog[] = [];
  const errors: string[] = [];

  const gate = evaluatePost(post, pack, demoDate);
  steps.push({ step: 'Gates', status: 'completed', message: `${gate.findings.length} deterministic findings (${gate.gatesFailed.length} failed gates)` });

  const hasCriticalGate = gate.findings.some((f) => f.severity === 'critical');
  let rawA: Finding[] = [];
  let rawB: Finding[] = [];

  if (!reviewers) {
    steps.push({ step: 'Independent Review', status: 'skipped', message: 'Reviewer calls disabled (deterministic-only run)' });
  } else if (hasCriticalGate) {
    steps.push({ step: 'Independent Review', status: 'skipped', message: 'Critical gate failed; post is blocked before LLM review' });
  } else {
    const routed = getRoutedClausesForCategories(SOFT_CATEGORIES, pack);
    const clauseIds = routed.map((c) => c.id);
    const call = (provider: 'xai' | 'nvidia') => {
      const { system, user } = buildReviewerPrompt({ providerName: provider, routedClauses: routed, post });
      return llm<{ findings: Record<string, unknown>[] }>({ provider, system, user, purpose: `${provider} independent soft-review`, clauseIdsSent: clauseIds });
    };
    const [a, b] = await Promise.all([call('xai'), call('nvidia')]);
    for (const [res, source, set] of [[a, 'grok', (x: Finding[]) => (rawA = x)], [b, 'nvidia', (x: Finding[]) => (rawB = x)]] as const) {
      llmCalls.push(res.log);
      if (res.ok) set((Array.isArray(res.data?.findings) ? res.data!.findings : []).map((f, i) => toFinding(f, source, i)));
      else errors.push(res.error ?? `${source} failed`);
    }
    steps.push({ step: 'Independent Review', status: errors.length === 2 ? 'failed' : 'completed', message: `Reviewer A (Grok): ${rawA.length}, Reviewer B (NVIDIA): ${rawB.length}` });
  }

  const raw = [...rawA, ...rawB];
  const verification = verifyCitations(raw, pack, post);
  steps.push({ step: 'Citation Verifier', status: 'completed', message: `${verification.verifiedFindings.length} verified, ${verification.hallucinationsBlocked} hallucinated citations blocked` });

  const verifiedA = verification.verifiedFindings.filter((f) => f.source === 'grok');
  const verifiedB = verification.verifiedFindings.filter((f) => f.source === 'nvidia');
  let evaluationsFromB: CrosscheckEvaluation[] = [];
  if (mode === 'thorough' && verifiedA.length > 0) {
    const categories = Array.from(new Set(verifiedA.map((f) => f.category)));
    const routed = getRoutedClausesForCategories(categories, pack);
    const { system, user } = buildCrosscheckPrompt({ otherReviewerName: 'Reviewer A (Grok)', findingsToReview: verifiedA, routedClauses: routed, post });
    const res = await llm<{ evaluations: CrosscheckEvaluation[] }>({ provider: 'nvidia', system, user, purpose: 'nvidia crosscheck on Grok findings', clauseIdsSent: routed.map((c) => c.id) });
    llmCalls.push(res.log);
    if (res.ok) evaluationsFromB = Array.isArray(res.data?.evaluations) ? res.data!.evaluations : [];
    else errors.push(res.error ?? 'crosscheck failed');
    steps.push({ step: 'Cross-Examination', status: res.ok ? 'completed' : 'failed', message: `${evaluationsFromB.length} evaluations from Reviewer B` });
  } else {
    steps.push({ step: 'Cross-Examination', status: 'skipped', message: mode === 'fast' ? 'Fast mode: rebuttal round skipped' : 'No verified Reviewer A findings to cross-examine' });
  }

  const adjudicated = adjudicateConsensus({ reviewerAFindings: verifiedA, reviewerBFindings: verifiedB, evaluationsFromB });
  const evaluated = new Set(evaluationsFromB.map((e) => e.findingId));
  const debateAgreed = adjudicated.filter((f) => evaluated.has(f.id) && f.agreement === 'agreed').length;
  const debateDisputed = adjudicated.filter((f) => evaluated.has(f.id) && f.agreement === 'disputed').length;
  steps.push({ step: 'Consensus', status: 'completed', message: `${adjudicated.length} LLM findings adjudicated` });

  const findings: Finding[] = [...gate.findings.map((f) => ({ ...f, verified: true, agreement: 'deterministic' as const })), ...adjudicated];
  const score = computeScoreAndVerdict(findings, gate.gatesFailed, verification.hallucinationsBlocked);
  steps.push({ step: 'Scoring & Verdict', status: 'completed', message: `${score.verdict.status} (score ${score.score})` });

  return {
    gate, rawLlmFindings: raw, dropped: verification.droppedFindings, droppedReasons: verification.droppedReasons,
    findings, score, llmCalls, debateAgreed, debateDisputed, steps, errors,
  };
}

export interface GovernedGenerationResult {
  post: PostContent;
  purpose?: Purpose;
  iterations: { iteration: number; post: PostContent; score: number; verdict: string; findings: number }[];
  review: GovernedReviewResult;
  llmCalls: LlmCallLog[];
  errors: string[];
}

/** Column C: grounded generation, then review; regenerate with the verified findings until READY or the cap. */
export async function runGovernedGeneration(brief: string, pack: PolicyPack, opts: GovernedReviewOptions & { maxIterations?: number } = {}): Promise<GovernedGenerationResult> {
  const { llm = callLLM, maxIterations = 2 } = opts;
  const routed = getRoutedClausesForCategories(GENERATOR_CATEGORIES, pack);
  const llmCalls: LlmCallLog[] = [];
  const iterations: GovernedGenerationResult['iterations'] = [];
  let purpose: Purpose | undefined;
  let feedback: string[] = [];
  let last: { post: PostContent; review: GovernedReviewResult } | null = null;

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const { system, user } = buildGeneratorPrompt({ userPrompt: brief, routedClauses: routed, activeFacts: pack.facts, iteration, previousFindings: feedback, originalPurpose: purpose });
    const gen = await llm<{ caption: string; hashtags: string[]; altText: string; purpose?: Purpose }>({ provider: 'gemini', system, user, purpose: `governed generation (iteration ${iteration})`, clauseIdsSent: routed.map((c) => c.id) });
    llmCalls.push(gen.log);
    if (!gen.ok || !gen.data) {
      if (last) break; // keep the previous iteration's result
      throw new Error(gen.error ?? 'Generation failed');
    }
    purpose = purpose ?? gen.data.purpose;
    const post: PostContent = { caption: str(gen.data.caption), hashtags: Array.isArray(gen.data.hashtags) ? gen.data.hashtags.map(String) : [], altText: str(gen.data.altText), format: 'feed_4_5', language: 'en' };
    const review = await runGovernedReview(post, pack, { ...opts, llm });
    llmCalls.push(...review.llmCalls);
    iterations.push({ iteration, post, score: review.score.score, verdict: review.score.verdict.status, findings: review.findings.length });
    const improved = !last || review.score.score > last.review.score.score;
    if (improved) last = { post, review }; // a worse regeneration never replaces a better draft
    if (review.score.verdict.status === 'READY_FOR_HUMAN' || !improved) break;
    feedback = review.findings.map((f) => `[${f.clauseId}] ${f.severity}: "${f.postQuote}" — ${f.explanation}`);
  }

  return { post: last!.post, purpose, iterations, review: last!.review, llmCalls, errors: last!.review.errors };
}
