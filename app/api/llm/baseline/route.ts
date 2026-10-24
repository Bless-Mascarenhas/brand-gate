// Compare columns A (bare AI) and B (AI + all policies pasted in): one Gemini call, no verification.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { callLLM } from '@/src/llm/callLLM';
import { buildBaselineGeneratorPrompt } from '@/src/llm/prompts/baseline';
import { getPolicyPack } from '@/src/kb';
import { scenarioById } from '@/src/compare/scenarios';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({ variant: z.enum(['bare', 'policies']), scenarioId: z.string() });
const OutSchema = z.object({ caption: z.string(), hashtags: z.array(z.string()).default([]), altText: z.string().default('') });

export async function POST(req: NextRequest) {
  const auth = verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const scenario = scenarioById(parsed.data.scenarioId);
  if (!scenario) return NextResponse.json({ error: `Unknown scenario ${parsed.data.scenarioId}` }, { status: 404 });

  const pack = getPolicyPack();
  const { system, user } = buildBaselineGeneratorPrompt(parsed.data.variant, scenario.brief, pack);
  const started = Date.now();
  const result = await callLLM({
    provider: 'gemini',
    system,
    user,
    schema: OutSchema,
    purpose: `compare baseline (${parsed.data.variant})`,
    clauseIdsSent: parsed.data.variant === 'policies' ? pack.clauses.map((c) => c.id) : [],
  });
  if (!result.ok || !result.data) {
    return NextResponse.json({ error: result.error, modeSuggestion: result.modeSuggestion ?? 'replay', log: result.log }, { status: 503 });
  }
  return NextResponse.json({
    variant: parsed.data.variant,
    post: { ...result.data, format: 'feed_4_5', language: 'en' },
    llmCalls: [result.log],
    serverMs: Date.now() - started,
  });
}
