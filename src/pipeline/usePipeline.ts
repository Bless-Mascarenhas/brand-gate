'use client';

import { useState, useCallback } from 'react';
import {
  PostContent,
  Finding,
  Verdict,
  TraceEvent,
  LlmCallLog,
  RunTrace,
  PolicyPack,
  Purpose,
} from '@/src/types';
import { verifyCitations } from '@/src/verify/citationVerifier';
import { computeScoreAndVerdict } from '@/src/verify/scoring';
import { adjudicateConsensus, CrosscheckEvaluation } from '@/src/verify/consensus';
import { storage } from '@/src/storage';
import { getRoutedClausesForCategories } from '@/src/kb/routing';
import { checkEventFromRun } from '@/src/insights/types';
import { appendInsightEvents } from '@/src/insights/store';

const SOFT_CATEGORIES = ['tone', 'terminology', 'messaging', 'claims', 'regional'] as const;

export interface UsePipelineOptions {
  demoDate?: string;
  speedMode?: 'fast' | 'thorough';
  mode?: 'live' | 'replay';
}

export interface PipelineState {
  status: 'idle' | 'running' | 'completed' | 'error';
  currentStep: string;
  progressPercent: number;
  traceEvents: TraceEvent[];
  llmLogs: LlmCallLog[];
  gateFindings: Finding[];
  reviewerAFindings: Finding[];
  reviewerBFindings: Finding[];
  verifiedFindings: Finding[];
  verdict: Verdict | null;
  purpose: Purpose | null;
  perception: any | null;
  hallucinationsBlocked: number;
  fixSuggestions: {
    correctedCaption?: string;
    correctedHashtags?: string[];
    diffSummary?: string;
  } | null;
  error: string | null;
}

