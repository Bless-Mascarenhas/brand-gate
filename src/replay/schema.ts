// src/replay/schema.ts — recorded runs for Replay mode (spec §19). Validated on every load.
import { z } from 'zod';
import { FindingSchema, LlmCallLogSchema, PostContentSchema, VerdictSchema } from '@/src/types';

export const ProvenanceSchema = z.enum([
  'live_recording', // produced by real model calls when the file was recorded
  'deterministic_recording', // real pipeline run, but only its deterministic stages (no model calls)
  'illustrative_fixture', // hand-written example output, NOT model output
]);
export type Provenance = z.infer<typeof ProvenanceSchema>;

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  live_recording: 'Recorded live model run',
  deterministic_recording: 'Recorded deterministic run (no model calls)',
  illustrative_fixture: 'Illustrative fixture (hand-written, not model output)',
};

const StepSchema = z.object({ step: z.string(), status: z.enum(['completed', 'skipped', 'failed']), message: z.string() });

const Base = {
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  recordedAt: z.string(),
  packHash: z.string(),
  demoDate: z.string(),
  generator: z.literal('scripts/record-replay.ts'),
  notes: z.array(z.string()),
};

export const SampleReplaySchema = z.object({
  ...Base,
  kind: z.literal('sample'),
  provenance: ProvenanceSchema,
  sampleId: z.number().int().min(1).max(12),
  post: PostContentSchema,
  steps: z.array(StepSchema).min(1),
  findings: z.array(FindingSchema),
  verdict: VerdictSchema,
  llmCalls: z.array(LlmCallLogSchema),
  dropped: z.array(z.object({ clauseId: z.string(), source: z.string(), reason: z.string() })),
});

export const CompareMetricsSchema = z.object({
  gateFailures: z.number(),
  staleOrWrongFacts: z.number(),
  bannedTerms: z.number(),
  unsupportedClaims: z.number(),
  accessibilityGaps: z.number(),
  bySeverity: z.object({ critical: z.number(), major: z.number(), minor: z.number(), info: z.number() }),
  score: z.number(),
  verdict: z.enum(['BLOCKED', 'REVISE', 'READY_FOR_HUMAN']),
});

export const CompareColumnSchema = z.object({
  key: z.enum(['bare', 'policies', 'governed']),
  label: z.string(),
  provenance: ProvenanceSchema,
  post: PostContentSchema,
  metrics: CompareMetricsSchema,
  findings: z.array(FindingSchema),
  pipelineVerdict: VerdictSchema.optional(),
  llmCalls: z.array(LlmCallLogSchema),
  wallMs: z.number().nullable(),
  note: z.string(),
});

export const CompareReplaySchema = z.object({
  ...Base,
  kind: z.literal('compare'),
  provenance: ProvenanceSchema,
  scenarioId: z.string(),
  brief: z.string(),
  columns: z.array(CompareColumnSchema).length(3),
});

export const ReplaySchema = z.discriminatedUnion('kind', [SampleReplaySchema, CompareReplaySchema]);
export type SampleReplay = z.infer<typeof SampleReplaySchema>;
export type CompareReplay = z.infer<typeof CompareReplaySchema>;
export type Replay = z.infer<typeof ReplaySchema>;

export const sampleReplayId = (n: number) => `sample-${String(n).padStart(2, '0')}`;
export const compareReplayId = (scenarioId: string) => `compare-${scenarioId}`;
