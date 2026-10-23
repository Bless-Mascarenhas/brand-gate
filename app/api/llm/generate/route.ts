import { NextRequest, NextResponse } from 'next/server';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { callLLM } from '@/src/llm/callLLM';
import { buildGeneratorPrompt } from '@/src/llm/prompts/generator';
import { getPolicyPack, getRoutedClausesForCategories } from '@/src/kb';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const prompt: string = body.prompt;
    const language = body.language || 'en';
    const format = body.format || 'feed_4_5';
    const iteration = body.iteration || 1;
    const previousFindings = body.previousFindings || [];
    const originalPurpose = body.originalPurpose;

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt in request' }, { status: 400 });
    }

    const pack = getPolicyPack();
    const routedClauses = getRoutedClausesForCategories(
      ['tone', 'terminology', 'messaging', 'factual_accuracy', 'claims', 'visual', 'accessibility'],
      pack
    );
    const clauseIds = routedClauses.map((c) => c.id);

    const { system, user } = buildGeneratorPrompt({
      userPrompt: prompt,
      routedClauses,
      activeFacts: pack.facts,
      language,
      format,
      iteration,
      previousFindings,
      originalPurpose,
    });

    const result = await callLLM<{
      caption: string;
      hashtags: string[];
      altText: string;
      imagePrompt: string;
      marketingScript: string;
      purpose: any;
    }>({
      provider: 'gemini',
      system,
      user,
      purpose: `Post drafting generation (Iteration ${iteration})`,
      clauseIdsSent: clauseIds,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          modeSuggestion: result.modeSuggestion,
          log: result.log,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      draft: result.data,
      log: result.log,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
