import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, RequestSchemas } from '@/src/llm/http';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { callLLM, LlmProvider } from '@/src/llm/callLLM';
import { buildCrosscheckPrompt } from '@/src/llm/prompts/crosscheck';
import { getPolicyPack, getRoutedClausesForCategories } from '@/src/kb';
import { Finding, PostContent, Category } from '@/src/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  try {
    const read = await readJsonBody(req, RequestSchemas.crosscheck);
    if (!read.ok) return read.response;
    const body = read.data;
    const provider: LlmProvider = (body.provider as LlmProvider) || 'groq3';
    const otherProvider: string = body.otherProvider || 'Other Reviewer';
    const findings: Finding[] = body.findings || [];
    const post: PostContent = body.post;

    if (!post) {
      return NextResponse.json({ error: 'Missing post data' }, { status: 400 });
    }

    const pack = getPolicyPack();
    const categories: Category[] = Array.from(new Set(findings.map((f) => f.category)));
    const routedClauses = getRoutedClausesForCategories(
      categories.length > 0 ? categories : ['tone', 'messaging', 'claims'],
      pack
    );
    const clauseIds = routedClauses.map((c) => c.id);

    const { system, user } = buildCrosscheckPrompt({
      otherReviewerName: otherProvider,
      findingsToReview: findings,
      routedClauses,
      post,
    });

    const result = await callLLM<{ evaluations: any[]; additionalFindings?: any[] }>({
      provider,
      system,
      user,
      purpose: `${provider} crosscheck on ${otherProvider} findings`,
      clauseIdsSent: clauseIds,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          log: result.log,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      evaluations: result.data?.evaluations || [],
      additionalFindings: result.data?.additionalFindings || [],
      log: result.log,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
