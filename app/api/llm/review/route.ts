import { NextRequest, NextResponse } from 'next/server';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    return NextResponse.json({
      message: 'LLM Review Endpoint Ready',
      provider: body.provider || 'gemini',
      findings: [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
