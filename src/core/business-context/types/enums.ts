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
  CAMPAIGN_SETUP: 'campaign_setup',
  PERFORMANCE_ANALYSIS: 'performance_analysis',
  OPTIMIZATION: 'optimization',
  HYPOTHESIS_GENERATION: 'hypothesis_generation',
  CREATIVE_BRIEF: 'creative_brief',
  TRACKING_AUDIT: 'tracking_audit',
} as const

export type CompilePurpose =
  (typeof CompilePurpose)[keyof typeof CompilePurpose]

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

export type SourceStatus =
  | 'registered'
  | 'queued'
  | 'processing'
  | 'processed'
  | 'processed_with_warnings'
  | 'blocked_needs_user_action'
  | 'failed_permanent'
  | 'archived'

export type ProcessingRunStatus =
  | 'running'
  | 'succeeded'
  | 'succeeded_with_warnings'
  | 'blocked'
  | 'failed'
  | 'dead_lettered'
  | 'cancelled'

export type PipelineType = 'website' | 'upload' | 'meta' | 'manual'

export type Provider =
  | 'firecrawl'
  | 'meta'
  | 'llm_extraction'
  | 'native_parser'
  | 'paddleocr'

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer'
