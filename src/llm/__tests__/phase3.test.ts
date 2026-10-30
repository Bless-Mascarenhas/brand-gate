import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { InvalidImageError, sanitizeImage } from '@/src/verify/sanitizeImage';

const mocks = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock('openai', () => ({
  default: class OpenAI {
    chat = { completions: { create: mocks.create } };
  },
}));

import { POST as perceivePOST } from '@/app/api/llm/perceive/route';

const access = { 'x-demo-access-code': process.env.DEMO_ACCESS_CODE || 'brandgate2026' };
const savedEnv = {
  key: process.env.VISION_API_KEY,
  model: process.env.VISION_MODEL,
  base: process.env.VISION_BASE_URL,
};

function request(imageDataUrl: string) {
  return new NextRequest('http://localhost/api/llm/perceive', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...access },
    body: JSON.stringify({ imageDataUrl }),
  });
}

async function image(format: 'jpeg' | 'png' | 'webp') {
  return sharp({ create: { width: 40, height: 30, channels: 3, background: '#0E7C7B' } })
    .composite([{ input: Buffer.from('<svg width="20" height="20"><rect width="20" height="20" fill="#ffffff"/></svg>'), left: 0, top: 0 }])
    .toFormat(format)
    .toBuffer();
}

afterEach(() => {
  vi.clearAllMocks();
  if (savedEnv.key === undefined) delete process.env.VISION_API_KEY; else process.env.VISION_API_KEY = savedEnv.key;
  if (savedEnv.model === undefined) delete process.env.VISION_MODEL; else process.env.VISION_MODEL = savedEnv.model;
  if (savedEnv.base === undefined) delete process.env.VISION_BASE_URL; else process.env.VISION_BASE_URL = savedEnv.base;
});

describe('Phase 3 uploaded-image evaluation', () => {
  it.each([['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']] as const)('accepts a valid %s upload and sends only its sanitized JPEG to vision', async (format, mime) => {
    process.env.VISION_API_KEY = 'vision-test-key';
    process.env.VISION_MODEL = 'vision-test-model';
    process.env.VISION_BASE_URL = 'https://vision.example/v1';
    mocks.create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      visibleText: ['Flat 20% off'], garmentDescription: 'Denim jacket', setting: 'Studio', peoplePresent: false,
      logoVisible: false, otherBrandLogosVisible: [], heavyFilters: false, textLegibility: 'good', claimsInImage: ['Flat 20% off'],
    }) } }] });

    const source = await image(format);
    const response = await perceivePOST(request(`data:${mime};base64,${source.toString('base64')}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.provider).toEqual({ model: 'vision-test-model', analyzed: true });
    expect(body.sanitizedImageDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    const content = mocks.create.mock.calls[0][0].messages[0].content;
    expect(content[1].image_url.url).toBe(body.sanitizedImageDataUrl);
    expect(content[1].image_url.url).not.toBe(`data:${mime};base64,${source.toString('base64')}`);
  });

  it('returns a clear unavailable state instead of claiming a text model inspected the image', async () => {
    const source = await image('png');
    const response = await perceivePOST(request(`data:image/png;base64,${source.toString('base64')}`));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('vision-capable provider') });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects empty, transparent, malformed, and blank images safely', async () => {
    await expect(sanitizeImage(Buffer.alloc(0))).rejects.toBeInstanceOf(InvalidImageError);
    const transparent = await sharp({ create: { width: 32, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    await expect(sanitizeImage(transparent)).rejects.toThrow('fully transparent');
    const white = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ffffff' } }).png().toBuffer();
    await expect(sanitizeImage(white)).rejects.toThrow('blank');
    const malformed = await perceivePOST(request(`data:image/jpeg;base64,${Buffer.from('not an image').toString('base64')}`));
    expect(malformed.status).toBe(400);
  });
});
