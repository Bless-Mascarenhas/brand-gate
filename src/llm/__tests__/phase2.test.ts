import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import sharp from 'sharp';

const mocks = vi.hoisted(() => ({
  callLLM: vi.fn(),
}));

vi.mock('@/src/llm/callLLM', () => ({ callLLM: mocks.callLLM }));

import { POST as generatePOST } from '@/app/api/llm/generate/route';
import { POST as imagePOST } from '@/app/api/llm/image/route';
import { GeneratedDraft, GeneratedDraftSchema } from '@/src/llm/schemas';

const savedWorkerUrl = process.env.IMAGE_GENERATION_API_URL;
const savedWorkerKey = process.env.IMAGE_GENERATION_API_KEY;
const access = { 'x-demo-access-code': process.env.DEMO_ACCESS_CODE || 'brandgate2026' };
const json = (url: string, body: unknown) => new NextRequest(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...access },
  body: JSON.stringify(body),
});

function draft(caption: string): GeneratedDraft {
  return {
    caption,
    hashtags: ['#ThriftIt'],
    altText: 'Pre-loved denim jacket displayed on a wooden hanger in natural light.',
    imagePrompt: {
      prompt: 'Editorial photograph of a pre-loved denim jacket in a Bandra studio with natural light.',
      negativePrompt: 'text, logos, watermarks',
    },
    marketingScript: '[Hook] Find your next favorite. [Body] Curated pre-loved denim. [CTA] Tap the link in bio.',
    purpose: { summary: 'Promote a curated denim collection', requiredElements: ['Thrift-It'] },
  };
}

function callResult(provider: string, data: GeneratedDraft) {
  return {
    ok: true,
    data,
    log: { provider, model: 'mock-model', purpose: 'mock draft', clauseIdsSent: [], ms: 1, ok: true },
  };
}

describe('generated draft schema fallbacks', () => {
  it('defaults malformed supplemental metadata without relaxing core draft validation', () => {
    const completeDraft = draft('Find your next favorite pre-loved denim jacket at Thrift-It. Tap the link in bio to shop. #ThriftIt');
    const draftWithoutExtras = {
      caption: completeDraft.caption,
      hashtags: completeDraft.hashtags,
      altText: completeDraft.altText,
      imagePrompt: completeDraft.imagePrompt,
    };
    const parsed = GeneratedDraftSchema.safeParse(draftWithoutExtras);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.marketingScript).toBe('');
      expect(parsed.data.purpose).toBeUndefined();
    }
    expect(GeneratedDraftSchema.safeParse({ ...draftWithoutExtras, caption: '' }).success).toBe(false);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  if (savedWorkerUrl === undefined) delete process.env.IMAGE_GENERATION_API_URL;
  else process.env.IMAGE_GENERATION_API_URL = savedWorkerUrl;
  if (savedWorkerKey === undefined) delete process.env.IMAGE_GENERATION_API_KEY;
  else process.env.IMAGE_GENERATION_API_KEY = savedWorkerKey;
});

