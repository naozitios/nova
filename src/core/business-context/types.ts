// ─── Enums ───────────────────────────────────────────────────────────────────

export const OnboardingStatus = {
  CREATED: 'created',
  SCANNING: 'scanning',
  EXTRACTING: 'extracting',
  AWAITING_REVIEW: 'awaiting_review',
  AWAITING_ANSWERS: 'awaiting_answers',
  READY_FOR_APPROVAL: 'ready_for_approval',
  APPROVED: 'approved',
  FAILED: 'failed',
} as const

export type OnboardingStatus =
  (typeof OnboardingStatus)[keyof typeof OnboardingStatus]

export const SourceType = {
  WEBSITE: 'website',
  BRAND_DECK: 'brand_deck',
  BRAND_PLAYBOOK: 'brand_playbook',
  PRODUCT_DOCUMENT: 'product_document',
  CAMPAIGN_BRIEF: 'campaign_brief',
  RESEARCH_DOCUMENT: 'research_document',
  USER_ANSWER: 'user_answer',
  META: 'meta',
  SYSTEM_INFERENCE: 'system_inference',
} as const

export type SourceType = (typeof SourceType)[keyof typeof SourceType]

export const SourceProcessingStage = {
  REGISTERED: 'registered',
  QUEUED: 'queued',
  ACQUIRING: 'acquiring',
  STORED: 'stored',
  PARSING: 'parsing',
  NORMALIZING: 'normalizing',
  EXTRACTING: 'extracting',
  RECONCILING: 'reconciling',
  QUALITY_CHECKING: 'quality_checking',
  COMPLETED: 'completed',
} as const

export type SourceProcessingStage =
  (typeof SourceProcessingStage)[keyof typeof SourceProcessingStage]

export const TerminalSourceOutcome = {
  PROCESSED: 'processed',
  PROCESSED_WITH_WARNINGS: 'processed_with_warnings',
  BLOCKED_NEEDS_USER_ACTION: 'blocked_needs_user_action',
  FAILED_PERMANENT: 'failed_permanent',
  ARCHIVED: 'archived',
} as const

export type TerminalSourceOutcome =
  (typeof TerminalSourceOutcome)[keyof typeof TerminalSourceOutcome]

export const JobStatus = {
  QUEUED: 'queued',
  SCHEDULED: 'scheduled',
  RUNNING: 'running',
  RETRY_WAITING: 'retry_waiting',
  SUCCEEDED: 'succeeded',
  FAILED_RETRYABLE: 'failed_retryable',
  FAILED_PERMANENT: 'failed_permanent',
  STALLED: 'stalled',
  DEAD_LETTERED: 'dead_lettered',
  CANCELLED: 'cancelled',
} as const

export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus]

export const VerificationStatus = {
  EXTRACTED: 'extracted',
  INFERRED: 'inferred',
  USER_VERIFIED: 'user_verified',
  REJECTED: 'rejected',
  SUPERSEDED: 'superseded',
} as const

export type VerificationStatus =
  (typeof VerificationStatus)[keyof typeof VerificationStatus]

export const ProfileVersionStatus = {
  DRAFT: 'draft',
  CURRENT: 'current',
  SUPERSEDED: 'superseded',
  RESTORED_SNAPSHOT: 'restored_snapshot',
} as const

export type ProfileVersionStatus =
  (typeof ProfileVersionStatus)[keyof typeof ProfileVersionStatus]

export const StageEventStatus = {
  STARTED: 'started',
  SUCCEEDED: 'succeeded',
  WARNED: 'warned',
  FAILED_RETRYABLE: 'failed_retryable',
  FAILED_PERMANENT: 'failed_permanent',
  SKIPPED: 'skipped',
} as const

export type StageEventStatus =
  (typeof StageEventStatus)[keyof typeof StageEventStatus]

export const QualityGateScope = {
  DOCUMENT: 'document',
  FACT: 'fact',
} as const

export type QualityGateScope =
  (typeof QualityGateScope)[keyof typeof QualityGateScope]