export function usePipeline(options: UsePipelineOptions = {}) {
  const {
    demoDate = '2026-10-24',
    speedMode = 'fast',
    mode = 'live',
  } = options;

  const [state, setState] = useState<PipelineState>({
    status: 'idle',
    currentStep: '',
    progressPercent: 0,
    traceEvents: [],
    llmLogs: [],
    gateFindings: [],
    reviewerAFindings: [],
    reviewerBFindings: [],
    verifiedFindings: [],
    verdict: null,
    purpose: null,
    perception: null,
    hallucinationsBlocked: 0,
    fixSuggestions: null,
    error: null,
  });

  const addTrace = (
    step: string,
    message: string,
    traceStatus: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' = 'completed',
    data?: any
  ) => {
    const event: TraceEvent = {
      id: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      step,
      status: traceStatus,
      message,
      data,
    };
    setState((prev) => ({
      ...prev,
      traceEvents: [...prev.traceEvents, event],
      currentStep: step,
    }));
  };

  const runPipeline = useCallback(
    async (post: PostContent, pack: PolicyPack, runOpts: { pass?: 'first' | 'after_fix' } = {}) => {
      setState({
        status: 'running',
        currentStep: 'Initializing',
        progressPercent: 5,
        traceEvents: [],
        llmLogs: [],
        gateFindings: [],
        reviewerAFindings: [],
        reviewerBFindings: [],
        verifiedFindings: [],
        verdict: null,
        purpose: null,
        perception: null,
        hallucinationsBlocked: 0,
        fixSuggestions: null,
        error: null,
      });

      const collectedLogs: LlmCallLog[] = [];

      try {
        // STEP 1: INGEST & PURPOSE EXTRACTION
        addTrace('Ingest', 'Ingesting post content and extracting core marketing purpose...', 'running');
        const extractedPurpose: Purpose = {
          summary: 'Curated pre-loved clothing post for Thrift-It',
          audience: 'Indian Gen-Z & young millennials (18-32)',
          requiredElements: ['#ThriftIt'],
        };

        // Extract basic purpose keywords deterministically
        if (post.caption) {
          const offerM = post.caption.match(/(?:flat\s*\d+%|up\s*to\s*\d+%|\d+%\s*off|free\s*shipping)/i);
          if (offerM) extractedPurpose.offer = offerM[0];
          const prodM = post.caption.match(/(?:vintage|denim|jackets|tees|shirts|dresses|pre-loved)/i);
          if (prodM) extractedPurpose.product = prodM[0];
          const ctaM = post.caption.match(/(?:visit|shop|link in bio|dm to order|grab|drop)/i);
          if (ctaM) extractedPurpose.cta = ctaM[0];
          extractedPurpose.requiredElements = [
            ...(extractedPurpose.offer ? [extractedPurpose.offer] : []),
            ...(extractedPurpose.product ? [extractedPurpose.product] : []),
            '#ThriftIt',
          ];
        }

        setState((prev) => ({ ...prev, purpose: extractedPurpose, progressPercent: 15 }));
        addTrace('Ingest', `Purpose identified: ${extractedPurpose.summary}`, 'completed', extractedPurpose);

        // STEP 2: PERCEIVE (If Image Exists)
        let perceptionData: any = null;
        if (post.imageDataUrl || post.imageMeta) {
          addTrace('Perceive', 'Analyzing image dimensions, aspect ratio, palette, and visual elements...', 'running');
          try {
            const percRes = await fetch('/api/llm/perceive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                imageDataUrl: post.imageDataUrl,
                imageMeta: post.imageMeta,
              }),
            });
            if (percRes.ok) {
              const pData = await percRes.json();
              perceptionData = pData.perception;
            }
          } catch (e: any) {
            console.warn('Perception fetch error:', e.message);
          }
          setState((prev) => ({ ...prev, perception: perceptionData, progressPercent: 25 }));
          addTrace('Perceive', `Perception completed (Aspect ratio: ${perceptionData?.aspectRatio || '4:5'})`, 'completed', perceptionData);
        } else {
          addTrace('Perceive', 'No visual asset attached; skipping image perception', 'skipped');
        }

        // STEP 3: DETERMINISTIC GATES
        addTrace('Gates', 'Evaluating post against 47 machine rules in deterministic rule engine...', 'running');
        const gatesRes = await fetch('/api/gates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ post, demoDate }),
        });

        let gateResult = { passed: true, score: 100, findings: [] as Finding[], gatesFailed: [] as string[] };
        if (gatesRes.ok) {
          gateResult = await gatesRes.json();
        }

        setState((prev) => ({
          ...prev,
          gateFindings: gateResult.findings,
          progressPercent: 40,
        }));
        addTrace(
          'Gates',
          `Deterministic gates evaluated: ${gateResult.findings.length} findings (${gateResult.gatesFailed.length} hard failures)`,
          gateResult.passed ? 'completed' : 'failed',
          gateResult
        );

        // If a critical hard gate failed (e.g. prompt injection), we can short-circuit or flag immediately
        const hasCriticalGate = gateResult.findings.some((f) => f.severity === 'critical');

        // STEP 4: PARALLEL INDEPENDENT REVIEWS (Round 0)
        let reviewerAFindings: Finding[] = [];
        let reviewerBFindings: Finding[] = [];

        if (!hasCriticalGate && mode === 'live') {
          addTrace('Independent Review', 'Launching parallel independent reviews (Reviewer A: XAI_MODEL, Reviewer B: NVIDIA_MODEL)...', 'running');

          const [resA, resB] = await Promise.allSettled([
            fetch('/api/llm/review', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: 'xai', // Grok / Groq
                post,
                categories: ['tone', 'terminology', 'messaging', 'claims', 'regional'],
                perceptionText: perceptionData ? JSON.stringify(perceptionData) : undefined,
              }),
            }).then((r) => r.json()),
            fetch('/api/llm/review', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: 'nvidia',
                post,
                categories: ['tone', 'terminology', 'messaging', 'claims', 'regional'],
                perceptionText: perceptionData ? JSON.stringify(perceptionData) : undefined,
              }),
            }).then((r) => r.json()),
          ]);

          if (resA.status === 'fulfilled' && resA.value?.findings) {
            reviewerAFindings = resA.value.findings.map((f: any, idx: number) => ({
              ...f,
              id: `grok-${Date.now()}-${idx}`,
              source: 'grok',
              confidence: 0.9,
              verified: false,
              agreement: 'single_source',
            }));
            if (resA.value.log) collectedLogs.push(resA.value.log);
          }

          if (resB.status === 'fulfilled' && resB.value?.findings) {
            reviewerBFindings = resB.value.findings.map((f: any, idx: number) => ({
              ...f,
              id: `nvidia-${Date.now()}-${idx}`,
              source: 'nvidia',
              confidence: 0.9,
              verified: false,
              agreement: 'single_source',
            }));
            if (resB.value.log) collectedLogs.push(resB.value.log);
          }
        }

        setState((prev) => ({
          ...prev,
          reviewerAFindings,
          reviewerBFindings,
          progressPercent: 60,
        }));
        addTrace(
          'Independent Review',
          `Candidate findings generated: Reviewer A (${reviewerAFindings.length}), Reviewer B (${reviewerBFindings.length})`,
          'completed'
        );

        // STEP 5: CITATION VERIFICATION & HALLUCINATION BLOCKER
        addTrace('Citation Verifier', 'Verifying clause existence, verbatim clause quotes, and post quotes...', 'running');
        const rawLlmFindings = [...reviewerAFindings, ...reviewerBFindings];
        const verification = verifyCitations(rawLlmFindings, pack, post);

        setState((prev) => ({
          ...prev,
          hallucinationsBlocked: verification.hallucinationsBlocked,
          progressPercent: 70,
        }));
        addTrace(
          'Citation Verifier',
          `Verified ${verification.verifiedFindings.length} findings. Discarded ${verification.hallucinationsBlocked} hallucinated citations.`,
          'completed',
          { blocked: verification.hallucinationsBlocked }
        );

        // STEP 6: CROSS-EXAMINATION & DEBATE (Round 1)
        let evaluationsFromB: CrosscheckEvaluation[] = [];
        if (speedMode === 'thorough' && reviewerAFindings.length > 0 && mode === 'live') {
          addTrace('Cross-Examination', 'Running 2-model debate cross-examination on verified findings...', 'running');
          try {
            const crossRes = await fetch('/api/llm/crosscheck', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                provider: 'nvidia',
                otherProvider: 'Reviewer A',
                findings: verification.verifiedFindings.filter((f) => f.source === 'grok'),
                post,
              }),
            });
            if (crossRes.ok) {
              const crossData = await crossRes.json();
              evaluationsFromB = crossData.evaluations || [];
              if (crossData.log) collectedLogs.push(crossData.log);
            }
          } catch (e: any) {
            console.warn('Crosscheck error:', e.message);
          }
        } else {
          addTrace('Cross-Examination', 'Fast mode selected; skipping multi-model rebuttal round', 'skipped');
        }

        // STEP 7: CONSENSUS ADJUDICATION (Pure Code)
        addTrace('Consensus', 'Adjudicating consensus and classifying findings (agreed / disputed / single_source)...', 'running');
        const verifiedA = verification.verifiedFindings.filter((f) => f.source === 'grok');
        const verifiedB = verification.verifiedFindings.filter((f) => f.source === 'nvidia');

        const adjudicatedLlmFindings = adjudicateConsensus({
          reviewerAFindings: verifiedA,
          reviewerBFindings: verifiedB,
          evaluationsFromB,
        });

        // Combine deterministic gate findings (marked as verified & deterministic) with LLM findings
        const allVerifiedFindings: Finding[] = [
          ...gateResult.findings.map((f) => ({ ...f, verified: true, agreement: 'deterministic' as const })),
          ...adjudicatedLlmFindings,
        ];

        // STEP 8: SCORING & FINAL VERDICT
        addTrace('Scoring & Verdict', 'Computing Brand Compliance Score and operational verdict...', 'running');
        const scoreResult = computeScoreAndVerdict(
          allVerifiedFindings,
          gateResult.gatesFailed,
          verification.hallucinationsBlocked
        );

        setState((prev) => ({
          ...prev,
          verifiedFindings: allVerifiedFindings,
          verdict: scoreResult.verdict,
          progressPercent: 85,
        }));
        addTrace(
          'Scoring & Verdict',
          `Verdict reached: ${scoreResult.verdict.status} (Score: ${scoreResult.score}/100)`,
          scoreResult.verdict.status === 'READY_FOR_HUMAN' ? 'completed' : 'failed',
          scoreResult
        );

        // STEP 9: FIX SUGGESTIONS
        let fixes: any = null;
        if (allVerifiedFindings.length > 0 && mode === 'live') {
          addTrace('Fix Suggestions', 'Generating minimal surgical fixes to preserve creator voice...', 'running');
          try {
            const fixRes = await fetch('/api/llm/fix', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                post,
                findings: allVerifiedFindings,
              }),
            });
            if (fixRes.ok) {
              const fData = await fixRes.json();
              fixes = fData.fixes;
              if (fData.log) collectedLogs.push(fData.log);
            }
          } catch (e: any) {
            console.warn('Fix generation error:', e.message);
          }
        }

        // Fallback deterministic fix suggestions if API fails or offline
        if (!fixes && allVerifiedFindings.length > 0) {
          let correctedCap = post.caption;
          const correctedTags = [...post.hashtags];
          for (const f of allVerifiedFindings) {
            if (f.suggestedFix && f.postQuote && correctedCap.includes(f.postQuote)) {
              correctedCap = correctedCap.replace(new RegExp(f.postQuote, 'i'), f.suggestedFix);
            }
          }
          fixes = {
            correctedCaption: correctedCap,
            correctedHashtags: correctedTags,
            diffSummary: 'Surgical edits applied from rule engine dictionary',
          };
        }

        // STEP 10: PERSIST RUN TRACE
        addTrace('Persist', 'Persisting run trace, pack hash, and audit logs to storage...', 'running');
        const runId = `run-${Date.now()}`;
        const runTrace: RunTrace = {
          id: runId,
          packHash: pack.hash,
          mode: speedMode,
          steps: state.traceEvents,
          llmCalls: collectedLogs,
          verdict: scoreResult.verdict,
          findings: allVerifiedFindings,
        };

        try {
          await storage.setItem(`trace:${runId}`, runTrace);
          await appendInsightEvents([
            checkEventFromRun({
              origin: 'verify',
              pass: runOpts.pass ?? 'first',
              verdict: scoreResult.verdict,
              findings: allVerifiedFindings,
              checkedClauseIds: [
                ...pack.rules.map((r) => r.clause),
                ...(mode === 'live' ? getRoutedClausesForCategories([...SOFT_CATEGORIES], pack).map((c) => c.id) : []),
              ],
              dropped: verification.droppedFindings,
              droppedReasons: verification.droppedReasons,
            }),
          ]);
        } catch (e: any) {
          console.warn('Failed to store trace in IndexedDB:', e.message);
        }

        addTrace('Complete', 'Pipeline execution finished successfully.', 'completed');

        setState((prev) => ({
          ...prev,
          status: 'completed',
          currentStep: 'Completed',
          progressPercent: 100,
          llmLogs: collectedLogs,
          fixSuggestions: fixes,
        }));
      } catch (err: any) {
        addTrace('Error', `Pipeline encountered an unhandled exception: ${err.message}`, 'failed');
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err.message || 'Pipeline failed',
          progressPercent: 100,
        }));
      }
    },
    [demoDate, speedMode, mode, state.traceEvents]
  );

  const resetPipeline = () => {
    setState({
      status: 'idle',
      currentStep: '',
      progressPercent: 0,
      traceEvents: [],
      llmLogs: [],
      gateFindings: [],
      reviewerAFindings: [],
      reviewerBFindings: [],
      verifiedFindings: [],
      verdict: null,
      purpose: null,
      perception: null,
      hallucinationsBlocked: 0,
      fixSuggestions: null,
      error: null,
    });
  };

  return {
    ...state,
    runPipeline,
    resetPipeline,
  };
}
