// Optional Supabase key-value store (Phase 8). Active only when SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set; the service-role key never leaves the server.
// Table: see docs/supabase/001_brand_gate_kv.sql.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hasDemoAccess } from '@/src/llm/gatekeeper';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TABLE = 'brand_gate_kv';
const KEY = z.string().min(1).max(200).regex(/^[\w:.\-]+$/);
const MAX_BYTES = 1_000_000;

function config() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

async function rest(path: string, init: RequestInit = {}) {
  const cfg = config()!;
  return fetch(`${cfg.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    cache: 'no-store',
  });
}

function guard(req: NextRequest): NextResponse | null {
  if (!config()) return NextResponse.json({ error: 'Supabase storage is not configured; the app uses browser storage.' }, { status: 501 });
  if (!hasDemoAccess(req)) return NextResponse.json({ error: 'Access code required' }, { status: 401 });
  return null;
}

const upstreamError = (status: number) =>
  NextResponse.json({ error: `Supabase request failed (HTTP ${status}); data was not changed.` }, { status: 502 });

export async function GET(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const key = req.nextUrl.searchParams.get('key');
  try {
    if (key !== null) {
      if (!KEY.safeParse(key).success) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
      const res = await rest(`${TABLE}?key=eq.${encodeURIComponent(key)}&select=value`);
      if (!res.ok) return upstreamError(res.status);
      const rows = (await res.json()) as { value: unknown }[];
      return NextResponse.json({ value: rows[0]?.value ?? null });
    }
    const prefix = req.nextUrl.searchParams.get('prefix') ?? '';
    if (prefix && !KEY.safeParse(prefix).success) return NextResponse.json({ error: 'Invalid prefix' }, { status: 400 });
    const res = await rest(`${TABLE}?select=key&key=like.${encodeURIComponent(prefix)}*`);
    if (!res.ok) return upstreamError(res.status);
    return NextResponse.json({ keys: ((await res.json()) as { key: string }[]).map((r) => r.key) });
  } catch {
    return NextResponse.json({ error: 'Supabase is unreachable.' }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ error: 'Value too large' }, { status: 413 });
  const parsed = z.object({ key: KEY, value: z.unknown() }).safeParse(JSON.parse(text || 'null'));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  try {
    const res = await rest(TABLE, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: parsed.data.key, value: parsed.data.value ?? null, updated_at: new Date().toISOString() }),
    });
    return res.ok ? NextResponse.json({ ok: true }) : upstreamError(res.status);
  } catch {
    return NextResponse.json({ error: 'Supabase is unreachable.' }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const key = req.nextUrl.searchParams.get('key');
  if (key === null || !KEY.safeParse(key).success) return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  try {
    const res = await rest(`${TABLE}?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE' });
    return res.ok ? NextResponse.json({ ok: true }) : upstreamError(res.status);
  } catch {
    return NextResponse.json({ error: 'Supabase is unreachable.' }, { status: 502 });
  }
}
