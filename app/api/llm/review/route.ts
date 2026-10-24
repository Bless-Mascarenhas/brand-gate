import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, RequestSchemas } from '@/src/llm/http';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { callLLM } from '@/src/llm/callLLM';
import { buildReviewerPrompt } from '@/src/llm/prompts/reviewer';
import { getPolicyPack, getRoutedClausesForCategories } from '@/src/kb';
import { Category, PostContent } from '@/src/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  try {
    const read = await readJsonBody(req, RequestSchemas.review);
    if (!read.ok) return read.response;
    const body = read.data;
    const provider: 'gemini' | 'groq' | 'nvidia' = body.provider || 'gemini';
    const post: PostContent = body.post;
    const categories: Category[] = body.categories || [
      'tone',
      'terminology',
      'messaging',
      'claims',
      'regional',
    ];
    const perceptionText: string | undefined = body.perceptionText;

    if (!post) {
      return NextResponse.json({ error: 'Missing post data in request body' }, { status: 400 });
    }

    const pack = getPolicyPack();
    const routedClauses = getRoutedClausesForCategories(categories, pack);
    const clauseIds = routedClauses.map((c) => c.id);

    const { system, user } = buildReviewerPrompt({
      providerName: provider,
      routedClauses,
      post,
      perceptionText,
    });

    const result = await callLLM<{ findings: any[] }>({
      provider,
      system,
      user,
      purpose: `${provider} independent soft-review`,
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
      findings: result.data?.findings || [],
      log: result.log,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
