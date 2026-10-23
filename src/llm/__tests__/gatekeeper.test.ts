import { describe, it, expect } from 'vitest';
import { verifyLlmAccess } from '../gatekeeper';
import { NextRequest } from 'next/server';

describe('LLM Gatekeeper', () => {
  it('rejects unauthorized requests without cookie or header', () => {
    const req = new NextRequest('http://localhost:3000/api/llm/review', {
      method: 'POST',
    });
    const result = verifyLlmAccess(req);
    expect(result.authorized).toBe(false);
    expect(result.response?.status).toBe(401);
  });

  it('authorizes requests with correct header access code', () => {
    const req = new NextRequest('http://localhost:3000/api/llm/review', {
      method: 'POST',
      headers: {
        'x-demo-access-code': process.env.DEMO_ACCESS_CODE || 'brandgate2026',
      },
    });
    const result = verifyLlmAccess(req);
    expect(result.authorized).toBe(true);
  });
});
