import { z } from 'zod'

import {
  OnboardingStatus,
  SourceType,
  SourceProcessingStage,
  TerminalSourceOutcome,
  JobStatus,
  VerificationStatus,
  ProfileVersionStatus,
  StageEventStatus,
  QualityGateScope,
  QualityGateStatus,
  CircuitBreakerState,
  CompilePurpose,
  ErrorClass,
  ORDERED_PROCESSING_STAGES,
} from './types'

// ─── Extract enum values as tuples for z.enum() ─────────────────────────────

const OnboardingStatusValues = Object.values(OnboardingStatus)
const SourceTypeValues = Object.values(SourceType)
const SourceProcessingStageValues = Object.values(SourceProcessingStage)
const TerminalSourceOutcomeValues = Object.values(TerminalSourceOutcome)
const JobStatusValues = Object.values(JobStatus)
const VerificationStatusValues = Object.values(VerificationStatus)
const ProfileVersionStatusValues = Object.values(ProfileVersionStatus)
const StageEventStatusValues = Object.values(StageEventStatus)
const QualityGateScopeValues = Object.values(QualityGateScope)
const QualityGateStatusValues = Object.values(QualityGateStatus)
const CircuitBreakerStateValues = Object.values(CircuitBreakerState)
const CompilePurposeValues = Object.values(CompilePurpose)
const ErrorClassValues = Object.values(ErrorClass)

// ─── Enum schemas ────────────────────────────────────────────────────────────

export const OnboardingStatusSchema = z.enum(OnboardingStatusValues as [string, ...string[]])
export const SourceTypeSchema = z.enum(SourceTypeValues as [string, ...string[]])
export const SourceProcessingStageSchema = z.enum(SourceProcessingStageValues as [string, ...string[]])
export const TerminalSourceOutcomeSchema = z.enum(TerminalSourceOutcomeValues as [string, ...string[]])
export const JobStatusSchema = z.enum(JobStatusValues as [string, ...string[]])
export const VerificationStatusSchema = z.enum(VerificationStatusValues as [string, ...string[]])
export const ProfileVersionStatusSchema = z.enum(ProfileVersionStatusValues as [string, ...string[]])
export const StageEventStatusSchema = z.enum(StageEventStatusValues as [string, ...string[]])
export const QualityGateScopeSchema = z.enum(QualityGateScopeValues as [string, ...string[]])
export const QualityGateStatusSchema = z.enum(QualityGateStatusValues as [string, ...string[]])
export const CircuitBreakerStateSchema = z.enum(CircuitBreakerStateValues as [string, ...string[]])
export const CompilePurposeSchema = z.enum(CompilePurposeValues as [string, ...string[]])
export const ErrorClassSchema = z.enum(ErrorClassValues as [string, ...string[]])

// ─── Common primitives ───────────────────────────────────────────────────────

export const UuidSchema = z.string().uuid()
export const TimestampSchema = z.string().datetime()
export const ConfidenceSchema = z.number().min(0).max(1)

export const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
)

// ─── Evidence locator ────────────────────────────────────────────────────────

export const EvidenceLocatorSchema = z.object({
  url: z.string().url().optional(),
  page: z.number().int().nonnegative().optional(),
  slide: z.number().int().nonnegative().optional(),
  element: z.string().optional(),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
})

// ─── Retry policy ────────────────────────────────────────────────────────────

export const RetryPolicySchema = z.object({
  backoffBaseMs: z.number().int().positive(),
  backoffFactor: z.number().positive(),
  jitterPercent: z.number().min(0).max(1),
  backoffCapMs: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  retryableClasses: z.array(z.string()),
})

// ─── Entity schemas ──────────────────────────────────────────────────────────

export const BusinessSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  name: z.string().min(1),
  websiteUrl: z.string().url().nullable(),
  status: z.string(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
})

export const OnboardingSessionSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  status: OnboardingStatusSchema,
  currentStep: z.string().nullable(),
  startedBy: UuidSchema,
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
  error: JsonValueSchema.nullable(),
})

export const ContextSourceSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  sourceType: SourceTypeSchema,
  sourceName: z.string().min(1),
  externalReference: z.string().nullable(),
  status: z.string(),
  currentStage: SourceProcessingStageSchema.nullable(),
  terminalOutcome: TerminalSourceOutcomeSchema.nullable(),
  metadata: z.record(z.string(), JsonValueSchema),
  collectedAt: TimestampSchema,
})

