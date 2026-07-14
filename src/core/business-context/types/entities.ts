import type {
  CircuitBreakerState,
  JobStatus,
  OnboardingStatus,
  ProfileVersionStatus,
  QualityGateScope,
  QualityGateStatus,
  SourceProcessingStage,
  SourceType,
  StageEventStatus,
  TerminalSourceOutcome,
  VerificationStatus,
} from './enums'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface EvidenceLocator {
  url?: string
  page?: number
  slide?: number
  element?: string
  boundingBox?: { x: number; y: number; width: number; height: number }
}

export type AuditActorType = 'user' | 'service' | 'worker'

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

