import { NextResponse } from 'next/server';
import { getPolicyPack } from '@/src/kb';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    const pack = getPolicyPack();
    return NextResponse.json(pack);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
