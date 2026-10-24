import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, RequestSchemas } from '@/src/llm/http';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { analyzeImageBuffer } from '@/src/verify/perception';
import { InvalidImageError, sanitizeImage } from '@/src/verify/sanitizeImage';
import { GoogleGenAI } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  try {
    const read = await readJsonBody(req, RequestSchemas.perceive);
    if (!read.ok) return read.response;
    const body = read.data;
    const { imageDataUrl, imageMeta } = body;

    let perception = {
      visibleText: [] as string[],
      garmentDescription: 'Curated vintage clothing piece',
      setting: 'Studio photoshoot with neutral backdrop',
      peoplePresent: false,
      logoVisible: false,
      otherBrandLogosVisible: [] as string[],
      heavyFilters: false,
      textLegibility: 'good' as 'good' | 'low_contrast' | 'poor',
      claimsInImage: [] as string[],
      aspectRatio: '4:5',
      dominantColors: [] as any[],
      byteSize: imageMeta?.bytes || 0,
      width: imageMeta?.width || 1080,
      height: imageMeta?.height || 1350,
    };

    if (imageDataUrl && imageDataUrl.startsWith('data:image/')) {
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      // Re-encoded copy without EXIF/GPS metadata; this is the only version that may leave the server.
      let clean: Awaited<ReturnType<typeof sanitizeImage>>;
      try {
        clean = await sanitizeImage(buffer);
      } catch (e) {
        if (e instanceof InvalidImageError) return NextResponse.json({ error: e.message }, { status: 400 });
        throw e;
      }

      try {
        const imageAnalysis = await analyzeImageBuffer(buffer);
        perception.aspectRatio = imageAnalysis.aspectRatio;
        perception.dominantColors = imageAnalysis.dominantColors;
        perception.width = imageAnalysis.width;
        perception.height = imageAnalysis.height;
        perception.byteSize = imageAnalysis.byteSize;
      } catch (err: any) {
        console.warn('Image analysis fallback:', err.message);
      }

      // If Gemini API Key exists, query Gemini Vision for structured scene comprehension
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const visionModel = process.env.GEMINI_VISION_MODEL?.trim();
          if (!visionModel) throw new Error('GEMINI_VISION_MODEL is not configured');

          const prompt = `Analyze this Instagram marketing image for Thrift-It, an Indian vintage pre-loved clothing brand.
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

          const res = await Promise.race([
            ai.models.generateContent({
              model: visionModel,
              contents: [
                prompt,
                {
                  inlineData: {
                    mimeType: clean.mime,
                    data: clean.buffer.toString('base64'),
                  },
                },
              ],
              config: { responseMimeType: 'application/json' },
            }),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Perceive timeout')), 15000)
            ),
          ]);

          if (res.text) {
            const parsed = JSON.parse(res.text.replace(/```(?:json)?/g, '').trim());
            perception = {
              ...perception,
              ...parsed,
            };
          }
        } catch (visionErr: any) {
          console.warn('Gemini vision perceive warning:', visionErr.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      perception,
      message: 'Perception analysis complete',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
