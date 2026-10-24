import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { verifyLlmAccess, resetCounters, incrementCounter, clientIp, demoAccessCode } from '../gatekeeper';
import { NextRequest } from 'next/server';

const code = () => process.env.DEMO_ACCESS_CODE || 'brandgate2026';
const req = (headers: Record<string, string> = {}) => new NextRequest('http://localhost:3000/api/llm/review', { method: 'POST', headers });

describe('LLM Gatekeeper', () => {
  beforeEach(() => resetCounters());
  afterEach(() => {
    delete process.env.RATE_LIMIT_PER_MINUTE;
    delete process.env.DAILY_CALL_BUDGET;
  });

  it('rejects unauthorized requests without cookie or header', async () => {
    const result = await verifyLlmAccess(req());
    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it('rejects a wrong access code', async () => {
    expect((await verifyLlmAccess(req({ 'x-demo-access-code': 'wrong' }))).authorized).toBe(false);
  });

  it('authorizes requests with correct header access code', async () => {
    expect((await verifyLlmAccess(req({ 'x-demo-access-code': code() }))).authorized).toBe(true);
  });

  it('authorizes requests with the httpOnly access cookie', async () => {
    expect((await verifyLlmAccess(req({ cookie: `bg_access=${code()}` }))).authorized).toBe(true);
  });

  it('rate-limits per IP and suggests Replay', async () => {
    process.env.RATE_LIMIT_PER_MINUTE = '2';
    const a = { 'x-demo-access-code': code(), 'x-forwarded-for': '10.0.0.1' };
    expect((await verifyLlmAccess(req(a))).authorized).toBe(true);
    expect((await verifyLlmAccess(req(a))).authorized).toBe(true);
    const third = await verifyLlmAccess(req(a));
    expect(third.response?.status).toBe(429);
    expect(await third.response?.json()).toMatchObject({ rateLimited: true, modeSuggestion: 'replay' });
    // a different client is unaffected
    expect((await verifyLlmAccess(req({ ...a, 'x-forwarded-for': '10.0.0.2' }))).authorized).toBe(true);
  });

  it('enforces the daily call budget and suggests Replay', async () => {
    process.env.DAILY_CALL_BUDGET = '1';
    const h = { 'x-demo-access-code': code(), 'x-forwarded-for': '10.0.0.3' };
    expect((await verifyLlmAccess(req(h))).authorized).toBe(true);
    const res = await verifyLlmAccess(req(h));
    expect(res.response?.status).toBe(429);
    expect(await res.response?.json()).toMatchObject({ budgetExhausted: true, modeSuggestion: 'replay' });
  });

  it('in-memory counters expire after their window', async () => {
    expect(await incrementCounter('k', 60, 0)).toBe(1);
    expect(await incrementCounter('k', 60, 1000)).toBe(2);
    expect(await incrementCounter('k', 60, 61_000)).toBe(1);
  });

  it('production without DEMO_ACCESS_CODE denies everyone, including the dev default', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_ACCESS_CODE', '');
    try {
      expect(demoAccessCode()).toBeNull();
      expect((await verifyLlmAccess(req({ 'x-demo-access-code': 'brandgate2026' }))).authorized).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('client IP comes from the first x-forwarded-for hop', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
    expect(clientIp(req())).toBe('unknown');
  });
});
