import { z } from 'zod';

export const RoleSchema = z.enum(['creator', 'manager', 'reviewer']);
export type Role = z.infer<typeof RoleSchema>;

export const CategorySchema = z.enum([
  'tone',
  'terminology',
  'messaging',
  'factual_accuracy',
  'claims',
  'visual',
  'accessibility',
  'disclosure',
  'regional',
  'security',
]);
export type Category = z.infer<typeof CategorySchema>;

export const SeveritySchema = z.enum(['critical', 'major', 'minor', 'info']);
export type Severity = z.infer<typeof SeveritySchema>;

export const ClauseSchema = z.object({
  id: z.string(),
  docId: z.string(),
  docTitle: z.string(),
  text: z.string(),
  effectiveFrom: z.string().optional(),
  supersedes: z.array(z.string()).optional(),
});
export type Clause = z.infer<typeof ClauseSchema>;

export const PolicyDocSchema = z.object({
  id: z.string(),
  title: z.string(),
  prefix: z.string(),
  version: z.string(),
  effectiveDate: z.string(),
  owner: z.string(),
  content: z.string(),
  clauses: z.array(ClauseSchema),
});
export type PolicyDoc = z.infer<typeof PolicyDocSchema>;

export const AssertionPatternSchema = z.object({
  regex: z.string(),
  captureIndex: z.number().default(1),
  expected: z.union([z.string(), z.number()]),
});
export type AssertionPattern = z.infer<typeof AssertionPatternSchema>;

export const FactEntrySchema = z.object({
  id: z.string(),
  clauseId: z.string(),
  key: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  unit: z.string().optional(),
  validFrom: z.string(),
  validTo: z.string().nullable(),
  status: z.enum(['active', 'expired', 'superseded']),
  aliases: z.array(z.string()).default([]),
  assertionPatterns: z.array(AssertionPatternSchema).optional(),
});
export type FactEntry = z.infer<typeof FactEntrySchema>;

export const RuleTypeSchema = z.enum([
  'banned_term',
  'required_term',
  'regex',
  'count_max',
  'count_min',
  'hashtag_camelcase',
  'numeric_fact',
  'offer_validity',
  'disclosure_required',
  'claim_pattern',
  'alt_text',
  'aspect_ratio',
  'palette_distance',
  'contrast_ratio',
  'injection_pattern',
]);
export type RuleType = z.infer<typeof RuleTypeSchema>;

export const RuleSchema = z.object({
  id: z.string(),
  clause: z.string(),
  type: RuleTypeSchema,
  category: CategorySchema,
  severity: SeveritySchema,
  fields: z.array(z.enum(['caption', 'hashtags', 'alt_text', 'image_text', 'meta'])),
  terms: z.array(z.string()).optional(),
  match: z.enum(['word', 'substring', 'regex']).optional(),
  pattern: z.string().optional(),
  flags: z.string().optional(),
  max: z.number().optional(),
  min: z.number().optional(),
  message: z.string(),
  suggest: z.record(z.string()).optional(),
  autoFix: z.boolean().default(false),
});
export type Rule = z.infer<typeof RuleSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['palette', 'svg', 'hashtags', 'greetings', 'font']),
  data: z.any(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const MarketConfigSchema = z.object({
  region: z.string().default('IN'),
  currency: z.object({
    symbol: z.string().default('₹'),
    code: z.string().default('INR'),
    format: z.string().default('₹{amount} (incl. GST)'),
  }),
  languages: z.array(z.string()),
  cityTiers: z.record(z.array(z.string())),
  festivals: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      dates: z.string(),
      approvedGreetings: z.array(z.string()),
    })
  ),
});
export type MarketConfig = z.infer<typeof MarketConfigSchema>;

export const PolicyPackSchema = z.object({
  version: z.string(),
  hash: z.string(),
  docs: z.array(PolicyDocSchema),
  clauses: z.array(ClauseSchema),
  facts: z.array(FactEntrySchema),
  rules: z.array(RuleSchema),
  assets: z.array(AssetSchema),
  market: MarketConfigSchema,
});
export type PolicyPack = z.infer<typeof PolicyPackSchema>;

export const PostContentSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  altText: z.string().optional(),
  imageDataUrl: z.string().optional(),
  imageMeta: z
    .object({
      width: z.number(),
      height: z.number(),
      bytes: z.number(),
    })
    .optional(),
  format: z.enum(['feed_4_5', 'feed_1_1', 'story_9_16', 'reel_9_16']).optional().default('feed_4_5'),
  paidPartnership: z.boolean().optional(),
  language: z.enum(['en', 'hinglish', 'mr_greeting']).optional().default('en'),
  scheduledDate: z.string().optional(),
});
export type PostContent = z.infer<typeof PostContentSchema>;

export const PurposeSchema = z.object({
  summary: z.string(),
  product: z.string().optional(),
  offer: z.string().optional(),
  cta: z.string().optional(),
  audience: z.string().optional(),
  requiredElements: z.array(z.string()),
});
export type Purpose = z.infer<typeof PurposeSchema>;

export const DisputeNoteSchema = z.object({
  model: z.string(),
  stance: z.enum(['agree', 'disagree']),
  reason: z.string(),
});
export type DisputeNote = z.infer<typeof DisputeNoteSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  source: z.enum(['gate', 'groq', 'nvidia', 'crosscheck']),
  category: CategorySchema,
  severity: SeveritySchema,
  clauseId: z.string(),
  clauseQuote: z.string(),
  postField: z.enum(['caption', 'hashtags', 'alt_text', 'image', 'meta']),
  postQuote: z.string(),
  explanation: z.string(),
  suggestedFix: z.string().optional(),
  autoFixable: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(1),
  verified: z.boolean().default(false),
  agreement: z.enum(['agreed', 'disputed', 'single_source', 'deterministic']),
  disputeNotes: z.array(DisputeNoteSchema).optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const VerdictSchema = z.object({
  status: z.enum(['BLOCKED', 'REVISE', 'READY_FOR_HUMAN']),
  score: z.number().min(0).max(100),
  gatesFailed: z.array(z.string()),
  needsHuman: z.array(z.string()),
  hallucinationsBlocked: z.number().default(0),
});
export type Verdict = z.infer<typeof VerdictSchema>;

export const TraceEventSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  step: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
  message: z.string(),
  data: z.any().optional(),
});
export type TraceEvent = z.infer<typeof TraceEventSchema>;

export const LlmCallLogSchema = z.object({
  provider: z.enum(['gemini', 'groq', 'nvidia']),
  model: z.string(),
  purpose: z.string(),
  clauseIdsSent: z.array(z.string()),
  tokensIn: z.number().optional(),
  tokensOut: z.number().optional(),
  ms: z.number(),
  ok: z.boolean(),
});
export type LlmCallLog = z.infer<typeof LlmCallLogSchema>;

export const RunTraceSchema = z.object({
  id: z.string(),
  packHash: z.string(),
  mode: z.enum(['fast', 'thorough']),
  steps: z.array(TraceEventSchema),
  llmCalls: z.array(LlmCallLogSchema),
  verdict: VerdictSchema,
  findings: z.array(FindingSchema),
});
export type RunTrace = z.infer<typeof RunTraceSchema>;