export const QualityGateStatus = {
  PASSED: 'passed',
  WARNING: 'warning',
  FAILED_BLOCKING: 'failed_blocking',
  FAILED_NON_BLOCKING: 'failed_non_blocking',
} as const

export type QualityGateStatus =
  (typeof QualityGateStatus)[keyof typeof QualityGateStatus]

export const CircuitBreakerState = {
  CLOSED: 'closed',
  OPEN: 'open',
  HALF_OPEN: 'half_open',
} as const

export type CircuitBreakerState =
  (typeof CircuitBreakerState)[keyof typeof CircuitBreakerState]

export const CompilePurpose = {
  APPROVAL: 'approval',
  RECONCILIATION: 'reconciliation',
  RESEARCH: 'research',
  INVENTORY: 'inventory',
} as const

export type CompilePurpose =
  (typeof CompilePurpose)[keyof typeof CompilePurpose]

// ─── Task-specific context purposes (FR-030) ────────────────────────────────

export const ContextPurpose = {
  CAMPAIGN_SETUP: 'campaign_setup',
  PERFORMANCE_ANALYSIS: 'performance_analysis',
  OPTIMIZATION: 'optimization',
  HYPOTHESIS_GENERATION: 'hypothesis_generation',
  CREATIVE_BRIEF: 'creative_brief',
  TRACKING_AUDIT: 'tracking_audit',
} as const

export type ContextPurpose =
  (typeof ContextPurpose)[keyof typeof ContextPurpose]

/** Allowed profile sections per context purpose (FR-030). */
export const PURPOSE_SECTIONS: Record<ContextPurpose, readonly ProfileSectionName[]> =
  {
    [ContextPurpose.CAMPAIGN_SETUP]: [
      'offers',
      'customers',
      'brand',
      'creative_capacity',
    ],
    [ContextPurpose.PERFORMANCE_ANALYSIS]: [
      'economics',
      'measurement',
      'offers',
    ],
    [ContextPurpose.OPTIMIZATION]: [
      'offers',
      'customers',
      'conversion_journey',
    ],
    [ContextPurpose.HYPOTHESIS_GENERATION]: [
      'customers',
      'brand',
      'offers',
    ],
    [ContextPurpose.CREATIVE_BRIEF]: [
      'offers',
      'customers',
      'brand',
      'creative_capacity',
      'conversion_journey',
    ],
    [ContextPurpose.TRACKING_AUDIT]: ['measurement', 'economics'],
  }

// ─── JSON Value type ─────────────────────────────────────────────────────────

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

// ─── Audit ───────────────────────────────────────────────────────────────────

export type AuditActorType = 'user' | 'service' | 'worker'

// ─── Job error classes ───────────────────────────────────────────────────────

export const ErrorClass = {
  VALIDATION: 'validation',
  AUTH: 'auth',
  SSRF: 'ssrf',
  MALWARE: 'malware',
  UNSUPPORTED_FILE: 'unsupported_file',
  PROVIDER_TIMEOUT: 'provider_timeout',
  PROVIDER_5XX: 'provider_5xx',
  QUOTA_EXHAUSTED: 'quota_exhausted',
  SCHEMA_CONTRACT: 'schema_contract',
  WORKER_OOM: 'worker_oom',
  BUDGET_EXCEEDED: 'budget_exceeded',
  UNKNOWN: 'unknown',
} as const

export type ErrorClass = (typeof ErrorClass)[keyof typeof ErrorClass]

// ─── Retryable error classes (subset) ────────────────────────────────────────

export type RetryableErrorClass =
  | 'provider_timeout'
  | 'provider_5xx'
  | 'worker_oom'
  | 'network_transient'
  | 'rate_limited'

export type NonRetryableErrorClass =
  | 'validation'
  | 'auth'
  | 'ssrf'
  | 'malware'
  | 'unsupported_file'
  | 'budget_exceeded'
  | 'schema_contract'
  | 'quota_exhausted'

// ─── Entity interfaces ───────────────────────────────────────────────────────

