import type {
  AuditLog,
  Business,
  BusinessProfileVersion,
  CircuitBreaker,
  ContextConflict,
  ContextFact,
  ContextJob,
  ContextSource,
  OnboardingQuestion,
  OnboardingSession,
  ProcessingRun,
  QualityGateResult,
  ServiceResult,
  SourceDocument,
  StageEvent,
} from './types'

// ─── Filter types ────────────────────────────────────────────────────────────

export interface PaginationParams {
  limit: number
  offset: number
}

export interface BusinessFilter {
  workspaceId: string
  status?: string
}

export interface OnboardingFilter {
  workspaceId: string
  businessId?: string
  status?: string
}

export interface SourceFilter {
  workspaceId: string
  businessId: string
  sourceType?: string
  status?: string
  currentStage?: string
}

export interface SourceDocumentFilter {
  workspaceId: string
  businessId: string
  sourceId?: string
  contentHash?: string
}

export interface FactFilter {
  workspaceId: string
  businessId: string
  factKey?: string
  sourceId?: string
  active?: boolean
}

export interface ConflictFilter {
  workspaceId: string
  businessId: string
  status?: 'open' | 'resolved'
  factKey?: string
}

export interface QuestionFilter {
  workspaceId: string
  sessionId: string
  status?: 'open' | 'answered' | 'dismissed'
}

export interface ProfileVersionFilter {
  workspaceId: string
  businessId: string
  status?: string
}

export interface JobFilter {
  workspaceId: string
  businessId: string
  jobType?: string
  status?: string
}

export interface RunnableJobFilter {
  status: string
  jobType?: string
  lockedByIsNull?: boolean
  heartbeatExpired?: Date
}

export interface ProcessingRunFilter {
  workspaceId: string
  businessId: string
  sourceId?: string
  jobId?: string
  status?: string
}

export interface StageEventFilter {
  workspaceId: string
  businessId: string
  runId?: string
  jobId?: string
  sourceId?: string
  stage?: string
}

export interface QualityGateFilter {
  workspaceId: string
  businessId: string
  runId?: string
  sourceDocumentId?: string
  factId?: string
  gateScope?: string
  status?: string
}

export interface CircuitBreakerFilter {
  workspaceId?: string | null
  provider: string
  state?: string
}

export interface AuditLogFilter {
  workspaceId: string
  businessId?: string
  entityType?: string
  entityId?: string
  createdAfter?: Date
  createdBefore?: Date
}

// ─── Sort types ──────────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc'

export interface SortParams<T extends string = string> {
  field: T
  direction: SortDirection
}

// ─── Repository port ─────────────────────────────────────────────────────────

