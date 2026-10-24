import { NextRequest, NextResponse } from 'next/server';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { verifyIntentPreservation, extractPurposeFromPost } from '@/src/verify/intent';
import { PostContent, Purpose } from '@/src/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  try {
    const body = await req.json();
    const originalPost: PostContent | undefined = body.originalPost;
    let originalPurpose: Purpose | undefined = body.originalPurpose;
    const revisedCaption: string = body.revisedCaption || '';

    if (!originalPurpose && originalPost) {
      originalPurpose = extractPurposeFromPost(originalPost);
    }

    if (!originalPurpose) {
      return NextResponse.json({ error: 'Missing originalPurpose or originalPost' }, { status: 400 });
    }

    const evaluation = verifyIntentPreservation(originalPurpose, revisedCaption);

    return NextResponse.json({
      success: true,
      originalPurpose,
      evaluation,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
