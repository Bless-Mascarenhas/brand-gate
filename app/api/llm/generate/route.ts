import { NextRequest, NextResponse } from 'next/server';
import { RunnableParallel } from '@langchain/core/runnables';
import { readJsonBody, RequestSchemas } from '@/src/llm/http';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { callLLM } from '@/src/llm/callLLM';
import { buildGeneratorPrompt } from '@/src/llm/prompts/generator';
import { getPolicyPack, getRoutedClausesForCategories } from '@/src/kb';
import { evaluatePost } from '@/src/rules/engine';
import { computeScoreAndVerdict } from '@/src/verify/scoring';
import { GeneratedDraft, GeneratedDraftSchema } from '@/src/llm/schemas';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await verifyLlmAccess(req, 2);
  if (!auth.authorized) return auth.response!;

  try {
    const read = await readJsonBody(req, RequestSchemas.generate);
    if (!read.ok) return read.response;
    const body = read.data;
    const prompt: string = body.prompt;
    const language = body.language || 'en';
    const format = body.format || 'feed_4_5';
    const festival = body.festival || undefined;
    const iteration = body.iteration || 1;
    const previousFindings = body.previousFindings || [];
    const originalPurpose = body.originalPurpose || undefined;

    const pack = getPolicyPack();
    const routedClauses = getRoutedClausesForCategories(
      ['tone', 'terminology', 'messaging', 'claims', 'accessibility'],
      pack
    );
    const clauseIds = routedClauses.map((c) => c.id);

    const { system, user } = buildGeneratorPrompt({
      userPrompt: prompt,
      routedClauses,
      activeFacts: pack.facts,
      language,
      format,
      festival,
      iteration,
      previousFindings,
      originalPurpose,
    });

    const candidates = await RunnableParallel.from({
      groq1: () => callLLM<GeneratedDraft>({
        provider: 'groq1', system, user, schema: GeneratedDraftSchema,
        purpose: `Independent post draft A (iteration ${iteration})`, clauseIdsSent: clauseIds,
      }),
      groq2: () => callLLM<GeneratedDraft>({
        provider: 'groq2', system, user, schema: GeneratedDraftSchema,
        purpose: `Independent post draft B (iteration ${iteration})`, clauseIdsSent: clauseIds,
      }),
    }).invoke({});

    const providerLabels = { groq1: 'Groq 1', groq2: 'Groq 2' } as const;
    const demoDate = process.env.DEMO_TODAY || '2026-10-24';
    const scored = (['groq1', 'groq2'] as const).flatMap((provider) => {
      const result = candidates[provider];
      if (!result.ok || !result.data) return [];
      const draft = result.data;
      const post = { caption: draft.caption, hashtags: draft.hashtags, altText: draft.altText, format, language };
      const gates = evaluatePost(post, pack, demoDate);
      const findings = gates.findings.map((finding) => ({ ...finding, verified: true, agreement: 'deterministic' as const }));
      const scoredDraft = computeScoreAndVerdict(findings, gates.gatesFailed);
      return [{ provider, result, draft, score: scoredDraft.score, verdict: scoredDraft.verdict.status }];
    });

    const summaries = (['groq1', 'groq2'] as const).map((provider) => {
      const candidate = scored.find((item) => item.provider === provider);
      return candidate
        ? { provider: providerLabels[provider], status: 'available' as const, score: candidate.score, verdict: candidate.verdict }
        : {
          provider: providerLabels[provider],
          status: 'unavailable' as const,
          reason: candidates[provider].error || 'The provider returned no valid draft.',
        };
    });

    if (scored.length === 0) {
      return NextResponse.json({
        error: `Draft generation failed. ${summaries.map(({ provider, reason }) => `${provider}: ${reason}`).join(' ')}`,
        candidates: summaries,
      }, { status: 503 });
    }

    const selected = scored.reduce((best, candidate) => candidate.score > best.score ? candidate : best);

    return NextResponse.json({
      draft: selected.draft,
      log: selected.result.log,
      selection: {
        strategy: 'deterministic-policy-score',
        selectedProvider: providerLabels[selected.provider],
        candidates: summaries,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
