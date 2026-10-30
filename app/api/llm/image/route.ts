import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody, RequestSchemas } from '@/src/llm/http';
import { verifyLlmAccess } from '@/src/llm/gatekeeper';
import { InvalidImageError, sanitizeImage } from '@/src/verify/sanitizeImage';

export const runtime = 'nodejs';
export const maxDuration = 60;
const MAX_IMAGE_BYTES = 4_000_000;

class ImageResponseTooLargeError extends Error {}

function workerUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function readImageBody(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new InvalidImageError('Empty image response.');
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new ImageResponseTooLargeError();
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function POST(req: NextRequest) {
  const auth = await verifyLlmAccess(req);
  if (!auth.authorized) return auth.response!;

  const read = await readJsonBody(req, RequestSchemas.image);
  if (!read.ok) return read.response;

  const { prompt, negativePrompt = '', format = 'feed_4_5', festival = '' } = read.data;
  const endpoint = process.env.IMAGE_GENERATION_API_URL?.trim();
  const apiKey = process.env.IMAGE_GENERATION_API_KEY?.trim();
  const hfToken = process.env.HF_TOKEN?.trim() || process.env.HUGGINGFACE_API_KEY?.trim();

  if (endpoint && !apiKey) {
    return NextResponse.json({
      error: 'Image generation is not configured. Add IMAGE_GENERATION_API_URL and IMAGE_GENERATION_API_KEY on the server.',
    }, { status: 503 });
  }

  if (!endpoint && !hfToken) {
    return NextResponse.json({
      error: 'Image generation is not configured. Add IMAGE_GENERATION_API_URL and IMAGE_GENERATION_API_KEY on the server.',
    }, { status: 503 });
  }

  const aspectRatio = format === 'feed_1_1' ? '1:1' : format === 'story_9_16' || format === 'reel_9_16' ? '9:16' : '3:4';
  const workerPrompt = `Create a high-quality social media photograph for Thrift-It, a pre-loved clothing brand in Bandra, Mumbai. Creative direction: ${prompt}. Festival context: ${festival || 'none'}. Target frame: ${aspectRatio}. Use natural editorial studio light, authentic garment texture, a clean neutral setting, and restrained Thrift Teal (#0E7C7B), Marigold (#F2A900), Paper (#FAF6EE), and Ink (#1B1B1F) accents. Avoid ${negativePrompt || 'text, logos, and watermarks'}; the official wordmark is composited separately.`;

  try {
    let response: Response;
    let source = 'cloudflare-workers-ai';

    if (endpoint && apiKey) {
      const url = workerUrl(endpoint);
      if (!url) return NextResponse.json({ error: 'IMAGE_GENERATION_API_URL must be an HTTPS Worker root URL.' }, { status: 503 });

      response = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: workerPrompt }),
        cache: 'no-store',
        signal: AbortSignal.timeout(45_000),
      });
    } else {
      // Hugging Face free inference API
      source = 'hugging-face-flux';
      response = await fetch('https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: workerPrompt }),
        cache: 'no-store',
        signal: AbortSignal.timeout(45_000),
      });
    }

    if (response.status === 401) {
      return NextResponse.json({ error: 'The image service rejected the configured API key/token.' }, { status: 502 });
    }
    if (response.status === 429) {
      return NextResponse.json({ error: 'The image generation quota or rate limit was reached. Please retry later.' }, { status: 429 });
    }
    if (!response.ok) {
      return NextResponse.json({ error: 'The image generation provider could not generate an image. Check status and credentials.' }, { status: 502 });
    }

    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType || '')) {
      return NextResponse.json({ error: 'The image provider returned a non-image response.' }, { status: 502 });
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (declaredLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'The image provider returned an oversized image.' }, { status: 502 });

    const generatedBytes = await readImageBody(response);
    const clean = await sanitizeImage(generatedBytes);
    return NextResponse.json({
      imageDataUrl: `data:${clean.mime};base64,${clean.buffer.toString('base64')}`,
      imageMeta: { width: clean.width, height: clean.height, bytes: clean.buffer.length },
      source,
      promptUsed: workerPrompt,
    });
  } catch (error) {
    const message = error instanceof InvalidImageError
      ? 'The image Worker returned an invalid image. Please retry.'
      : error instanceof ImageResponseTooLargeError
        ? 'The image Worker returned an oversized image.'
        : 'Image generation failed. Check the Worker deployment or quota and try again.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
