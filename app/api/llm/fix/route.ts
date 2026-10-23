import { NextRequest, NextResponse } from 'next/server';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  try {
    return NextResponse.json({
      message: 'LLM Fix Endpoint Ready',
      fixes: [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
