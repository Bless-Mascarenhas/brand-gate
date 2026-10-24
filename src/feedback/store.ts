// In-app user-testing feedback (spec §17): stored in this browser, exportable as JSON. Never sent anywhere.
import { z } from 'zod';
import { StorageAdapter, storage as defaultStorage } from '@/src/storage';

export const FEEDBACK_KEY = 'feedback:v1';

export const FeedbackSchema = z.object({
  task: z.string().trim().min(1, 'Choose the task you tried').max(200),
  completed: z.enum(['yes', 'partly', 'no']),
  ease: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000),
  role: z.string().max(40).optional(),
});
export type FeedbackInput = z.infer<typeof FeedbackSchema>;
export type FeedbackEntry = FeedbackInput & { id: string; submittedAt: string };

export async function loadFeedback(adapter: StorageAdapter = defaultStorage): Promise<FeedbackEntry[]> {
  const stored = await adapter.getItem<unknown>(FEEDBACK_KEY);
  return Array.isArray(stored) ? (stored as FeedbackEntry[]) : [];
}

export async function addFeedback(input: unknown, adapter: StorageAdapter = defaultStorage, now = new Date()): Promise<FeedbackEntry[]> {
  const data = FeedbackSchema.parse(input);
  const entries = await loadFeedback(adapter);
  const entry: FeedbackEntry = { ...data, id: `fb-${now.getTime()}-${entries.length + 1}`, submittedAt: now.toISOString() };
  const next = [...entries, entry];
  await adapter.setItem(FEEDBACK_KEY, next);
  return next;
}

export async function clearFeedback(adapter: StorageAdapter = defaultStorage): Promise<void> {
  await adapter.removeItem(FEEDBACK_KEY);
}

/** JSON export: self-describing so it is never mistaken for analysed results. */
export function feedbackExport(entries: FeedbackEntry[], exportedAt = new Date()): string {
  return JSON.stringify(
    {
      kind: 'brand-gate-feedback',
      note: 'Raw responses collected in one browser via the in-app form. Not analysed, not anonymised beyond what respondents typed.',
      exportedAt: exportedAt.toISOString(),
      count: entries.length,
      entries,
    },
    null,
    2
  );
}
