import { NextResponse } from 'next/server';
import { MODEL_ENV } from '@/src/llm/callLLM';

export const runtime = 'nodejs';
export const maxDuration = 60;

const set = (name: string) => Boolean(process.env[name]?.trim());

/** A provider is "configured" only when both its key and its model ID env var are set. Never returns values. */
export async function GET() {
  const status = (keyVar: string, modelVar: string) => (set(keyVar) && set(modelVar) ? ('configured' as const) : ('missing' as const));
  const providers = {
    gemini: status('GEMINI_API_KEY', MODEL_ENV.gemini),
    groq: status('GROQ_API_KEY', MODEL_ENV.groq),
    nvidia: status('NVIDIA_API_KEY', MODEL_ENV.nvidia),
  };
  const allMissing = Object.values(providers).every((p) => p === 'missing');

  return NextResponse.json({
    providers,
    modeSuggestion: allMissing ? 'replay' : 'live',
    demoToday: process.env.DEMO_TODAY || '2026-10-24',
    dailyCallBudget: Number(process.env.DAILY_CALL_BUDGET || 400),
  });
}
