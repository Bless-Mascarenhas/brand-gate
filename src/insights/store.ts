// src/insights/store.ts
/**
 * Insight events: seeded sample history (data/seed/insights-events.json, every
 * event `sample: true`) plus live events appended in this browser through the
 * StorageAdapter. Seeded events are never written to storage, so the two can
 * always be told apart.
 */
import seed from '@/data/seed/insights-events.json';
import { StorageAdapter, storage as defaultStorage } from '@/src/storage';
import { InsightEvent } from '@/src/insights/types';

export const INSIGHT_EVENTS_KEY = 'insights:events:v1';

export const SEEDED_INSIGHT_EVENTS = seed as unknown as InsightEvent[];

export async function loadLiveEvents(adapter: StorageAdapter = defaultStorage): Promise<InsightEvent[]> {
  const stored = await adapter.getItem<unknown>(INSIGHT_EVENTS_KEY);
  return Array.isArray(stored) ? (stored as InsightEvent[]).map((e) => ({ ...e, sample: false })) : [];
}

export async function appendInsightEvents(events: InsightEvent[], adapter: StorageAdapter = defaultStorage): Promise<void> {
  if (events.length === 0) return;
  const live = await loadLiveEvents(adapter);
  await adapter.setItem(INSIGHT_EVENTS_KEY, [...live, ...events.map((e) => ({ ...e, sample: false }))]);
}

export async function loadAllEvents(adapter: StorageAdapter = defaultStorage): Promise<InsightEvent[]> {
  return [...SEEDED_INSIGHT_EVENTS.map((e) => ({ ...e, sample: true })), ...(await loadLiveEvents(adapter))];
}
