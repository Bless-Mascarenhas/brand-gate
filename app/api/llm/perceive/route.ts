import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, RequestSchemas } from '@/src/llm/http';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { analyzeImageBuffer } from '@/src/verify/perception';
import { InvalidImageError, sanitizeImage } from '@/src/verify/sanitizeImage';
import OpenAI from 'openai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VisionResultSchema = z.object({
  visibleText: z.array(z.string().max(500)).max(30),
  garmentDescription: z.string().max(1000),
  setting: z.string().max(1000),
  peoplePresent: z.boolean(),
  logoVisible: z.boolean(),
  otherBrandLogosVisible: z.array(z.string().max(200)).max(20),
  heavyFilters: z.boolean(),
  textLegibility: z.enum(['good', 'low_contrast', 'poor']),
  claimsInImage: z.array(z.string().max(500)).max(30),
});

export async function POST(req: NextRequest) {
  const auth = await verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  try {
    const read = await readJsonBody(req, RequestSchemas.perceive);
    if (!read.ok) return read.response;
    const { imageDataUrl } = read.data;
    const base64Data = imageDataUrl.replace(/^data:image\/(?:jpeg|png|webp);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    let clean: Awaited<ReturnType<typeof sanitizeImage>>;
    try {
      clean = await sanitizeImage(buffer);
    } catch (e) {
      if (e instanceof InvalidImageError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }

    const visionKey = process.env.VISION_API_KEY?.trim();
    const visionModel = process.env.VISION_MODEL?.trim();
    const visionBase = process.env.VISION_BASE_URL?.trim();
    if (!visionKey || !visionModel || !visionBase) {
      return NextResponse.json({ error: 'Image evaluation requires VISION_API_KEY, VISION_MODEL, and VISION_BASE_URL to be configured for a vision-capable provider.' }, { status: 503 });
    }

    const imageAnalysis = await analyzeImageBuffer(clean.buffer);
    const prompt = `Analyze this Instagram marketing image for Thrift-It, an Indian vintage pre-loved clothing brand.
Image specifications: aspect ratio ${imageAnalysis.aspectRatio}, dimensions ${imageAnalysis.width}x${imageAnalysis.height}, dominant colors: ${JSON.stringify(imageAnalysis.dominantColors)}.
Return ONLY valid JSON matching this schema:
{
  "visibleText": string[],
  "garmentDescription": string,
  "setting": string,
  "peoplePresent": boolean,
  "logoVisible": boolean,
  "otherBrandLogosVisible": string[],
  "heavyFilters": boolean,
  "textLegibility": "good" | "low_contrast" | "poor",
  "claimsInImage": string[]
}`;
    const client = new OpenAI({ apiKey: visionKey, baseURL: visionBase, timeout: 20_000, maxRetries: 0 });
    let parsed: z.infer<typeof VisionResultSchema>;
    try {
      const completion = await client.chat.completions.create({
        model: visionModel,
        messages: [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:${clean.mime};base64,${clean.buffer.toString('base64')}` } },
        ] }],
        response_format: { type: 'json_object' },
      });
      parsed = VisionResultSchema.parse(JSON.parse((completion.choices[0]?.message?.content || '').replace(/```(?:json)?/g, '').trim()));
    } catch {
      return NextResponse.json({ error: 'The configured vision provider could not analyze this image. Please retry or use text-only evaluation.' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      perception: { ...parsed, ...imageAnalysis },
      imageMeta: { width: clean.width, height: clean.height, bytes: clean.buffer.length },
      sanitizedImageDataUrl: `data:${clean.mime};base64,${clean.buffer.toString('base64')}`,
      provider: { model: visionModel, analyzed: true },
      message: 'Vision analysis complete',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
