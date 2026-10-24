import { NextRequest, NextResponse } from 'next/server';

let inMemoryDailyCounter = 0;
let lastResetDate = new Date().toISOString().slice(0, 10);

/** Access-code check without touching the LLM call budget (used by non-LLM routes such as /api/storage). */
export function hasDemoAccess(req: NextRequest): boolean {
  const validCode = process.env.DEMO_ACCESS_CODE || 'brandgate2026';
  return req.cookies.get('bg_access')?.value === validCode || req.headers.get('x-demo-access-code') === validCode;
}

export function verifyLlmAccess(req: NextRequest): { authorized: boolean; response?: NextResponse } {
  const isAuth = hasDemoAccess(req);

  if (!isAuth) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: 'Unauthorized. Please provide the DEMO_ACCESS_CODE to use live LLM endpoints or switch to Replay Mode.',
          requiresAccessCode: true,
        },
        { status: 401 }
      ),
    };
  }

  // Check Daily Budget
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDate) {
    inMemoryDailyCounter = 0;
    lastResetDate = today;
  }

  const maxBudget = Number(process.env.DAILY_CALL_BUDGET || 400);
  if (inMemoryDailyCounter >= maxBudget) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: `Daily LLM call budget (${maxBudget}) exhausted for today. Please switch to Replay Mode to run demonstrations offline.`,
          budgetExhausted: true,
          modeSuggestion: 'replay',
        },
        { status: 429 }
      ),
    };
  }

  inMemoryDailyCounter++;
  return { authorized: true };
}
