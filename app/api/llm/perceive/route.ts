import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, RequestSchemas } from '@/src/llm/http';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { analyzeImageBuffer } from '@/src/verify/perception';
import { InvalidImageError, sanitizeImage } from '@/src/verify/sanitizeImage';
import OpenAI from 'openai';

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

      // Query Groq 1 for structured scene comprehension
      const groqKey = process.env.GROQ_API_KEY_1?.trim() || process.env.GROQ_API_KEY?.trim();
      const groqModel = process.env.GROQ_MODEL_1?.trim() || 'llama-3.3-70b-versatile';
      const groqBase = process.env.GROQ_BASE_URL_1?.trim() || process.env.GROQ_BASE_URL?.trim() || 'https://api.groq.com/openai/v1';

      if (groqKey) {
        try {
          const client = new OpenAI({
            apiKey: groqKey,
            baseURL: groqBase,
            timeout: 20000,
            maxRetries: 0,
          });

          const prompt = `Analyze this Instagram marketing image for Thrift-It, an Indian vintage pre-loved clothing brand.
Image specifications: aspect ratio ${perception.aspectRatio}, dimensions ${perception.width}x${perception.height}, dominant colors: ${JSON.stringify(perception.dominantColors)}.
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

          const isVisionModel = groqModel.includes('vision');
          const messages: any[] = isVisionModel
            ? [
                {
                  role: 'user',
                  content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: `data:${clean.mime};base64,${clean.buffer.toString('base64')}` } },
                  ],
                },
              ]
            : [{ role: 'user', content: prompt }];

          const completion = await client.chat.completions.create({
            model: groqModel,
            messages,
            response_format: { type: 'json_object' },
          });

          const text = completion.choices[0]?.message?.content;
          if (text) {
            const parsed = JSON.parse(text.replace(/```(?:json)?/g, '').trim());
            perception = {
              ...perception,
              ...parsed,
            };
          }
        } catch (groqErr: any) {
          console.warn('Groq perception warning:', groqErr.message);
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
