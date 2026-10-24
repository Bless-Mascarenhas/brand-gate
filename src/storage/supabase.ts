// Optional Supabase-backed StorageAdapter. Talks only to our own /api/storage
// route (which holds the service-role key server-side). Any failure falls back
// to the local adapter so the app keeps working offline or without Supabase.
import { StorageAdapter } from './types';

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class SupabaseAdapter implements StorageAdapter {
  constructor(private readonly fetchImpl: FetchLike = (i, init) => fetch(i, init), private readonly base = '/api/storage') {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.fetchImpl(`${this.base}${path}`, { credentials: 'same-origin', ...init });
    if (!res.ok) throw new Error(`storage ${res.status}`);
    return (await res.json()) as T;
  }

  async getItem<T>(key: string): Promise<T | null> {
    return (await this.call<{ value: T | null }>(`?key=${encodeURIComponent(key)}`)).value;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    await this.call('', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }) });
  }

  async removeItem(key: string): Promise<void> {
    await this.call(`?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
  }

  async listKeys(prefix?: string): Promise<string[]> {
    return (await this.call<{ keys: string[] }>(prefix ? `?prefix=${encodeURIComponent(prefix)}` : '')).keys;
  }

  async clear(): Promise<void> {
    for (const k of await this.listKeys()) await this.removeItem(k);
  }
}

/**
 * Primary-with-fallback: reads and writes go to `primary`; on any error the
 * call is served by `fallback` and `lastError` records why, so data is never
 * silently dropped. Writes also mirror to the fallback so a later outage still
 * has the latest local copy.
 */
export class FallbackAdapter implements StorageAdapter {
  lastError: string | null = null;

  constructor(private readonly primary: StorageAdapter, private readonly fallback: StorageAdapter) {}

  private async run<T>(op: (a: StorageAdapter) => Promise<T>): Promise<T> {
    try {
      const out = await op(this.primary);
      this.lastError = null;
      return out;
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      return op(this.fallback);
    }
  }

  getItem<T>(key: string) {
    return this.run((a) => a.getItem<T>(key));
  }
  async setItem<T>(key: string, value: T) {
    await this.fallback.setItem(key, value);
    await this.run((a) => (a === this.fallback ? Promise.resolve() : a.setItem(key, value)));
  }
  async removeItem(key: string) {
    await this.fallback.removeItem(key);
    await this.run((a) => (a === this.fallback ? Promise.resolve() : a.removeItem(key)));
  }
  listKeys(prefix?: string) {
    return this.run((a) => a.listKeys(prefix));
  }
  async clear() {
    await this.fallback.clear();
    await this.run((a) => (a === this.fallback ? Promise.resolve() : a.clear()));
  }
}
