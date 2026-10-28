import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, RequestSchemas } from '@/src/llm/http';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { callLLM } from '@/src/llm/callLLM';
import { buildGeneratorPrompt } from '@/src/llm/prompts/generator';
import { getPolicyPack, getRoutedClausesForCategories } from '@/src/kb';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await verifyLlmAccess(req);
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

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt in request' }, { status: 400 });
    }

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

    // Attempt Groq Slot 1 (Drafter) with a 15s fast-race; if slow, fallback to Groq Slot 2
    const drafterCall = callLLM<{
      caption: string;
      hashtags: string[];
      altText: string;
      imagePrompt: string;
      marketingScript: string;
      purpose: any;
    }>({
      provider: 'groq1',
      system,
      user,
      purpose: `Post drafting generation (Iteration ${iteration})`,
      clauseIdsSent: clauseIds,
    });

    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 15000));
    const raceResult = await Promise.race([drafterCall, timeoutPromise]);

    let finalResult = raceResult && raceResult.ok ? raceResult : null;

    if (!finalResult && (process.env.GROQ_API_KEY_2?.trim() || process.env.GROQ_API_KEY?.trim())) {
      finalResult = await callLLM<{
        caption: string;
        hashtags: string[];
        altText: string;
        imagePrompt: string;
        marketingScript: string;
        purpose: any;
      }>({
        provider: 'groq2',
        system,
        user,
        purpose: `Post drafting generation fast fallback (Iteration ${iteration})`,
        clauseIdsSent: clauseIds,
      });
    }

    if (!finalResult) {
      finalResult = await drafterCall;
    }

    if (!finalResult.ok) {
      return NextResponse.json(
        {
          error: finalResult.error,
          log: finalResult.log,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      draft: finalResult.data,
      log: finalResult.log,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