export interface RepositoryPort {
  // ── Businesses ───────────────────────────────────────────────────────────
  createBusiness(
    data: Omit<Business, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<Business>>

  getBusiness(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<Business | null>>

  listBusinesses(
    filter: BusinessFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'name' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<{ items: Business[]; total: number }>>

  updateBusiness(
    workspaceId: string,
    businessId: string,
    data: Partial<Pick<Business, 'name' | 'websiteUrl' | 'status'>>,
  ): Promise<ServiceResult<Business>>

  // ── Onboarding sessions ──────────────────────────────────────────────────
  createOnboardingSession(
    data: Omit<OnboardingSession, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<OnboardingSession>>

  getOnboardingSession(
    workspaceId: string,
    sessionId: string,
  ): Promise<ServiceResult<OnboardingSession | null>>

  listOnboardingSessions(
    filter: OnboardingFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: OnboardingSession[]; total: number }>>

  updateOnboardingSession(
    workspaceId: string,
    sessionId: string,
    data: Partial<
      Pick<
        OnboardingSession,
        'status' | 'currentStep' | 'completedAt' | 'error'
      >
    >,
  ): Promise<ServiceResult<OnboardingSession>>

  // ── Context sources ──────────────────────────────────────────────────────
  createContextSource(
    data: Omit<ContextSource, 'id'>,
  ): Promise<ServiceResult<ContextSource>>

  getContextSource(
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextSource | null>>

  listContextSources(
    filter: SourceFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextSource[]; total: number }>>

  updateContextSource(
    workspaceId: string,
    sourceId: string,
    data: Partial<
      Pick<
        ContextSource,
        | 'status'
        | 'currentStage'
        | 'terminalOutcome'
        | 'metadata'
        | 'sourceName'
      >
    >,
  ): Promise<ServiceResult<ContextSource>>

  // ── Source documents ─────────────────────────────────────────────────────
  createSourceDocument(
    data: Omit<SourceDocument, 'id'>,
  ): Promise<ServiceResult<SourceDocument>>

  getSourceDocument(
    workspaceId: string,
    documentId: string,
  ): Promise<ServiceResult<SourceDocument | null>>

  listSourceDocuments(
    filter: SourceDocumentFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: SourceDocument[]; total: number }>>

  getSourceDocumentByHash(
    businessId: string,
    contentHash: string,
  ): Promise<ServiceResult<SourceDocument | null>>

  updateSourceDocument(
    workspaceId: string,
    documentId: string,
    data: Partial<Pick<SourceDocument, 'metadata' | 'storagePath'>>,
  ): Promise<ServiceResult<SourceDocument>>

  // ── Context facts ────────────────────────────────────────────────────────
  createContextFact(
    data: Omit<ContextFact, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextFact>>

  getContextFact(
    workspaceId: string,
    factId: string,
  ): Promise<ServiceResult<ContextFact | null>>

  listContextFacts(
    filter: FactFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextFact[]; total: number }>>

  updateContextFact(
    workspaceId: string,
    factId: string,
    data: Partial<
      Pick<
        ContextFact,
        | 'value'
        | 'verificationStatus'
        | 'supersedesFactId'
        | 'validTo'
        | 'confidence'
      >
    >,
  ): Promise<ServiceResult<ContextFact>>

  // ── Context conflicts ────────────────────────────────────────────────────
  createContextConflict(
    data: Omit<ContextConflict, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextConflict>>

  getContextConflict(
    workspaceId: string,
    conflictId: string,
  ): Promise<ServiceResult<ContextConflict | null>>

  listContextConflicts(
    filter: ConflictFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextConflict[]; total: number }>>

  resolveContextConflict(
    workspaceId: string,
    conflictId: string,
    resolutionFactId: string,
    resolvedBy: string,
    note?: string,
  ): Promise<ServiceResult<ContextConflict>>

  // ── Onboarding questions ─────────────────────────────────────────────────
  createOnboardingQuestion(
    data: Omit<OnboardingQuestion, 'id'>,
  ): Promise<ServiceResult<OnboardingQuestion>>

  getOnboardingQuestion(
    workspaceId: string,
    questionId: string,
  ): Promise<ServiceResult<OnboardingQuestion | null>>

  listOnboardingQuestions(
    filter: QuestionFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: OnboardingQuestion[]; total: number }>>

  answerOnboardingQuestion(
    workspaceId: string,
    questionId: string,
    answer: unknown,
    answeredBy: string,
  ): Promise<ServiceResult<OnboardingQuestion>>

  // ── Business profile versions ────────────────────────────────────────────
  createProfileVersion(
    data: Omit<BusinessProfileVersion, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<BusinessProfileVersion>>

  getProfileVersion(
    workspaceId: string,
    versionId: string,
  ): Promise<ServiceResult<BusinessProfileVersion | null>>

  listProfileVersions(
    filter: ProfileVersionFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: BusinessProfileVersion[]; total: number }>>

  getCurrentProfileVersion(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<BusinessProfileVersion | null>>

  supersedeProfileVersions(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<void>>

  approveProfileVersion(
    workspaceId: string,
    versionId: string,
    approvedBy: string,
  ): Promise<ServiceResult<BusinessProfileVersion>>

  restoreProfileVersion(
    workspaceId: string,
    versionId: string,
    restoredBy: string,
    note?: string,
  ): Promise<ServiceResult<BusinessProfileVersion>>

  // ── Context jobs ─────────────────────────────────────────────────────────
  createContextJob(
    data: Omit<ContextJob, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextJob>>

  getContextJob(
    workspaceId: string,
    jobId: string,
  ): Promise<ServiceResult<ContextJob | null>>

  getContextJobByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<ServiceResult<ContextJob | null>>

  listContextJobs(
    filter: JobFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextJob[]; total: number }>>

  claimRunnableJobs(
    filter: RunnableJobFilter,
    workerId: string,
    limit: number,
  ): Promise<ServiceResult<ContextJob[]>>

  updateContextJob(
    workspaceId: string,
    jobId: string,
    data: Partial<
      Pick<
        ContextJob,
        | 'status'
        | 'attemptCount'
        | 'output'
        | 'error'
        | 'errorClass'
        | 'nextRunAt'
        | 'lockedBy'
        | 'lockedAt'
        | 'heartbeatAt'
        | 'startedAt'
        | 'completedAt'
      >
    >,
  ): Promise<ServiceResult<ContextJob>>

  // ── Processing runs ──────────────────────────────────────────────────────
  createProcessingRun(
    data: Omit<ProcessingRun, 'id'>,
  ): Promise<ServiceResult<ProcessingRun>>

  getProcessingRun(
    workspaceId: string,
    runId: string,
  ): Promise<ServiceResult<ProcessingRun | null>>

  listProcessingRuns(
    filter: ProcessingRunFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'startedAt'>,
  ): Promise<ServiceResult<{ items: ProcessingRun[]; total: number }>>

  updateProcessingRun(
    workspaceId: string,
    runId: string,
    data: Partial<
      Pick<
        ProcessingRun,
        | 'status'
        | 'currentStage'
        | 'terminalOutcome'
        | 'attemptCount'
        | 'pagesProcessed'
        | 'slidesProcessed'
        | 'documentsCreated'
        | 'factsExtracted'
        | 'warningsCount'
        | 'creditsConsumed'
        | 'qualitySummary'
        | 'completedAt'
      >
    >,
  ): Promise<ServiceResult<ProcessingRun>>

  // ── Stage events ─────────────────────────────────────────────────────────
  createStageEvent(
    data: Omit<StageEvent, 'id'>,
  ): Promise<ServiceResult<StageEvent>>

  listStageEvents(
    filter: StageEventFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: StageEvent[]; total: number }>>

  // ── Quality gate results ─────────────────────────────────────────────────
  createQualityGateResult(
    data: Omit<QualityGateResult, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<QualityGateResult>>

  listQualityGateResults(
    filter: QualityGateFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: QualityGateResult[]; total: number }>>

  // ── Circuit breakers ─────────────────────────────────────────────────────
  getCircuitBreaker(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker | null>>

  upsertCircuitBreaker(
    data: Omit<CircuitBreaker, 'id'>,
  ): Promise<ServiceResult<CircuitBreaker>>

  // ── Audit log ────────────────────────────────────────────────────────────
  createAuditLog(
    data: Omit<AuditLog, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<AuditLog>>

  listAuditLogs(
    filter: AuditLogFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'createdAt'>,
  ): Promise<ServiceResult<{ items: AuditLog[]; total: number }>>
}
