import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { callLLM } from '@/src/llm/callLLM';
import { buildClarifyPrompt } from '@/src/llm/prompts/clarify';
import { getPolicyPack } from '@/src/kb';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({ clauseId: z.string().regex(/^[A-Z]{2}-\d{3}$/), evidence: z.array(z.string().max(300)).max(20) });
const OutSchema = z.object({ suggestion: z.string(), rationale: z.string().optional() });

export async function POST(req: NextRequest) {
  const auth = await verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });

  const clause = getPolicyPack().clauses.find((c) => c.id === parsed.data.clauseId);
  if (!clause) return NextResponse.json({ error: `Unknown clause ${parsed.data.clauseId}` }, { status: 404 });

  const { system, user } = buildClarifyPrompt(clause, parsed.data.evidence);
  const result = await callLLM({ provider: 'gemini', system, user, schema: OutSchema, purpose: 'clarification suggestion', clauseIdsSent: [clause.id] });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, modeSuggestion: result.modeSuggestion, log: result.log }, { status: 503 });
  }
  return NextResponse.json({ ...result.data, model: result.log.model, log: result.log });
}
