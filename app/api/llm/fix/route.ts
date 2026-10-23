import { NextRequest, NextResponse } from 'next/server';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { callLLM } from '@/src/llm/callLLM';
import { buildFixPrompt } from '@/src/llm/prompts/fix';
import { Finding, PostContent } from '@/src/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const post: PostContent = body.post;
    const findings: Finding[] = body.findings || [];

    if (!post || findings.length === 0) {
      return NextResponse.json({ error: 'Missing post or findings to fix' }, { status: 400 });
    }

    const { system, user } = buildFixPrompt(post, findings);

    const result = await callLLM<{
      correctedCaption: string;
      correctedHashtags: string[];
      diffSummary: string;
    }>({
      provider: 'gemini',
      system,
      user,
      purpose: 'Generate minimal surgical fixes for findings',
      clauseIdsSent: findings.map((f) => f.clauseId),
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
      fixes: result.data,
      log: result.log,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
