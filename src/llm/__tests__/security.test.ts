import { describe, it, expect, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { readJsonBody, RequestSchemas } from '@/src/llm/http';
import { callLLM } from '@/src/llm/callLLM';
import { sanitizeImage, InvalidImageError } from '@/src/verify/sanitizeImage';
import { POST as gatesPOST } from '@/app/api/gates/route';
import { POST as perceivePOST } from '@/app/api/llm/perceive/route';
import { GET as providersGET } from '@/app/api/providers/route';
import nextConfig from '@/next.config';

const json = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const access = { 'x-demo-access-code': process.env.DEMO_ACCESS_CODE || 'brandgate2026' };
const post = { caption: 'Pre-loved denim. #ThriftIt', hashtags: ['#ThriftIt'] };

afterEach(() => {
  delete process.env.GEMINI_TEXT_MODEL;
});

describe('request body validation (spec §18)', () => {
  it('rejects oversized bodies with 413 before parsing', async () => {
    const r = await readJsonBody(json('http://x/api', { a: 'x'.repeat(200) }), RequestSchemas.gates, 100);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(413);
  });

  it('rejects invalid JSON and schema violations with 400', async () => {
    const bad = await readJsonBody(json('http://x/api', '{nope'), RequestSchemas.gates);
    expect(!bad.ok && bad.response.status).toBe(400);
    const wrong = await readJsonBody(json('http://x/api', { post: { caption: 5 } }), RequestSchemas.gates);
    expect(!wrong.ok && wrong.response.status).toBe(400);
  });

  it('applies schema defaults on valid input', async () => {
    const r = await readJsonBody(json('http://x/api', { post }), RequestSchemas.gates);
    expect(r.ok && r.data.post.format).toBe('feed_4_5');
  });

  it('the gates route returns 400 for a malformed post and 200 for a valid one', async () => {
    expect((await gatesPOST(json('http://x/api/gates', { post: { hashtags: 'nope' } }))).status).toBe(400);
    const ok = await gatesPOST(json('http://x/api/gates', { post }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toHaveProperty('findings');
  });
});

describe('image uploads: MIME allow-list and EXIF stripping', () => {
  it('perceive rejects non-image or unsupported data URLs', async () => {
    const html = await perceivePOST(json('http://x/api/llm/perceive', { imageDataUrl: 'data:text/html;base64,PHNjcmlwdD4=' }, access));
    expect(html.status).toBe(400);
    const svg = await perceivePOST(json('http://x/api/llm/perceive', { imageDataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' }, access));
    expect(svg.status).toBe(400);
  });

  it('perceive rejects bytes that claim to be JPEG but do not decode', async () => {
    const res = await perceivePOST(json('http://x/api/llm/perceive', { imageDataUrl: `data:image/jpeg;base64,${Buffer.from('not an image').toString('base64')}` }, access));
    expect(res.status).toBe(400);
  });

  it('sanitizeImage removes EXIF metadata and caps the long edge at 1080 px', async () => {
    const withExif = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: '#0E7C7B' } })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'secret-gps-owner' } } })
      .toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const clean = await sanitizeImage(withExif);
    const meta = await sharp(clean.buffer).metadata();
    expect(meta.exif).toBeUndefined();
    expect(Math.max(clean.width, clean.height)).toBe(1080);
    expect(clean.buffer.toString('latin1')).not.toContain('secret-gps-owner');
  });

  it('sanitizeImage refuses non-images', async () => {
    await expect(sanitizeImage(Buffer.from('<svg/>'))).rejects.toBeInstanceOf(InvalidImageError);
  });
});

describe('model IDs come only from env (spec §0, §24)', () => {
  it('callLLM refuses to run without a configured model, even with a key', async () => {
    const savedKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'test-key-not-real';
    delete process.env.GEMINI_TEXT_MODEL;
    const res = await callLLM({ provider: 'gemini', system: 's', user: 'u', purpose: 't', clauseIdsSent: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/GEMINI_TEXT_MODEL is not configured/);
    expect(res.modeSuggestion).toBe('replay');
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = savedKey;
  });

  it('provider chips need key AND model, and never return secret values', async () => {
    const savedKey = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = 'xai-secret-value';
    const body = await (await providersGET()).json();
    expect(body.providers.xai).toBe('missing'); // no XAI_MODEL
    expect(JSON.stringify(body)).not.toContain('xai-secret-value');
    if (savedKey === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = savedKey;
  });
});

describe('security headers', () => {
  it('sets CSP with frame-ancestors none, X-Frame-Options, nosniff and referrer policy', async () => {
    const rules = await nextConfig.headers!();
    const headers = Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]));
    expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(headers['Content-Security-Policy']).toContain("object-src 'none'");
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
});
