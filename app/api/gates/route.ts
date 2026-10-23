import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return NextResponse.json({
      message: 'Deterministic Gates Endpoint Ready',
      findings: [],
      gatesPassed: true,
      post: body.post || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
