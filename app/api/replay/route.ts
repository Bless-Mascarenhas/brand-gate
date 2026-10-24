// Recorded runs for Replay mode. Read-only, no LLM calls, no access code needed.
import { NextRequest, NextResponse } from 'next/server';
import { loadReplay, replayInventory } from '@/src/replay/load';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ replays: replayInventory() });
  const res = loadReplay(id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ replay: res.replay, recorded: true });
}
