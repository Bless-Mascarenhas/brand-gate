import { get, set, del, keys, clear } from 'idb-keyval';
import { StorageAdapter } from './types';
import { FallbackAdapter, SupabaseAdapter } from './supabase';

class IndexedDbAdapter implements StorageAdapter {
  private memFallback = new Map<string, unknown>();

  private isIdbAvailable(): boolean {
    return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
  }

  async getItem<T>(key: string): Promise<T | null> {
    if (!this.isIdbAvailable()) {
      const val = this.memFallback.get(key);
      return (val as T) ?? null;
    }
    try {
      const result = await get<T>(key);
      return result ?? null;
    } catch {
      const val = this.memFallback.get(key);
      return (val as T) ?? null;
    }
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    if (!this.isIdbAvailable()) {
      this.memFallback.set(key, value);
      return;
    }
    try {
      await set(key, value);
    } catch {
      this.memFallback.set(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (!this.isIdbAvailable()) {
      this.memFallback.delete(key);
      return;
    }
    try {
      await del(key);
    } catch {
      this.memFallback.delete(key);
    }
  }

  async listKeys(prefix?: string): Promise<string[]> {
    if (!this.isIdbAvailable()) {
      const all = Array.from(this.memFallback.keys());
      return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
    }
    try {
      const all = (await keys()) as string[];
      return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
    } catch {
      const all = Array.from(this.memFallback.keys());
      return prefix ? all.filter((k) => k.startsWith(prefix)) : all;
    }
  }

  async clear(): Promise<void> {
    if (!this.isIdbAvailable()) {
      this.memFallback.clear();
      return;
    }
    try {
      await clear();
    } catch {
      this.memFallback.clear();
    }
  }
}

const local = new IndexedDbAdapter();

/** Always the browser store, regardless of the configured mode. */
export const localStorageAdapter: StorageAdapter = local;

/**
 * The app-wide adapter. Browser storage by default; with NEXT_PUBLIC_STORAGE_MODE=supabase
 * (a mode flag, not a secret) it uses the server-proxied Supabase store and falls back
 * to the browser store on any failure.
 */
export const storage: StorageAdapter =
  process.env.NEXT_PUBLIC_STORAGE_MODE === 'supabase' ? new FallbackAdapter(new SupabaseAdapter(), local) : local;
