// Shared request-body handling for API routes (spec §18): size cap, JSON parse, zod validation.
import { NextRequest, NextResponse } from 'next/server';
import { ZodTypeAny, z } from 'zod';
import { CategorySchema, FindingSchema, PostContentSchema, PurposeSchema } from '@/src/types';
import { MIN_GENERATION_BRIEF_LENGTH } from '@/src/llm/schemas';

/** Vercel's request limit is ~4.5 MB; posts may carry a client-compressed image. */
export const MAX_BODY_BYTES = 4_500_000;

export type BodyResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

export async function readJsonBody<S extends ZodTypeAny>(req: NextRequest, schema: S, maxBytes = MAX_BODY_BYTES): Promise<BodyResult<z.infer<S>>> {
  const fail = (status: number, error: string): BodyResult<z.infer<S>> => ({ ok: false, response: NextResponse.json({ error }, { status }) });
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > maxBytes) return fail(413, `Request body too large (max ${maxBytes} bytes).`);
  const text = await req.text();
  if (Buffer.byteLength(text) > maxBytes) return fail(413, `Request body too large (max ${maxBytes} bytes).`);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail(400, 'Request body is not valid JSON.');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`).join('; ');
    return fail(400, `Invalid request body — ${issues}`);
  }
  return { ok: true, data: parsed.data };
}

const Provider = z.enum(['gemini', 'groq', 'nvidia', 'groq1', 'groq2', 'groq3']);
const ShortText = (max: number) => z.string().max(max);
const Findings = z.array(FindingSchema).max(50);

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ImageDataUrl = z
  .string()
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'must be a base64 JPEG, PNG or WebP data URL');

export const RequestSchemas = {
  gates: z.object({ post: PostContentSchema, demoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional() }),
  review: z.object({ provider: Provider.optional(), post: PostContentSchema, categories: z.array(CategorySchema).max(10).nullable().optional(), perceptionText: ShortText(5000).nullable().optional() }),
  crosscheck: z.object({ provider: Provider.optional(), otherProvider: ShortText(100).nullable().optional(), findings: Findings.nullable().optional(), post: PostContentSchema }),
  fix: z.object({ post: PostContentSchema, findings: Findings.nullable().optional() }),
  intent: z.object({ originalPost: PostContentSchema.nullable().optional(), originalPurpose: PurposeSchema.partial().extend({ summary: z.string().default(''), requiredElements: z.array(z.string()).default([]) }).nullable().optional(), revisedCaption: ShortText(5000).nullable().optional() }),
  generate: z.object({
    prompt: z.string().trim().min(MIN_GENERATION_BRIEF_LENGTH, `Add at least ${MIN_GENERATION_BRIEF_LENGTH} characters of useful context.`).max(2000),
    language: z.enum(['en', 'hinglish']).nullable().optional(),
    format: z.enum(['feed_4_5', 'feed_1_1', 'story_9_16']).nullable().optional(),
    festival: ShortText(50).nullable().optional(),
    iteration: z.number().int().min(1).max(5).nullable().optional(),
    previousFindings: z.array(ShortText(1000)).max(50).nullable().optional(),
    originalPurpose: z.record(z.unknown()).nullable().optional(),
  }),
  image: z.object({
    prompt: z.string().trim().min(20).max(4000),
    negativePrompt: ShortText(800).nullable().optional(),
    format: z.enum(['feed_4_5', 'feed_1_1', 'story_9_16', 'reel_9_16']).optional(),
    festival: ShortText(50).nullable().optional(),
  }),
  perceive: z.object({
    imageDataUrl: ImageDataUrl,
  }),
};
