import { z } from 'zod'

import {
  CircuitBreakerStateSchema,
  CompilePurposeSchema,
  ConfidenceSchema,
  ErrorClassSchema,
  EvidenceLocatorSchema,
  JobStatusSchema,
  JsonValueSchema,
  SourceTypeSchema,
  TimestampSchema,
  UuidSchema,
  VerificationStatusSchema,
} from './common'

export const CreateBusinessSchema = z.object({
  workspaceId: z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/),
  name: z.string().min(1).max(256),
  primaryMarket: z.string().min(1),
  primaryAdvertisingObjective: z.string().min(1),
  primaryBusinessOutcome: z.string().min(1),
  approximateMonthlyMetaBudget: z.number().min(0),
  websiteUrl: z.string().url().optional(),
})

export const UpdateBusinessSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  websiteUrl: z.string().url().nullable().optional(),
})

export const StartOnboardingSchema = z.object({
  businessId: UuidSchema,
})

export const SubmitSourceSchema = z.object({
  sourceType: SourceTypeSchema,
  sourceName: z.string().min(1).max(256),
  externalReference: z.string().optional(),
  metadata: z.record(z.string(), JsonValueSchema).optional(),
})

export const ProcessSourceSchema = z.object({
  sourceId: UuidSchema,
})

export const ArchiveSourceSchema = z.object({
  sourceId: UuidSchema,
})

export const AnswerQuestionSchema = z.object({
  questionId: UuidSchema,
  answer: JsonValueSchema,
})

export const ResolveConflictSchema = z.object({
  conflictId: UuidSchema,
  resolutionFactId: UuidSchema,
  resolutionNote: z.string().optional(),
})

export const CompileProfileSchema = z.object({
  purpose: CompilePurposeSchema,
})

export const ApproveProfileSchema = z.object({
  versionId: UuidSchema,
})

export const RestoreVersionSchema = z.object({
  versionId: UuidSchema,
  note: z.string().optional(),
})

export const RetryJobSchema = z.object({
  jobId: UuidSchema,
})

// ─── Quality gate evaluation input schemas ───────────────────────────────────

export const DocumentQualityInputSchema = z.object({
  sourceDocumentId: UuidSchema,
  mimeType: z.string(),
  contentHash: z.string(),
  contentText: z.string().nullable(),
  pageOrSlideCount: z.number().int().nonnegative().nullable(),
  pagesProcessed: z.number().int().nonnegative(),
  slidesProcessed: z.number().int().nonnegative(),
  parserWarnings: z.array(z.string()),
  ocrConfidence: ConfidenceSchema.nullable(),
  evidenceLocatorsPresent: z.boolean(),
  truncationDetected: z.boolean(),
})

export const FactQualityInputSchema = z.object({
  factId: UuidSchema,
  factKey: z.string(),
  value: JsonValueSchema,
  sourceId: UuidSchema,
  sourceExcerpt: z.string().nullable(),
  evidenceLocator: EvidenceLocatorSchema.nullable(),
  confidence: ConfidenceSchema,
  verificationStatus: VerificationStatusSchema,
  hasConflict: z.boolean(),
  supersedesFactId: UuidSchema.nullable(),
})

// ─── Circuit breaker evaluation input ────────────────────────────────────────

export const CircuitBreakerInputSchema = z.object({
  provider: z.string(),
  failureCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  timeoutCount: z.number().int().nonnegative(),
  quotaExhausted: z.boolean(),
  windowMinutes: z.number().positive(),
})

// ─── Job transition input ────────────────────────────────────────────────────

export const JobTransitionInputSchema = z.object({
  jobId: UuidSchema,
  currentStatus: JobStatusSchema,
  errorClass: ErrorClassSchema.nullable(),
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  lockedBy: z.string().nullable(),
  heartbeatAt: TimestampSchema.nullable(),
  stageTimeoutSeconds: z.number().int().positive().nullable(),
  now: TimestampSchema,
})
