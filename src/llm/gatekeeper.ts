import { NextRequest, NextResponse } from 'next/server';

/**
 * Gate for every LLM endpoint (spec §18): access code, per-IP rate limit and
 * daily call budget. Counters live in Upstash Redis when UPSTASH_REDIS_REST_URL
 * and UPSTASH_REDIS_REST_TOKEN are set, otherwise in this server instance's
 * memory (best effort: serverless instances do not share memory).
 */

const memCounters = new Map<string, { count: number; expiresAt: number }>();

async function upstashIncr(key: string, ttlSeconds: number, incrementBy: number): Promise<number | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['INCRBY', key, String(incrementBy)], ['EXPIRE', key, String(ttlSeconds), 'NX']]),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const out = (await res.json()) as { result?: unknown }[];
    return typeof out[0]?.result === 'number' ? out[0].result : null;
  } catch {
    return null; // fall back to memory rather than failing open or closed on a Redis outage
  }
}

/** Increment a windowed counter and return the new count. */
export async function incrementCounter(key: string, ttlSeconds: number, now = Date.now(), incrementBy = 1): Promise<number> {
  if (!Number.isInteger(incrementBy) || incrementBy < 1) throw new RangeError('Counter increment must be a positive integer.');
  const remote = await upstashIncr(key, ttlSeconds, incrementBy);
  if (remote !== null) return remote;
  const entry = memCounters.get(key);
  if (!entry || entry.expiresAt <= now) {
    memCounters.set(key, { count: incrementBy, expiresAt: now + ttlSeconds * 1000 });
    return incrementBy;
  }
  entry.count += incrementBy;
  return entry.count;
}

/** Test hook: forget in-memory counters. */
export function resetCounters() {
  memCounters.clear();
}

/**
 * The configured access code. Outside production a documented local default is used so the app runs
 * out of the box; in production an unset DEMO_ACCESS_CODE disables live LLM access entirely.
 */
export function demoAccessCode(): string | null {
  const configured = process.env.DEMO_ACCESS_CODE?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === 'production' ? null : 'brandgate2026';
}

/** Access-code check without touching the LLM call budget (used by non-LLM routes such as /api/storage). */
export function hasDemoAccess(req: NextRequest): boolean {
  const validCode = demoAccessCode();
  if (!validCode) return false;
  return req.cookies.get('bg_access')?.value === validCode || req.headers.get('x-demo-access-code') === validCode;
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

export async function verifyLlmAccess(req: NextRequest, budgetCost = 1): Promise<{ authorized: boolean; response?: NextResponse }> {
  if (!hasDemoAccess(req)) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized. Please provide the DEMO_ACCESS_CODE to use live LLM endpoints.',
          requiresAccessCode: true,
        },
        { status: 401 }
      ),
    };
  }

  const perMinute = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);
  const minute = Math.floor(Date.now() / 60000);
  if ((await incrementCounter(`bg:rl:${clientIp(req)}:${minute}`, 60)) > perMinute) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: `Rate limit reached (${perMinute} LLM requests per minute). Please wait a minute before retrying.`, rateLimited: true },
        { status: 429, headers: { 'Retry-After': '60' } }
      ),
    };
  }

  const maxBudget = Number(process.env.DAILY_CALL_BUDGET || 400);
  const day = new Date().toISOString().slice(0, 10);
  if ((await incrementCounter(`bg:budget:${day}`, 86400, Date.now(), budgetCost)) > maxBudget) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: `Daily LLM call budget (${maxBudget}) exhausted for today.`,
          budgetExhausted: true,
        },
        { status: 429 }
      ),
    };
  }

  return { authorized: true };
}
