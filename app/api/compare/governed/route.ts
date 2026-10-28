// Compare column C: grounded generation + the full governed review (gates, two reviewers, citation verifier, consensus, scoring).
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { getPolicyPack } from '@/src/kb';
import { scenarioById } from '@/src/compare/scenarios';
import { runGovernedGeneration } from '@/src/pipeline/governed';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({ scenarioId: z.string(), mode: z.enum(['fast', 'thorough']).default('fast') });

export async function POST(req: NextRequest) {
  const auth = await verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  const scenario = scenarioById(parsed.data.scenarioId);
  if (!scenario) return NextResponse.json({ error: `Unknown scenario ${parsed.data.scenarioId}` }, { status: 404 });

  const started = Date.now();
  try {
    const out = await runGovernedGeneration(scenario.brief, getPolicyPack(), {
      demoDate: process.env.DEMO_TODAY || new Date().toISOString().slice(0, 10),
      mode: parsed.data.mode,
      maxIterations: 2, // keeps the request well under the 60 s function limit
    });
    return NextResponse.json({
      post: out.post,
      iterations: out.iterations,
      verdict: out.review.score.verdict,
      findings: out.review.findings,
      hallucinationsBlocked: out.review.dropped.length,
      steps: out.review.steps,
      llmCalls: out.llmCalls,
      errors: out.errors,
      serverMs: Date.now() - started,
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
