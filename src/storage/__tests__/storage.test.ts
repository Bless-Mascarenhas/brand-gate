import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../indexeddb';

describe('Storage Adapter', () => {
  beforeEach(async () => {
    await storage.clear();
  });

  it('stores and retrieves items correctly', async () => {
    await storage.setItem('test_key', { foo: 'bar', count: 42 });
    const val = await storage.getItem<{ foo: string; count: number }>('test_key');
    expect(val).toEqual({ foo: 'bar', count: 42 });
  });

  it('returns null for missing keys', async () => {
    const val = await storage.getItem('non_existent');
    expect(val).toBeNull();
  });

  it('removes items correctly', async () => {
    await storage.setItem('remove_me', 'hello');
    await storage.removeItem('remove_me');
    const val = await storage.getItem('remove_me');
    expect(val).toBeNull();
  });

  it('lists keys with optional prefix filtering', async () => {
    await storage.setItem('post:1', 'p1');
    await storage.setItem('post:2', 'p2');
    await storage.setItem('draft:1', 'd1');

    const postKeys = await storage.listKeys('post:');
    expect(postKeys).toContain('post:1');
    expect(postKeys).toContain('post:2');
    expect(postKeys).not.toContain('draft:1');
  });
});
