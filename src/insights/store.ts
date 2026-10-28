// src/insights/store.ts
/**
 * Insight events: live events appended in this browser through the StorageAdapter.
 */
import { StorageAdapter, storage as defaultStorage } from '@/src/storage';
import { InsightEvent } from '@/src/insights/types';

export const INSIGHT_EVENTS_KEY = 'insights:events:v1';

export async function loadLiveEvents(adapter: StorageAdapter = defaultStorage): Promise<InsightEvent[]> {
  const stored = await adapter.getItem<unknown>(INSIGHT_EVENTS_KEY);
  return Array.isArray(stored) ? (stored as InsightEvent[]) : [];
}

export async function appendInsightEvents(events: InsightEvent[], adapter: StorageAdapter = defaultStorage): Promise<void> {
  if (events.length === 0) return;
  const live = await loadLiveEvents(adapter);
  await adapter.setItem(INSIGHT_EVENTS_KEY, [...live, ...events]);
}

export async function loadAllEvents(adapter: StorageAdapter = defaultStorage): Promise<InsightEvent[]> {
  return loadLiveEvents(adapter);
}