export const SourceDocumentSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  sourceId: UuidSchema,
  url: z.string().url().nullable(),
  title: z.string().nullable(),
  documentType: z.string().nullable(),
  mimeType: z.string().nullable(),
  fileName: z.string().nullable(),
  fileSizeBytes: z.number().int().nonnegative().nullable(),
  contentText: z.string().nullable(),
  storagePath: z.string().nullable(),
  contentHash: z.string().min(1),
  httpStatus: z.number().int().nullable(),
  pageOrSlideCount: z.number().int().nonnegative().nullable(),
  parserName: z.string().nullable(),
  parserVersion: z.string().nullable(),
  effectiveAt: TimestampSchema.nullable(),
  supersedesDocumentId: UuidSchema.nullable(),
  metadata: z.record(z.string(), JsonValueSchema),
  retrievedAt: TimestampSchema,
})

export const ContextFactSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  factKey: z.string().min(1),
  value: JsonValueSchema,
  sourceId: UuidSchema,
  sourceDocumentId: UuidSchema.nullable(),
  sourceExcerpt: z.string().nullable(),
  evidenceLocator: EvidenceLocatorSchema.nullable(),
  confidence: ConfidenceSchema,
  verificationStatus: VerificationStatusSchema,
  supersedesFactId: UuidSchema.nullable(),
  validFrom: TimestampSchema,
  validTo: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  createdBy: z.string().min(1),
})

export const ContextConflictSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  factKey: z.string().min(1),
  factIds: z.array(UuidSchema).min(2),
  status: z.enum(['open', 'resolved']),
  resolutionFactId: UuidSchema.nullable(),
  resolutionNote: z.string().nullable(),
  resolvedBy: UuidSchema.nullable(),
  createdAt: TimestampSchema,
  resolvedAt: TimestampSchema.nullable(),
})

export const OnboardingQuestionSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  sessionId: UuidSchema,
  businessId: UuidSchema,
  factKey: z.string().min(1),
  questionType: z.string().min(1),
  question: z.string().min(1),
  options: JsonValueSchema.nullable(),
  reason: z.string().min(1),
  priority: z.number().int(),
  status: z.enum(['open', 'answered', 'dismissed']),
  answer: JsonValueSchema.nullable(),
  answeredBy: UuidSchema.nullable(),
  answeredAt: TimestampSchema.nullable(),
})

export const BusinessProfileVersionSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  version: z.number().int().positive(),
  profile: z.record(z.string(), JsonValueSchema),
  profileMarkdown: z.string().nullable(),
  status: ProfileVersionStatusSchema,
  changeSummary: z.string().nullable(),
  createdBy: UuidSchema,
  createdAt: TimestampSchema,
  approvedBy: UuidSchema.nullable(),
  approvedAt: TimestampSchema.nullable(),
})

export const ContextJobSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  sessionId: UuidSchema.nullable(),
  jobType: z.string().min(1),
  status: JobStatusSchema,
  attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  idempotencyKey: z.string().min(1),
  stage: SourceProcessingStageSchema.nullable(),
  input: z.record(z.string(), JsonValueSchema),
  output: z.record(z.string(), JsonValueSchema).nullable(),
  error: JsonValueSchema.nullable(),
  errorClass: z.string().nullable(),
  retryPolicy: z.record(z.string(), JsonValueSchema),
  nextRunAt: TimestampSchema.nullable(),
  lockedBy: z.string().nullable(),
  lockedAt: TimestampSchema.nullable(),
  heartbeatAt: TimestampSchema.nullable(),
  stageTimeoutSeconds: z.number().int().positive().nullable(),
  createdAt: TimestampSchema,
  startedAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
})

export const ProcessingRunSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  sourceId: UuidSchema,
  jobId: UuidSchema.nullable(),
  pipelineType: z.string().min(1),
  status: z.string(),
  currentStage: SourceProcessingStageSchema,
  terminalOutcome: TerminalSourceOutcomeSchema.nullable(),
  attemptCount: z.number().int().nonnegative(),
  pagesProcessed: z.number().int().nonnegative(),
  slidesProcessed: z.number().int().nonnegative(),
  documentsCreated: z.number().int().nonnegative(),
  factsExtracted: z.number().int().nonnegative(),
  warningsCount: z.number().int().nonnegative(),
  creditsConsumed: z.number().nonnegative(),
  qualitySummary: z.record(z.string(), JsonValueSchema),
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
})

