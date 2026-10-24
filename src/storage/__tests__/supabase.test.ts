import { describe, it, expect, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { FallbackAdapter, SupabaseAdapter } from '@/src/storage/supabase';
import { StorageAdapter } from '@/src/storage/types';
import { storage, localStorageAdapter } from '@/src/storage/indexeddb';
import { GET, PUT } from '@/app/api/storage/route';

function memory(): StorageAdapter & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    getItem: async <T,>(k: string) => (data.has(k) ? (data.get(k) as T) : null),
    setItem: async <T,>(k: string, v: T) => { data.set(k, v); },
    removeItem: async (k: string) => { data.delete(k); },
    listKeys: async (p?: string) => Array.from(data.keys()).filter((k) => !p || k.startsWith(p)),
    clear: async () => data.clear(),
  };
}

describe('Supabase storage adapter (optional)', () => {
  afterEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    vi.unstubAllGlobals();
  });

  it('browser storage stays the default', () => {
    expect(storage).toBe(localStorageAdapter);
  });

  it('client adapter only talks to our own /api/storage route, never to Supabase directly', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(url.includes('key=') && !init?.method ? { value: { a: 1 } } : { ok: true, keys: ['workflow:posts:v1'] }), { status: 200 });
    };
    const a = new SupabaseAdapter(fake);
    expect(await a.getItem('workflow:posts:v1')).toEqual({ a: 1 });
    await a.setItem('k', { b: 2 });
    expect(await a.listKeys('work')).toEqual(['workflow:posts:v1']);
    expect(calls.every((c) => c.url.startsWith('/api/storage'))).toBe(true);
    expect(calls[1].init).toMatchObject({ method: 'PUT', body: JSON.stringify({ key: 'k', value: { b: 2 } }) });
  });

  it('falls back to local storage when the remote store fails, and records why', async () => {
    const local = memory();
    const failing = new SupabaseAdapter(async () => new Response('{}', { status: 502 }));
    const a = new FallbackAdapter(failing, local);
    await a.setItem('x', 42);
    expect(local.data.get('x')).toBe(42); // never lost
    expect(await a.getItem('x')).toBe(42);
    expect(a.lastError).toMatch(/502/);
  });

  it('mirrors writes to local storage when the remote store works', async () => {
    const local = memory();
    const remote = memory();
    const a = new FallbackAdapter(remote, local);
    await a.setItem('x', 1);
    expect(remote.data.get('x')).toBe(1);
    expect(local.data.get('x')).toBe(1);
    expect(a.lastError).toBeNull();
  });

  it('route reports 501 when Supabase is not configured', async () => {
    const res = await GET(new NextRequest('http://localhost/api/storage?key=a'));
    expect(res.status).toBe(501);
  });

  it('route requires the access code and sends the service-role key only server-side', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
    expect((await GET(new NextRequest('http://localhost/api/storage?key=a'))).status).toBe(401);

    const seen: { url: string; headers: Record<string, string> }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      seen.push({ url, headers: init.headers as Record<string, string> });
      return new Response(JSON.stringify([{ value: { hello: 'world' } }]), { status: 200 });
    });
    const headers = { 'x-demo-access-code': process.env.DEMO_ACCESS_CODE || 'brandgate2026' };
    const res = await GET(new NextRequest('http://localhost/api/storage?key=workflow:posts:v1', { headers }));
    expect(await res.json()).toEqual({ value: { hello: 'world' } });
    expect(seen[0].url).toBe('https://example.supabase.co/rest/v1/brand_gate_kv?key=eq.workflow%3Aposts%3Av1&select=value');
    expect(seen[0].headers.Authorization).toBe('Bearer service-role-test');
    expect(JSON.stringify(await (await GET(new NextRequest('http://localhost/api/storage?key=a', { headers }))).json())).not.toContain('service-role-test');
  });

  it('route rejects invalid keys and surfaces upstream failures without claiming success', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
    const headers = { 'x-demo-access-code': process.env.DEMO_ACCESS_CODE || 'brandgate2026' };
    expect((await GET(new NextRequest('http://localhost/api/storage?key=../etc', { headers }))).status).toBe(400);
    vi.stubGlobal('fetch', async () => new Response('down', { status: 503 }));
    const res = await PUT(new NextRequest('http://localhost/api/storage', { method: 'PUT', headers, body: JSON.stringify({ key: 'k', value: 1 }) }));
    expect(res.status).toBe(502);
  });
});
