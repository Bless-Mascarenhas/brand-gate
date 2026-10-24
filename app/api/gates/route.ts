import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, RequestSchemas } from '@/src/llm/http';
import { getPolicyPack } from '@/src/kb';
import { evaluatePost } from '@/src/rules/engine';
import { PostContent } from '@/src/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const read = await readJsonBody(req, RequestSchemas.gates);
    if (!read.ok) return read.response;
    const body = read.data;
    const post: PostContent = body.post;
    const demoDate = body.demoDate || process.env.DEMO_TODAY || '2026-10-24';

    if (!post) {
      return NextResponse.json({ error: 'Missing post data in request body' }, { status: 400 });
    }

    const pack = getPolicyPack();
    const evaluation = evaluatePost(post, pack, demoDate);

    return NextResponse.json(evaluation);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
