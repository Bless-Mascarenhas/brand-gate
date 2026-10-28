import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const set = (name?: string) => Boolean(name && process.env[name]?.trim());

/** A provider is "configured" only when both its key and its model ID env var are set. Never returns key values. */
export async function GET() {
  const isSlotConfigured = (keyVar: string, modelVar: string, fallbackKey?: string, fallbackModel?: string) => {
    const hasKey = set(keyVar) || (fallbackKey ? set(fallbackKey) : false);
    const hasModel = set(modelVar) || (fallbackModel ? set(fallbackModel) : false);
    return hasKey && hasModel ? ('configured' as const) : ('missing' as const);
  };

  const groq1Status = isSlotConfigured('GROQ_API_KEY_1', 'GROQ_MODEL_1', 'GROQ_API_KEY', 'GROQ_MODEL');
  const groq2Status = isSlotConfigured('GROQ_API_KEY_2', 'GROQ_MODEL_2', 'GROQ_API_KEY', 'GROQ_MODEL');
  const groq3Status = isSlotConfigured('GROQ_API_KEY_3', 'GROQ_MODEL_3', 'GROQ_API_KEY', 'GROQ_MODEL');

  // Support both groq1/2/3 and legacy alias keys for UI and test compatibility
  const providers = {
    groq1: groq1Status,
    groq2: groq2Status,
    groq3: groq3Status,
    gemini: set('GEMINI_API_KEY') && set('GEMINI_TEXT_MODEL') ? ('configured' as const) : groq1Status,
    groq: set('GROQ_API_KEY') && !set('GROQ_MODEL') && !set('GROQ_MODEL_2') ? ('missing' as const) : groq2Status,
    nvidia: set('NVIDIA_API_KEY') && set('NVIDIA_MODEL') ? ('configured' as const) : groq3Status,
  };

  return NextResponse.json({
    providers,
    models: {
      groq1: process.env.GROQ_MODEL_1?.trim() || 'openai/gpt-oss-120b',
      groq2: process.env.GROQ_MODEL_2?.trim() || 'openai/gpt-oss-20b',
      groq3: process.env.GROQ_MODEL_3?.trim() || 'qwen/qwen3.8-27b',
    },
    demoToday: process.env.DEMO_TODAY || new Date().toISOString().slice(0, 10),
    dailyCallBudget: Number(process.env.DAILY_CALL_BUDGET || 400),
  });
}
