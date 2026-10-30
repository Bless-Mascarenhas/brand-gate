import { z } from 'zod';
import { PurposeSchema } from '@/src/types';

export const MIN_GENERATION_BRIEF_LENGTH = 20;

export const ImagePromptSpecSchema = z.object({
  prompt: z.string().trim().min(20).max(1200),
  negativePrompt: z.string().max(800),
});

export const GeneratedDraftSchema = z.object({
  caption: z.string().trim().min(1).max(600),
  hashtags: z.array(z.string().trim().min(1).max(80)).max(8),
  altText: z.string().trim().min(20).max(125),
  imagePrompt: ImagePromptSpecSchema,
  marketingScript: z.string().max(3000).catch('').optional().default(''),
  purpose: PurposeSchema.optional().catch(undefined),
});

export type GeneratedDraft = z.infer<typeof GeneratedDraftSchema>;
export type ImagePromptSpec = z.infer<typeof ImagePromptSpecSchema>;

export interface DraftCandidateSummary {
  provider: string;
  status: 'available' | 'unavailable';
  reason?: string;
  score?: number;
  verdict?: 'BLOCKED' | 'REVISE' | 'READY_FOR_HUMAN';
}

export interface DraftSelectionSummary {
  strategy: 'deterministic-policy-score';
  selectedProvider: string;
  candidates: DraftCandidateSummary[];
}