describe('Phase 2 dual draft generation', () => {
  it('rejects a brief without enough context before calling either model', async () => {
    const response = await generatePOST(json('http://localhost/api/llm/generate', { prompt: 'jeans' }));
    expect(response.status).toBe(400);
    expect(mocks.callLLM).not.toHaveBeenCalled();
  });

  it('runs both draft providers and selects using deterministic policy score', async () => {
    mocks.callLLM.mockImplementation(async ({ provider }) => callResult(
      provider,
      provider === 'groq1'
        ? draft('Get cheap jeans at Thrift-It today. Tap the link in bio. #ThriftIt')
        : draft('Find your next favorite pre-loved denim jacket at Thrift-It. Tap the link in bio to shop. #ThriftIt')
    ));

    const response = await generatePOST(json('http://localhost/api/llm/generate', {
      prompt: 'Promote a pre-loved denim drop to Mumbai college students with confirmed details.',
      format: 'feed_4_5',
      language: 'en',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.callLLM).toHaveBeenCalledTimes(2);
    expect(mocks.callLLM.mock.calls.map(([params]) => params.provider).sort()).toEqual(['groq1', 'groq2']);
    expect(body.selection).toMatchObject({ strategy: 'deterministic-policy-score', selectedProvider: 'Groq 2' });
    expect(body.selection.candidates).toHaveLength(2);
    expect(body.draft.caption).toContain('pre-loved');
    expect(body.draft.imagePrompt.prompt).toContain('Editorial photograph');
  });

  it('uses the available draft and labels the failed provider honestly', async () => {
    mocks.callLLM.mockImplementation(async ({ provider }) => provider === 'groq1'
      ? { ok: false, error: 'provider unavailable', log: { provider, model: 'mock-model', purpose: 'mock draft', clauseIdsSent: [], ms: 1, ok: false } }
      : callResult(provider, draft('Find your next favorite pre-loved denim jacket at Thrift-It. Tap the link in bio to shop. #ThriftIt')));

    const response = await generatePOST(json('http://localhost/api/llm/generate', {
      prompt: 'Promote a pre-loved denim drop to Mumbai college students with confirmed details.',
      format: 'feed_4_5',
      language: 'en',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.selection.selectedProvider).toBe('Groq 2');
    expect(body.selection.candidates).toEqual([
      expect.objectContaining({ provider: 'Groq 1', status: 'unavailable' }),
      expect.objectContaining({ provider: 'Groq 2', status: 'available' }),
    ]);
  });

  it('returns sanitized provider-specific reasons when both draft providers fail', async () => {
    mocks.callLLM.mockImplementation(async ({ provider }) => ({
      ok: false,
      error: `${provider} rejected its server API key. Check the configured credentials.`,
      log: { provider, model: 'mock-model', purpose: 'mock draft', clauseIdsSent: [], ms: 1, ok: false },
    }));

    const response = await generatePOST(json('http://localhost/api/llm/generate', {
      prompt: 'Promote a pre-loved denim drop to Mumbai college students with confirmed details.',
      format: 'feed_4_5',
      language: 'en',
    }));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain('Groq 1: groq1 rejected its server API key');
    expect(body.error).toContain('Groq 2: groq2 rejected its server API key');
    expect(body.candidates).toEqual([
      expect.objectContaining({ provider: 'Groq 1', status: 'unavailable', reason: expect.stringContaining('credentials') }),
      expect.objectContaining({ provider: 'Groq 2', status: 'unavailable', reason: expect.stringContaining('credentials') }),
    ]);
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});

describe('Phase 2 image generation', () => {
  it('reports missing Worker configuration without making an outbound request', async () => {
    delete process.env.IMAGE_GENERATION_API_KEY;
    process.env.IMAGE_GENERATION_API_URL = 'https://worker.example/';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await imagePOST(json('http://localhost/api/llm/image', {
      prompt: 'Editorial photograph of a vintage denim jacket in soft natural light.',
      format: 'feed_4_5',
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining('IMAGE_GENERATION_API_KEY') });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends an authenticated prompt and sanitizes the Worker image bytes', async () => {
    process.env.IMAGE_GENERATION_API_URL = 'https://worker.example/';
    process.env.IMAGE_GENERATION_API_KEY = 'test-worker-key-not-real';
    const bytes = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#0E7C7B' } }).png().toBuffer();
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array(bytes), { headers: { 'content-type': 'image/png' } }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await imagePOST(json('http://localhost/api/llm/image', {
      prompt: 'Editorial photograph of a vintage denim jacket in soft natural light.',
      negativePrompt: 'words and logos',
      format: 'feed_4_5',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.source).toBe('cloudflare-workers-ai');
    expect(body.imageDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(body.imageMeta).toMatchObject({ width: 32, height: 24 });
    expect(JSON.stringify(body)).not.toContain('test-worker-key-not-real');
    expect(fetchMock).toHaveBeenCalledWith('https://worker.example/', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-worker-key-not-real' }),
    }));
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(request.body)).prompt).toContain('Target frame: 3:4');
    expect(JSON.parse(String(request.body)).prompt).toContain('Avoid words and logos');
  });

  it('handles Worker auth, quota, content-type, and invalid-image failures without leaking details', async () => {
    process.env.IMAGE_GENERATION_API_URL = 'https://worker.example/';
    process.env.IMAGE_GENERATION_API_KEY = 'test-worker-key-not-real';
    const requestBody = {
      prompt: 'Editorial photograph of a vintage denim jacket in soft natural light.',
      format: 'feed_4_5',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'secret auth payload' }), { status: 401, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'secret quota payload' }), { status: 429, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response('not image', { status: 200, headers: { 'content-type': 'text/plain' } }))
      .mockResolvedValueOnce(new Response(Buffer.from('not an image'), { status: 200, headers: { 'content-type': 'image/png' } }));
    vi.stubGlobal('fetch', fetchMock);

    const unauthorized = await imagePOST(json('http://localhost/api/llm/image', requestBody));
    expect(unauthorized.status).toBe(502);
    expect(JSON.stringify(await unauthorized.json())).not.toContain('secret auth payload');

    const quota = await imagePOST(json('http://localhost/api/llm/image', requestBody));
    expect(quota.status).toBe(429);
    expect(JSON.stringify(await quota.json())).not.toContain('secret quota payload');

    const wrongContentType = await imagePOST(json('http://localhost/api/llm/image', requestBody));
    expect(wrongContentType.status).toBe(502);
    expect(await wrongContentType.json()).toMatchObject({ error: expect.stringContaining('non-image') });

    const invalidImage = await imagePOST(json('http://localhost/api/llm/image', requestBody));
    expect(invalidImage.status).toBe(502);
    expect(await invalidImage.json()).toMatchObject({ error: expect.stringContaining('invalid image') });
  });
});