export interface Business {
  id: string
  workspaceId: string
  name: string
  websiteUrl: string | null
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface OnboardingSession {
  id: string
  workspaceId: string
  businessId: string
  status: OnboardingStatus
  currentStep: string | null
  startedBy: string
  startedAt: Date
  completedAt: Date | null
  error: JsonValue | null
}

export interface ContextSource {
  id: string
  workspaceId: string
  businessId: string
  sourceType: SourceType
  sourceName: string
  externalReference: string | null
  status: string
  currentStage: SourceProcessingStage | null
  terminalOutcome: TerminalSourceOutcome | null
  metadata: Record<string, JsonValue>
  collectedAt: Date
}

export interface SourceDocument {
  id: string
  workspaceId: string
  businessId: string
  sourceId: string
  url: string | null
  title: string | null
  documentType: string | null
  mimeType: string | null
  fileName: string | null
  fileSizeBytes: number | null
  contentText: string | null
  storagePath: string | null
  contentHash: string
  httpStatus: number | null
  pageOrSlideCount: number | null
  parserName: string | null
  parserVersion: string | null
  effectiveAt: Date | null
  supersedesDocumentId: string | null
  metadata: Record<string, JsonValue>
  retrievedAt: Date
}

export interface ContextFact {
  id: string
  workspaceId: string
  businessId: string
  factKey: string
  value: JsonValue
  sourceId: string
  sourceDocumentId: string | null
  sourceExcerpt: string | null
  evidenceLocator: JsonValue | null
  confidence: number
  verificationStatus: VerificationStatus
  supersedesFactId: string | null
  validFrom: Date
  validTo: Date | null
  createdAt: Date
  createdBy: string
}

export interface ContextConflict {
  id: string
  workspaceId: string
  businessId: string
  factKey: string
  factIds: string[]
  status: 'open' | 'resolved'
  resolutionFactId: string | null
  resolutionNote: string | null
  resolvedBy: string | null
  createdAt: Date
  resolvedAt: Date | null
}

export interface OnboardingQuestion {
  id: string
  workspaceId: string
  sessionId: string
  businessId: string
  factKey: string
  questionType: string
  question: string
  options: JsonValue | null
  reason: string
  priority: number
  status: 'open' | 'answered' | 'dismissed'
  answer: JsonValue | null
  answeredBy: string | null
  answeredAt: Date | null
}

export interface BusinessProfileVersion {
  id: string
  workspaceId: string
  businessId: string
  version: number
  profile: Record<string, JsonValue>
  profileMarkdown: string | null
  status: ProfileVersionStatus
  changeSummary: string | null
  createdBy: string
  createdAt: Date
  approvedBy: string | null
  approvedAt: Date | null
}

export interface ContextJob {
  id: string
  workspaceId: string
  businessId: string
  sessionId: string | null
  jobType: string
  status: JobStatus
  attemptCount: number
  maxAttempts: number
  idempotencyKey: string
  stage: SourceProcessingStage | null
  input: Record<string, JsonValue>
  output: Record<string, JsonValue> | null
  error: JsonValue | null
  errorClass: string | null
  retryPolicy: Record<string, JsonValue>
  nextRunAt: Date | null
  lockedBy: string | null
  lockedAt: Date | null
  heartbeatAt: Date | null
  stageTimeoutSeconds: number | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

export interface ProcessingRun {
  id: string
  workspaceId: string
  businessId: string
  sourceId: string
  jobId: string | null
  pipelineType: string
  status: string
  currentStage: SourceProcessingStage
  terminalOutcome: TerminalSourceOutcome | null
  attemptCount: number
  pagesProcessed: number
  slidesProcessed: number
  documentsCreated: number
  factsExtracted: number
  warningsCount: number
  creditsConsumed: number
  qualitySummary: Record<string, JsonValue>
  startedAt: Date
  completedAt: Date | null
}

export interface StageEvent {
  id: string
  workspaceId: string
  businessId: string
  runId: string
  jobId: string | null
  sourceId: string
  stage: SourceProcessingStage
  status: StageEventStatus
  attempt: number
  workerId: string | null
  provider: string | null
  providerRequestId: string | null
  startedAt: Date
  completedAt: Date | null
  durationMs: number | null
  pagesProcessed: number
  slidesProcessed: number
  bytesProcessed: number
  documentsCreated: number
  factsExtracted: number
  warningsCount: number
  creditsConsumed: number
  errorClass: string | null
  error: JsonValue | null
  metadata: Record<string, JsonValue>
}

export interface QualityGateResult {
  id: string
  workspaceId: string
  businessId: string
  runId: string | null
  sourceId: string | null
  sourceDocumentId: string | null
  factId: string | null
  gateScope: QualityGateScope
  gateName: string
  status: QualityGateStatus
  measuredValue: JsonValue | null
  threshold: JsonValue | null
  reason: string | null
  createdAt: Date
}

export interface CircuitBreaker {
  id: string
  workspaceId: string | null
  provider: string
  state: CircuitBreakerState
  failureCount: number
  successCount: number
  timeoutCount: number
  quotaExhausted: boolean
  openedAt: Date | null
  halfOpenAfter: Date | null
  lastFailureAt: Date | null
  lastSuccessAt: Date | null
  metadata: Record<string, JsonValue>
}

export interface AuditLog {
  id: string
  workspaceId: string
  businessId: string
  actorId: string | null
  actorType: AuditActorType
  eventType: string
  entityType: string
  entityId: string
  before: Record<string, JsonValue> | null
  after: Record<string, JsonValue> | null
  createdAt: Date
}

// ─── Service result types ────────────────────────────────────────────────────

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError }

export interface ServiceError {
  code: string
  message: string
  details?: Record<string, JsonValue>
}

// ─── Retry policy ────────────────────────────────────────────────────────────

export interface RetryPolicy {
  backoffBaseMs: number
  backoffFactor: number
  jitterPercent: number
  backoffCapMs: number
  maxAttempts: number
  retryableClasses: string[]
}

// ─── Evidence locator ────────────────────────────────────────────────────────

export interface EvidenceLocator {
  url?: string
  page?: number
  slide?: number
  element?: string
  boundingBox?: { x: number; y: number; width: number; height: number }
}

// ─── Source status values (high-level user-facing) ──────────────────────────

export type SourceStatus =
  | 'registered'
  | 'queued'
  | 'processing'
  | 'processed'
  | 'processed_with_warnings'
  | 'blocked_needs_user_action'
  | 'failed_permanent'
  | 'archived'

// ─── Processing run status ──────────────────────────────────────────────────

export type ProcessingRunStatus =
  | 'running'
  | 'succeeded'
  | 'succeeded_with_warnings'
  | 'blocked'
  | 'failed'
  | 'dead_lettered'
  | 'cancelled'

// ─── Pipeline type ──────────────────────────────────────────────────────────

export type PipelineType = 'website' | 'upload' | 'meta' | 'manual'

// ─── Provider identifiers ───────────────────────────────────────────────────

export type Provider =
  | 'firecrawl'
  | 'meta'
  | 'llm_extraction'
  | 'native_parser'
  | 'paddleocr'

// ─── Workspace role ─────────────────────────────────────────────────────────

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'

// ─── Required profile sections ──────────────────────────────────────────────

export const REQUIRED_PROFILE_SECTIONS = [
  'business',
  'offers',
  'customers',
  'conversion_journey',
  'economics',
  'brand',
  'creative_capacity',
  'measurement',
] as const

export type ProfileSectionName =
  (typeof REQUIRED_PROFILE_SECTIONS)[number]

// ─── Ordered processing stages ──────────────────────────────────────────────

export const ORDERED_PROCESSING_STAGES: readonly SourceProcessingStage[] = [
  SourceProcessingStage.REGISTERED,
  SourceProcessingStage.QUEUED,
  SourceProcessingStage.ACQUIRING,
  SourceProcessingStage.STORED,
  SourceProcessingStage.PARSING,
  SourceProcessingStage.NORMALIZING,
  SourceProcessingStage.EXTRACTING,
  SourceProcessingStage.RECONCILING,
  SourceProcessingStage.QUALITY_CHECKING,
  SourceProcessingStage.COMPLETED,
] as const