export const StageEventSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  runId: UuidSchema,
  jobId: UuidSchema.nullable(),
  sourceId: UuidSchema,
  stage: SourceProcessingStageSchema,
  status: StageEventStatusSchema,
  attempt: z.number().int().positive(),
  workerId: z.string().nullable(),
  provider: z.string().nullable(),
  providerRequestId: z.string().nullable(),
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  pagesProcessed: z.number().int().nonnegative(),
  slidesProcessed: z.number().int().nonnegative(),
  bytesProcessed: z.number().int().nonnegative(),
  documentsCreated: z.number().int().nonnegative(),
  factsExtracted: z.number().int().nonnegative(),
  warningsCount: z.number().int().nonnegative(),
  creditsConsumed: z.number().nonnegative(),
  errorClass: z.string().nullable(),
  error: JsonValueSchema.nullable(),
  metadata: z.record(z.string(), JsonValueSchema),
})

export const QualityGateResultSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  runId: UuidSchema.nullable(),
  sourceId: UuidSchema.nullable(),
  sourceDocumentId: UuidSchema.nullable(),
  factId: UuidSchema.nullable(),
  gateScope: QualityGateScopeSchema,
  gateName: z.string().min(1),
  status: QualityGateStatusSchema,
  measuredValue: JsonValueSchema.nullable(),
  threshold: JsonValueSchema.nullable(),
  reason: z.string().nullable(),
  createdAt: TimestampSchema,
})

export const CircuitBreakerSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema.nullable(),
  provider: z.string().min(1),
  state: CircuitBreakerStateSchema,
  failureCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  timeoutCount: z.number().int().nonnegative(),
  quotaExhausted: z.boolean(),
  openedAt: TimestampSchema.nullable(),
  halfOpenAfter: TimestampSchema.nullable(),
  lastFailureAt: TimestampSchema.nullable(),
  lastSuccessAt: TimestampSchema.nullable(),
  metadata: z.record(z.string(), JsonValueSchema),
})

export const AuditLogSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  businessId: UuidSchema,
  actorId: UuidSchema.nullable(),
  actorType: z.enum(['user', 'service', 'worker']),
  eventType: z.string().min(1),
  entityType: z.string().min(1),
  entityId: UuidSchema,
  before: z.record(z.string(), JsonValueSchema).nullable(),
  after: z.record(z.string(), JsonValueSchema).nullable(),
  createdAt: TimestampSchema,
})

// ─── Request schemas ─────────────────────────────────────────────────────────

export const CreateBusinessSchema = z.object({
  name: z.string().min(1).max(256),
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

// ─── Extraction input/output schemas ─────────────────────────────────────────

export const ExtractionInputSchema = z.object({
  sourceDocumentId: UuidSchema,
  sourceId: UuidSchema,
  businessId: UuidSchema,
  contentText: z.string(),
  sourceType: SourceTypeSchema,
  parserName: z.string(),
})

export const ExtractedFactSchema = z.object({
  factKey: z.string().min(1),
  value: JsonValueSchema,
  confidence: ConfidenceSchema,
  sourceExcerpt: z.string().nullable(),
  evidenceLocator: EvidenceLocatorSchema.nullable(),
})

export const ExtractionOutputSchema = z.object({
  facts: z.array(ExtractedFactSchema),
  warnings: z.array(z.string()),
  conflicts: z.array(
    z.object({
      factKey: z.string(),
      values: z.array(JsonValueSchema),
    }),
  ),
})

// ─── Profile section schemas ─────────────────────────────────────────────────

export const ProfileSectionSchema = z.record(z.string(), JsonValueSchema)

export const BusinessProfileSchema = z.object({
  business: ProfileSectionSchema,
  offers: ProfileSectionSchema,
  customers: ProfileSectionSchema,
  conversion_journey: ProfileSectionSchema,
  economics: ProfileSectionSchema,
  brand: ProfileSectionSchema,
  creative_capacity: ProfileSectionSchema,
  measurement: ProfileSectionSchema,
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

// ─── Processing stage order validation ───────────────────────────────────────

export const StageOrderSchema = z.object({
  current: SourceProcessingStageSchema,
  next: SourceProcessingStageSchema,
})

export function isValidStageTransition(
  current: SourceProcessingStage,
  next: SourceProcessingStage,
): boolean {
  const currentIdx = ORDERED_PROCESSING_STAGES.indexOf(current)
  const nextIdx = ORDERED_PROCESSING_STAGES.indexOf(next)
  if (currentIdx === -1 || nextIdx === -1) return false
  return nextIdx === currentIdx + 1
}

export function isTerminalStage(stage: SourceProcessingStage): boolean {
  return stage === SourceProcessingStage.COMPLETED
}
