import { NextRequest, NextResponse } from 'next/server';

let inMemoryDailyCounter = 0;
let lastResetDate = new Date().toISOString().slice(0, 10);

export function verifyLlmAccess(req: NextRequest): { authorized: boolean; response?: NextResponse } {
  const cookie = req.cookies.get('bg_access');
  const headerCode = req.headers.get('x-demo-access-code');
  const validCode = process.env.DEMO_ACCESS_CODE || 'brandgate2026';

  const isAuth = cookie?.value === validCode || headerCode === validCode;

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
