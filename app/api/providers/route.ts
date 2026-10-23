import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  const xaiConfigured = Boolean(process.env.XAI_API_KEY && process.env.XAI_API_KEY.trim().length > 0);
  const nvidiaConfigured = Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim().length > 0);

  const providers = {
    gemini: geminiConfigured ? ('configured' as const) : ('missing' as const),
    xai: xaiConfigured ? ('configured' as const) : ('missing' as const),
    nvidia: nvidiaConfigured ? ('configured' as const) : ('missing' as const),
  };

  const allMissing = !geminiConfigured && !xaiConfigured && !nvidiaConfigured;

  return NextResponse.json({
    providers,
    modeSuggestion: allMissing ? 'replay' : 'live',
    demoToday: process.env.DEMO_TODAY || '2026-10-24',
    dailyCallBudget: Number(process.env.DAILY_CALL_BUDGET || 400),
  });
}
