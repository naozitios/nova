import type { SupabaseClient } from '@supabase/supabase-js'
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
} from '@/core/business-context/types'
import type {
  AuditLogFilter,
  BusinessFilter,
  CircuitBreakerFilter,
  ConflictFilter,
  FactFilter,
  JobFilter,
  OnboardingFilter,
  PaginationParams,
  ProcessingRunFilter,
  ProfileVersionFilter,
  QuestionFilter,
  QualityGateFilter,
  RunnableJobFilter,
  RepositoryPort,
  SortParams,
  SourceDocumentFilter,
  SourceFilter,
  StageEventFilter,
} from '@/core/business-context/repository.port'
import { getSupabaseServiceClient } from './supabase-client'
import type { JsonValue } from '@/core/business-context/types'

// ─── Row type aliases (Supabase returns snake_case) ────────────────────────

type Row = Record<string, unknown>

/** Cast Supabase JSON to JsonValue (safe: Supabase stores valid JSON). */
function asJson(v: unknown): JsonValue {
  return v as JsonValue
}

function asJsonRecord(v: unknown): Record<string, JsonValue> {
  return (v ?? {}) as Record<string, JsonValue>
}

function asJsonRecordOrNull(v: unknown): Record<string, JsonValue> | null {
  return v != null ? (v as Record<string, JsonValue>) : null
}

// ─── Mapping helpers ────────────────────────────────────────────────────────

function mapBusiness(r: Row): Business {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    name: r.name as string,
    websiteUrl: (r.website_url as string) ?? null,
    status: r.status as string,
    createdAt: new Date(r.created_at as string),
    updatedAt: new Date(r.updated_at as string),
  }
}

function mapOnboardingSession(r: Row): OnboardingSession {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    status: r.status as OnboardingSession['status'],
    currentStep: (r.current_step as string) ?? null,
    startedBy: r.started_by as string,
    startedAt: new Date(r.started_at as string),
    completedAt: r.completed_at ? new Date(r.completed_at as string) : null,
    error: asJson(r.error),
  }
}

function mapContextSource(r: Row): ContextSource {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    sourceType: r.source_type as ContextSource['sourceType'],
    sourceName: r.source_name as string,
    externalReference: (r.external_reference as string) ?? null,
    status: r.status as string,
    currentStage: (r.current_stage as ContextSource['currentStage']) ?? null,
    terminalOutcome: (r.terminal_outcome as ContextSource['terminalOutcome']) ?? null,
    metadata: asJsonRecord(r.metadata),
    collectedAt: new Date(r.collected_at as string),
  }
}

function mapSourceDocument(r: Row): SourceDocument {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    sourceId: r.source_id as string,
    url: (r.url as string) ?? null,
    title: (r.title as string) ?? null,
    documentType: (r.document_type as string) ?? null,
    mimeType: (r.mime_type as string) ?? null,
    fileName: (r.file_name as string) ?? null,
    fileSizeBytes: r.file_size_bytes != null ? Number(r.file_size_bytes) : null,
    contentText: (r.content_text as string) ?? null,
    storagePath: (r.storage_path as string) ?? null,
    contentHash: r.content_hash as string,
    httpStatus: r.http_status != null ? Number(r.http_status) : null,
    pageOrSlideCount: r.page_or_slide_count != null ? Number(r.page_or_slide_count) : null,
    parserName: (r.parser_name as string) ?? null,
    parserVersion: (r.parser_version as string) ?? null,
    effectiveAt: r.effective_at ? new Date(r.effective_at as string) : null,
    supersedesDocumentId: (r.supersedes_document_id as string) ?? null,
    metadata: asJsonRecord(r.metadata),
    retrievedAt: new Date(r.retrieved_at as string),
  }
}

function mapContextFact(r: Row): ContextFact {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    factKey: r.fact_key as string,
    value: asJson(r.value),
    sourceId: r.source_id as string,
    sourceDocumentId: (r.source_document_id as string) ?? null,
    sourceExcerpt: (r.source_excerpt as string) ?? null,
    evidenceLocator: asJson(r.evidence_locator),
    confidence: Number(r.confidence),
    verificationStatus: r.verification_status as ContextFact['verificationStatus'],
    supersedesFactId: (r.supersedes_fact_id as string) ?? null,
    validFrom: new Date(r.valid_from as string),
    validTo: r.valid_to ? new Date(r.valid_to as string) : null,
    createdAt: new Date(r.created_at as string),
    createdBy: r.created_by as string,
  }
}

function mapContextConflict(r: Row): ContextConflict {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    factKey: r.fact_key as string,
    factIds: (r.fact_ids as string[]) ?? [],
    status: r.status as ContextConflict['status'],
    resolutionFactId: (r.resolution_fact_id as string) ?? null,
    resolutionNote: (r.resolution_note as string) ?? null,
    resolvedBy: (r.resolved_by as string) ?? null,
    createdAt: new Date(r.created_at as string),
    resolvedAt: r.resolved_at ? new Date(r.resolved_at as string) : null,
  }
}

function mapOnboardingQuestion(r: Row): OnboardingQuestion {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    sessionId: r.session_id as string,
    businessId: r.business_id as string,
    factKey: r.fact_key as string,
    questionType: r.question_type as string,
    question: r.question as string,
    options: asJson(r.options),
    reason: r.reason as string,
    priority: Number(r.priority),
    status: r.status as OnboardingQuestion['status'],
    answer: asJson(r.answer),
    answeredBy: (r.answered_by as string) ?? null,
    answeredAt: r.answered_at ? new Date(r.answered_at as string) : null,
  }
}

function mapProfileVersion(r: Row): BusinessProfileVersion {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    version: Number(r.version),
    profile: asJsonRecord(r.profile),
    profileMarkdown: (r.profile_markdown as string) ?? null,
    status: r.status as BusinessProfileVersion['status'],
    changeSummary: (r.change_summary as string) ?? null,
    createdBy: r.created_by as string,
    createdAt: new Date(r.created_at as string),
    approvedBy: (r.approved_by as string) ?? null,
    approvedAt: r.approved_at ? new Date(r.approved_at as string) : null,
  }
}

function mapContextJob(r: Row): ContextJob {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    sessionId: (r.session_id as string) ?? null,
    jobType: r.job_type as string,
    status: r.status as ContextJob['status'],
    attemptCount: Number(r.attempt_count),
    maxAttempts: Number(r.max_attempts),
    idempotencyKey: r.idempotency_key as string,
    stage: (r.stage as ContextJob['stage']) ?? null,
    input: asJsonRecord(r.input),
    output: asJsonRecordOrNull(r.output),
    error: asJson(r.error),
    errorClass: (r.error_class as string) ?? null,
    retryPolicy: asJsonRecord(r.retry_policy),
    nextRunAt: r.next_run_at ? new Date(r.next_run_at as string) : null,
    lockedBy: (r.locked_by as string) ?? null,
    lockedAt: r.locked_at ? new Date(r.locked_at as string) : null,
    heartbeatAt: r.heartbeat_at ? new Date(r.heartbeat_at as string) : null,
    stageTimeoutSeconds: r.stage_timeout_seconds != null ? Number(r.stage_timeout_seconds) : null,
    createdAt: new Date(r.created_at as string),
    startedAt: r.started_at ? new Date(r.started_at as string) : null,
    completedAt: r.completed_at ? new Date(r.completed_at as string) : null,
  }
}

function mapProcessingRun(r: Row): ProcessingRun {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    sourceId: r.source_id as string,
    jobId: (r.job_id as string) ?? null,
    pipelineType: r.pipeline_type as string,
    status: r.status as string,
    currentStage: r.current_stage as ProcessingRun['currentStage'],
    terminalOutcome: (r.terminal_outcome as ProcessingRun['terminalOutcome']) ?? null,
    attemptCount: Number(r.attempt_count),
    pagesProcessed: Number(r.pages_processed),
    slidesProcessed: Number(r.slides_processed),
    documentsCreated: Number(r.documents_created),
    factsExtracted: Number(r.facts_extracted),
    warningsCount: Number(r.warnings_count),
    creditsConsumed: Number(r.credits_consumed),
    qualitySummary: asJsonRecord(r.quality_summary),
    startedAt: new Date(r.started_at as string),
    completedAt: r.completed_at ? new Date(r.completed_at as string) : null,
  }
}

function mapStageEvent(r: Row): StageEvent {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    runId: r.run_id as string,
    jobId: (r.job_id as string) ?? null,
    sourceId: r.source_id as string,
    stage: r.stage as StageEvent['stage'],
    status: r.status as StageEvent['status'],
    attempt: Number(r.attempt),
    workerId: (r.worker_id as string) ?? null,
    provider: (r.provider as string) ?? null,
    providerRequestId: (r.provider_request_id as string) ?? null,
    startedAt: new Date(r.started_at as string),
    completedAt: r.completed_at ? new Date(r.completed_at as string) : null,
    durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
    pagesProcessed: Number(r.pages_processed),
    slidesProcessed: Number(r.slides_processed),
    bytesProcessed: Number(r.bytes_processed),
    documentsCreated: Number(r.documents_created),
    factsExtracted: Number(r.facts_extracted),
    warningsCount: Number(r.warnings_count),
    creditsConsumed: Number(r.credits_consumed),
    errorClass: (r.error_class as string) ?? null,
    error: asJson(r.error),
    metadata: asJsonRecord(r.metadata),
  }
}

function mapQualityGateResult(r: Row): QualityGateResult {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    runId: (r.run_id as string) ?? null,
    sourceId: (r.source_id as string) ?? null,
    sourceDocumentId: (r.source_document_id as string) ?? null,
    factId: (r.fact_id as string) ?? null,
    gateScope: r.gate_scope as QualityGateResult['gateScope'],
    gateName: r.gate_name as string,
    status: r.status as QualityGateResult['status'],
    measuredValue: asJson(r.measured_value),
    threshold: asJson(r.threshold),
    reason: (r.reason as string) ?? null,
    createdAt: new Date(r.created_at as string),
  }
}

function mapCircuitBreaker(r: Row): CircuitBreaker {
  return {
    id: r.id as string,
    workspaceId: (r.workspace_id as string) ?? null,
    provider: r.provider as string,
    state: r.state as CircuitBreaker['state'],
    failureCount: Number(r.failure_count),
    successCount: Number(r.success_count),
    timeoutCount: Number(r.timeout_count),
    quotaExhausted: r.quota_exhausted as boolean,
    openedAt: r.opened_at ? new Date(r.opened_at as string) : null,
    halfOpenAfter: r.half_open_after ? new Date(r.half_open_after as string) : null,
    lastFailureAt: r.last_failure_at ? new Date(r.last_failure_at as string) : null,
    lastSuccessAt: r.last_success_at ? new Date(r.last_success_at as string) : null,
    metadata: asJsonRecord(r.metadata),
  }
}

function mapAuditLog(r: Row): AuditLog {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    actorId: (r.actor_id as string) ?? null,
    actorType: r.actor_type as AuditLog['actorType'],
    eventType: r.event_type as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as string,
    before: asJsonRecordOrNull(r.before),
    after: asJsonRecordOrNull(r.after),
    createdAt: new Date(r.created_at as string),
  }
}

// ─── Error helper ───────────────────────────────────────────────────────────

function err<T>(code: string, message: string): ServiceResult<T> {
  return { ok: false, error: { code, message } }
}

// ─── Repository implementation ──────────────────────────────────────────────

export class SupabaseRepository implements RepositoryPort {
  private db: SupabaseClient

  constructor(client?: SupabaseClient) {
    this.db = client ?? getSupabaseServiceClient()
  }

  // ── Businesses ───────────────────────────────────────────────────────────

  async createBusiness(
    data: Omit<Business, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<Business>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('businesses')
      .insert({
        workspace_id: data.workspaceId,
        name: data.name,
        website_url: data.websiteUrl,
        status: data.status,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapBusiness(row) }
  }

  async getBusiness(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<Business | null>> {
    const { data, error } = await this.db
      .from('businesses')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', businessId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapBusiness(data) : null }
  }

  async listBusinesses(
    filter: BusinessFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'name' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<{ items: Business[]; total: number }>> {
    let query = this.db
      .from('businesses')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)

    if (filter.status) query = query.eq('status', filter.status)

    const sortField = sort?.field === 'createdAt' ? 'created_at'
      : sort?.field === 'updatedAt' ? 'updated_at'
      : sort?.field ?? 'created_at'
    const sortDir = sort?.direction ?? 'desc'
    query = query.order(sortField, { ascending: sortDir === 'asc' })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapBusiness), total: count ?? 0 },
    }
  }

  async updateBusiness(
    workspaceId: string,
    businessId: string,
    data: Partial<Pick<Business, 'name' | 'websiteUrl' | 'status'>>,
  ): Promise<ServiceResult<Business>> {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) update.name = data.name
    if (data.websiteUrl !== undefined) update.website_url = data.websiteUrl
    if (data.status !== undefined) update.status = data.status

    const { data: row, error } = await this.db
      .from('businesses')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', businessId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapBusiness(row) }
  }

  // ── Onboarding sessions ──────────────────────────────────────────────────

  async createOnboardingSession(
    data: Omit<OnboardingSession, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<OnboardingSession>> {
    const { data: row, error } = await this.db
      .from('onboarding_sessions')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        status: data.status,
        current_step: data.currentStep,
        started_by: data.startedBy,
        started_at: data.startedAt.toISOString(),
        completed_at: data.completedAt?.toISOString() ?? null,
        error: data.error,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapOnboardingSession(row) }
  }

  async getOnboardingSession(
    workspaceId: string,
    sessionId: string,
  ): Promise<ServiceResult<OnboardingSession | null>> {
    const { data, error } = await this.db
      .from('onboarding_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', sessionId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapOnboardingSession(data) : null }
  }

  async listOnboardingSessions(
    filter: OnboardingFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: OnboardingSession[]; total: number }>> {
    let query = this.db
      .from('onboarding_sessions')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)

    if (filter.businessId) query = query.eq('business_id', filter.businessId)
    if (filter.status) query = query.eq('status', filter.status)

    query = query.order('started_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapOnboardingSession), total: count ?? 0 },
    }
  }

  async updateOnboardingSession(
    workspaceId: string,
    sessionId: string,
    data: Partial<Pick<OnboardingSession, 'status' | 'currentStep' | 'completedAt' | 'error'>>,
  ): Promise<ServiceResult<OnboardingSession>> {
    const update: Record<string, unknown> = {}
    if (data.status !== undefined) update.status = data.status
    if (data.currentStep !== undefined) update.current_step = data.currentStep
    if (data.completedAt !== undefined) update.completed_at = data.completedAt?.toISOString() ?? null
    if (data.error !== undefined) update.error = data.error

    const { data: row, error } = await this.db
      .from('onboarding_sessions')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', sessionId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapOnboardingSession(row) }
  }

  // ── Context sources ──────────────────────────────────────────────────────

  async createContextSource(
    data: Omit<ContextSource, 'id'>,
  ): Promise<ServiceResult<ContextSource>> {
    const { data: row, error } = await this.db
      .from('context_sources')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        source_type: data.sourceType,
        source_name: data.sourceName,
        external_reference: data.externalReference,
        status: data.status,
        current_stage: data.currentStage,
        terminal_outcome: data.terminalOutcome,
        metadata: data.metadata,
        collected_at: data.collectedAt.toISOString(),
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapContextSource(row) }
  }

  async getContextSource(
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextSource | null>> {
    const { data, error } = await this.db
      .from('context_sources')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', sourceId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextSource(data) : null }
  }

  async listContextSources(
    filter: SourceFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextSource[]; total: number }>> {
    let query = this.db
      .from('context_sources')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.sourceType) query = query.eq('source_type', filter.sourceType)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.currentStage) query = query.eq('current_stage', filter.currentStage)

    query = query.order('collected_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapContextSource), total: count ?? 0 },
    }
  }

  async updateContextSource(
    workspaceId: string,
    sourceId: string,
    data: Partial<Pick<ContextSource, 'status' | 'currentStage' | 'terminalOutcome' | 'metadata' | 'sourceName'>>,
  ): Promise<ServiceResult<ContextSource>> {
    const update: Record<string, unknown> = {}
    if (data.status !== undefined) update.status = data.status
    if (data.currentStage !== undefined) update.current_stage = data.currentStage
    if (data.terminalOutcome !== undefined) update.terminal_outcome = data.terminalOutcome
    if (data.metadata !== undefined) update.metadata = data.metadata
    if (data.sourceName !== undefined) update.source_name = data.sourceName

    const { data: row, error } = await this.db
      .from('context_sources')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', sourceId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapContextSource(row) }
  }

  // ── Source documents ─────────────────────────────────────────────────────

  async createSourceDocument(
    data: Omit<SourceDocument, 'id'>,
  ): Promise<ServiceResult<SourceDocument>> {
    const { data: row, error } = await this.db
      .from('source_documents')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        source_id: data.sourceId,
        url: data.url,
        title: data.title,
        document_type: data.documentType,
        mime_type: data.mimeType,
        file_name: data.fileName,
        file_size_bytes: data.fileSizeBytes,
        content_text: data.contentText,
        storage_path: data.storagePath,
        content_hash: data.contentHash,
        http_status: data.httpStatus,
        page_or_slide_count: data.pageOrSlideCount,
        parser_name: data.parserName,
        parser_version: data.parserVersion,
        effective_at: data.effectiveAt?.toISOString() ?? null,
        supersedes_document_id: data.supersedesDocumentId,
        metadata: data.metadata,
        retrieved_at: data.retrievedAt.toISOString(),
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapSourceDocument(row) }
  }

  async getSourceDocument(
    workspaceId: string,
    documentId: string,
  ): Promise<ServiceResult<SourceDocument | null>> {
    const { data, error } = await this.db
      .from('source_documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', documentId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapSourceDocument(data) : null }
  }

  async listSourceDocuments(
    filter: SourceDocumentFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: SourceDocument[]; total: number }>> {
    let query = this.db
      .from('source_documents')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.sourceId) query = query.eq('source_id', filter.sourceId)
    if (filter.contentHash) query = query.eq('content_hash', filter.contentHash)

    query = query.order('retrieved_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapSourceDocument), total: count ?? 0 },
    }
  }

  async getSourceDocumentByHash(
    businessId: string,
    contentHash: string,
  ): Promise<ServiceResult<SourceDocument | null>> {
    const { data, error } = await this.db
      .from('source_documents')
      .select('*')
      .eq('business_id', businessId)
      .eq('content_hash', contentHash)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapSourceDocument(data) : null }
  }

  async updateSourceDocument(
    workspaceId: string,
    documentId: string,
    data: Partial<Pick<SourceDocument, 'metadata' | 'storagePath'>>,
  ): Promise<ServiceResult<SourceDocument>> {
    const update: Record<string, unknown> = {}
    if (data.metadata !== undefined) update.metadata = data.metadata
    if (data.storagePath !== undefined) update.storage_path = data.storagePath

    const { data: row, error } = await this.db
      .from('source_documents')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', documentId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapSourceDocument(row) }
  }

  // ── Context facts ────────────────────────────────────────────────────────

  async createContextFact(
    data: Omit<ContextFact, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextFact>> {
    const { data: row, error } = await this.db
      .from('context_facts')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        fact_key: data.factKey,
        value: data.value,
        source_id: data.sourceId,
        source_document_id: data.sourceDocumentId,
        source_excerpt: data.sourceExcerpt,
        evidence_locator: data.evidenceLocator,
        confidence: data.confidence,
        verification_status: data.verificationStatus,
        supersedes_fact_id: data.supersedesFactId,
        valid_from: data.validFrom.toISOString(),
        valid_to: data.validTo?.toISOString() ?? null,
        created_by: data.createdBy,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapContextFact(row) }
  }

  async getContextFact(
    workspaceId: string,
    factId: string,
  ): Promise<ServiceResult<ContextFact | null>> {
    const { data, error } = await this.db
      .from('context_facts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', factId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextFact(data) : null }
  }

  async listContextFacts(
    filter: FactFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextFact[]; total: number }>> {
    let query = this.db
      .from('context_facts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.factKey) query = query.eq('fact_key', filter.factKey)
    if (filter.sourceId) query = query.eq('source_id', filter.sourceId)
    if (filter.active !== undefined) {
      if (filter.active) {
        query = query.is('valid_to', null).not('verification_status', 'in', '(rejected,superseded)')
      } else {
        query = query.or('valid_to.not.is.null,verification_status.in.(rejected,superseded)')
      }
    }

    query = query.order('created_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapContextFact), total: count ?? 0 },
    }
  }

  async updateContextFact(
    workspaceId: string,
    factId: string,
    data: Partial<Pick<ContextFact, 'value' | 'verificationStatus' | 'supersedesFactId' | 'validTo' | 'confidence'>>,
  ): Promise<ServiceResult<ContextFact>> {
    const update: Record<string, unknown> = {}
    if (data.value !== undefined) update.value = data.value
    if (data.verificationStatus !== undefined) update.verification_status = data.verificationStatus
    if (data.supersedesFactId !== undefined) update.supersedes_fact_id = data.supersedesFactId
    if (data.validTo !== undefined) update.valid_to = data.validTo?.toISOString() ?? null
    if (data.confidence !== undefined) update.confidence = data.confidence

    const { data: row, error } = await this.db
      .from('context_facts')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', factId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapContextFact(row) }
  }

  // ── Context conflicts ────────────────────────────────────────────────────

  async createContextConflict(
    data: Omit<ContextConflict, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextConflict>> {
    const { data: row, error } = await this.db
      .from('context_conflicts')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        fact_key: data.factKey,
        fact_ids: data.factIds,
        status: data.status,
        resolution_fact_id: data.resolutionFactId,
        resolution_note: data.resolutionNote,
        resolved_by: data.resolvedBy,
        resolved_at: data.resolvedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapContextConflict(row) }
  }

  async getContextConflict(
    workspaceId: string,
    conflictId: string,
  ): Promise<ServiceResult<ContextConflict | null>> {
    const { data, error } = await this.db
      .from('context_conflicts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', conflictId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextConflict(data) : null }
  }

  async listContextConflicts(
    filter: ConflictFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextConflict[]; total: number }>> {
    let query = this.db
      .from('context_conflicts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.status) query = query.eq('status', filter.status)
    if (filter.factKey) query = query.eq('fact_key', filter.factKey)

    query = query.order('created_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapContextConflict), total: count ?? 0 },
    }
  }

  async resolveContextConflict(
    workspaceId: string,
    conflictId: string,
    resolutionFactId: string,
    resolvedBy: string,
    note?: string,
  ): Promise<ServiceResult<ContextConflict>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('context_conflicts')
      .update({
        status: 'resolved',
        resolution_fact_id: resolutionFactId,
        resolved_by: resolvedBy,
        resolution_note: note ?? null,
        resolved_at: now,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', conflictId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapContextConflict(row) }
  }

  // ── Onboarding questions ─────────────────────────────────────────────────

  async createOnboardingQuestion(
    data: Omit<OnboardingQuestion, 'id'>,
  ): Promise<ServiceResult<OnboardingQuestion>> {
    const { data: row, error } = await this.db
      .from('onboarding_questions')
      .insert({
        workspace_id: data.workspaceId,
        session_id: data.sessionId,
        business_id: data.businessId,
        fact_key: data.factKey,
        question_type: data.questionType,
        question: data.question,
        options: data.options,
        reason: data.reason,
        priority: data.priority,
        status: data.status,
        answer: data.answer,
        answered_by: data.answeredBy,
        answered_at: data.answeredAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapOnboardingQuestion(row) }
  }

  async getOnboardingQuestion(
    workspaceId: string,
    questionId: string,
  ): Promise<ServiceResult<OnboardingQuestion | null>> {
    const { data, error } = await this.db
      .from('onboarding_questions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', questionId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapOnboardingQuestion(data) : null }
  }

  async listOnboardingQuestions(
    filter: QuestionFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: OnboardingQuestion[]; total: number }>> {
    let query = this.db
      .from('onboarding_questions')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('session_id', filter.sessionId)

    if (filter.status) query = query.eq('status', filter.status)

    query = query.order('priority', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapOnboardingQuestion), total: count ?? 0 },
    }
  }

  async answerOnboardingQuestion(
    workspaceId: string,
    questionId: string,
    answer: unknown,
    answeredBy: string,
  ): Promise<ServiceResult<OnboardingQuestion>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('onboarding_questions')
      .update({
        status: 'answered',
        answer,
        answered_by: answeredBy,
        answered_at: now,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', questionId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapOnboardingQuestion(row) }
  }

  // ── Business profile versions ────────────────────────────────────────────

  async createProfileVersion(
    data: Omit<BusinessProfileVersion, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<BusinessProfileVersion>> {
    const { data: row, error } = await this.db
      .from('business_profile_versions')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        version: data.version,
        profile: data.profile,
        profile_markdown: data.profileMarkdown,
        status: data.status,
        change_summary: data.changeSummary,
        created_by: data.createdBy,
        approved_by: data.approvedBy,
        approved_at: data.approvedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapProfileVersion(row) }
  }

  async getProfileVersion(
    workspaceId: string,
    versionId: string,
  ): Promise<ServiceResult<BusinessProfileVersion | null>> {
    const { data, error } = await this.db
      .from('business_profile_versions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', versionId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapProfileVersion(data) : null }
  }

  async listProfileVersions(
    filter: ProfileVersionFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: BusinessProfileVersion[]; total: number }>> {
    let query = this.db
      .from('business_profile_versions')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.status) query = query.eq('status', filter.status)

    query = query.order('version', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapProfileVersion), total: count ?? 0 },
    }
  }

  async getCurrentProfileVersion(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<BusinessProfileVersion | null>> {
    const { data, error } = await this.db
      .from('business_profile_versions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('business_id', businessId)
      .eq('status', 'current')
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapProfileVersion(data) : null }
  }

  async supersedeProfileVersions(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<void>> {
    const { error } = await this.db
      .from('business_profile_versions')
      .update({ status: 'superseded' })
      .eq('workspace_id', workspaceId)
      .eq('business_id', businessId)
      .eq('status', 'current')

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: undefined }
  }

  async approveProfileVersion(
    workspaceId: string,
    versionId: string,
    approvedBy: string,
  ): Promise<ServiceResult<BusinessProfileVersion>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('business_profile_versions')
      .update({
        status: 'current',
        approved_by: approvedBy,
        approved_at: now,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', versionId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapProfileVersion(row) }
  }

  async restoreProfileVersion(
    workspaceId: string,
    versionId: string,
    restoredBy: string,
    note?: string,
  ): Promise<ServiceResult<BusinessProfileVersion>> {
    const { data, error: readErr } = await this.db
      .from('business_profile_versions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', versionId)
      .single()

    if (readErr || !data) return err('READ_FAILED', 'Source version not found')

    // Compute next version number
    const { data: maxRow } = await this.db
      .from('business_profile_versions')
      .select('version')
      .eq('workspace_id', workspaceId)
      .eq('business_id', data.business_id)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = (maxRow ? Number(maxRow.version) : 0) + 1

    const { data: newRow, error: insertErr } = await this.db
      .from('business_profile_versions')
      .insert({
        workspace_id: workspaceId,
        business_id: data.business_id,
        version: nextVersion,
        profile: data.profile,
        profile_markdown: data.profile_markdown,
        status: 'draft',
        change_summary: note ?? `Restored from version ${data.version}`,
        created_by: restoredBy,
      })
      .select()
      .single()

    if (insertErr) return err('CREATE_FAILED', insertErr.message)
    return { ok: true, data: mapProfileVersion(newRow) }
  }

  // ── Context jobs ─────────────────────────────────────────────────────────

  async createContextJob(
    data: Omit<ContextJob, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextJob>> {
    const { data: row, error } = await this.db
      .from('context_jobs')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        session_id: data.sessionId,
        job_type: data.jobType,
        status: data.status,
        attempt_count: data.attemptCount,
        max_attempts: data.maxAttempts,
        idempotency_key: data.idempotencyKey,
        stage: data.stage,
        input: data.input,
        output: data.output,
        error: data.error,
        error_class: data.errorClass,
        retry_policy: data.retryPolicy,
        next_run_at: data.nextRunAt?.toISOString() ?? null,
        locked_by: data.lockedBy,
        locked_at: data.lockedAt?.toISOString() ?? null,
        heartbeat_at: data.heartbeatAt?.toISOString() ?? null,
        stage_timeout_seconds: data.stageTimeoutSeconds,
        started_at: data.startedAt?.toISOString() ?? null,
        completed_at: data.completedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapContextJob(row) }
  }

  async getContextJob(
    workspaceId: string,
    jobId: string,
  ): Promise<ServiceResult<ContextJob | null>> {
    const { data, error } = await this.db
      .from('context_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', jobId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextJob(data) : null }
  }

  async getContextJobByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<ServiceResult<ContextJob | null>> {
    const { data, error } = await this.db
      .from('context_jobs')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextJob(data) : null }
  }

  async listContextJobs(
    filter: JobFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextJob[]; total: number }>> {
    let query = this.db
      .from('context_jobs')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.jobType) query = query.eq('job_type', filter.jobType)
    if (filter.status) query = query.eq('status', filter.status)

    query = query.order('created_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapContextJob), total: count ?? 0 },
    }
  }

  async claimRunnableJobs(
    filter: RunnableJobFilter,
    workerId: string,
    limit: number,
  ): Promise<ServiceResult<ContextJob[]>> {
    const now = new Date().toISOString()

    // Select unclaimed jobs matching filter
    let query = this.db
      .from('context_jobs')
      .select('*')
      .eq('status', filter.status)
      .is('locked_by', null)
      .limit(limit)

    if (filter.jobType) query = query.eq('job_type', filter.jobType)

    const { data: candidates, error: readErr } = await query
    if (readErr) return err('READ_FAILED', readErr.message)

    if (!candidates || candidates.length === 0) {
      return { ok: true, data: [] }
    }

    // Lock them
    const ids = candidates.map((r: Row) => r.id as string)
    const { data: locked, error: lockErr } = await this.db
      .from('context_jobs')
      .update({
        locked_by: workerId,
        locked_at: now,
        heartbeat_at: now,
        status: 'running',
        started_at: now,
      })
      .in('id', ids)
      .is('locked_by', null)
      .select()

    if (lockErr) return err('UPDATE_FAILED', lockErr.message)
    return { ok: true, data: (locked ?? []).map(mapContextJob) }
  }

  async updateContextJob(
    workspaceId: string,
    jobId: string,
    data: Partial<Pick<ContextJob, 'status' | 'attemptCount' | 'output' | 'error' | 'errorClass' | 'nextRunAt' | 'lockedBy' | 'lockedAt' | 'heartbeatAt' | 'startedAt' | 'completedAt'>>,
  ): Promise<ServiceResult<ContextJob>> {
    const update: Record<string, unknown> = {}
    if (data.status !== undefined) update.status = data.status
    if (data.attemptCount !== undefined) update.attempt_count = data.attemptCount
    if (data.output !== undefined) update.output = data.output
    if (data.error !== undefined) update.error = data.error
    if (data.errorClass !== undefined) update.error_class = data.errorClass
    if (data.nextRunAt !== undefined) update.next_run_at = data.nextRunAt?.toISOString() ?? null
    if (data.lockedBy !== undefined) update.locked_by = data.lockedBy
    if (data.lockedAt !== undefined) update.locked_at = data.lockedAt?.toISOString() ?? null
    if (data.heartbeatAt !== undefined) update.heartbeat_at = data.heartbeatAt?.toISOString() ?? null
    if (data.startedAt !== undefined) update.started_at = data.startedAt?.toISOString() ?? null
    if (data.completedAt !== undefined) update.completed_at = data.completedAt?.toISOString() ?? null

    const { data: row, error } = await this.db
      .from('context_jobs')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', jobId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapContextJob(row) }
  }

  // ── Processing runs ──────────────────────────────────────────────────────

  async createProcessingRun(
    data: Omit<ProcessingRun, 'id'>,
  ): Promise<ServiceResult<ProcessingRun>> {
    const { data: row, error } = await this.db
      .from('context_processing_runs')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        source_id: data.sourceId,
        job_id: data.jobId,
        pipeline_type: data.pipelineType,
        status: data.status,
        current_stage: data.currentStage,
        terminal_outcome: data.terminalOutcome,
        attempt_count: data.attemptCount,
        pages_processed: data.pagesProcessed,
        slides_processed: data.slidesProcessed,
        documents_created: data.documentsCreated,
        facts_extracted: data.factsExtracted,
        warnings_count: data.warningsCount,
        credits_consumed: data.creditsConsumed,
        quality_summary: data.qualitySummary,
        started_at: data.startedAt.toISOString(),
        completed_at: data.completedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapProcessingRun(row) }
  }

  async getProcessingRun(
    workspaceId: string,
    runId: string,
  ): Promise<ServiceResult<ProcessingRun | null>> {
    const { data, error } = await this.db
      .from('context_processing_runs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapProcessingRun(data) : null }
  }

  async listProcessingRuns(
    filter: ProcessingRunFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'startedAt'>,
  ): Promise<ServiceResult<{ items: ProcessingRun[]; total: number }>> {
    let query = this.db
      .from('context_processing_runs')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.sourceId) query = query.eq('source_id', filter.sourceId)
    if (filter.jobId) query = query.eq('job_id', filter.jobId)
    if (filter.status) query = query.eq('status', filter.status)

    const sortDir = sort?.direction ?? 'desc'
    query = query.order('started_at', { ascending: sortDir === 'asc' })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapProcessingRun), total: count ?? 0 },
    }
  }

  async updateProcessingRun(
    workspaceId: string,
    runId: string,
    data: Partial<Pick<ProcessingRun, 'status' | 'currentStage' | 'terminalOutcome' | 'attemptCount' | 'pagesProcessed' | 'slidesProcessed' | 'documentsCreated' | 'factsExtracted' | 'warningsCount' | 'creditsConsumed' | 'qualitySummary' | 'completedAt'>>,
  ): Promise<ServiceResult<ProcessingRun>> {
    const update: Record<string, unknown> = {}
    if (data.status !== undefined) update.status = data.status
    if (data.currentStage !== undefined) update.current_stage = data.currentStage
    if (data.terminalOutcome !== undefined) update.terminal_outcome = data.terminalOutcome
    if (data.attemptCount !== undefined) update.attempt_count = data.attemptCount
    if (data.pagesProcessed !== undefined) update.pages_processed = data.pagesProcessed
    if (data.slidesProcessed !== undefined) update.slides_processed = data.slidesProcessed
    if (data.documentsCreated !== undefined) update.documents_created = data.documentsCreated
    if (data.factsExtracted !== undefined) update.facts_extracted = data.factsExtracted
    if (data.warningsCount !== undefined) update.warnings_count = data.warningsCount
    if (data.creditsConsumed !== undefined) update.credits_consumed = data.creditsConsumed
    if (data.qualitySummary !== undefined) update.quality_summary = data.qualitySummary
    if (data.completedAt !== undefined) update.completed_at = data.completedAt?.toISOString() ?? null

    const { data: row, error } = await this.db
      .from('context_processing_runs')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', runId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapProcessingRun(row) }
  }

  // ── Stage events ─────────────────────────────────────────────────────────

  async createStageEvent(
    data: Omit<StageEvent, 'id'>,
  ): Promise<ServiceResult<StageEvent>> {
    const { data: row, error } = await this.db
      .from('context_processing_stage_events')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        run_id: data.runId,
        job_id: data.jobId,
        source_id: data.sourceId,
        stage: data.stage,
        status: data.status,
        attempt: data.attempt,
        worker_id: data.workerId,
        provider: data.provider,
        provider_request_id: data.providerRequestId,
        started_at: data.startedAt.toISOString(),
        completed_at: data.completedAt?.toISOString() ?? null,
        duration_ms: data.durationMs,
        pages_processed: data.pagesProcessed,
        slides_processed: data.slidesProcessed,
        bytes_processed: data.bytesProcessed,
        documents_created: data.documentsCreated,
        facts_extracted: data.factsExtracted,
        warnings_count: data.warningsCount,
        credits_consumed: data.creditsConsumed,
        error_class: data.errorClass,
        error: data.error,
        metadata: data.metadata,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapStageEvent(row) }
  }

  async listStageEvents(
    filter: StageEventFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: StageEvent[]; total: number }>> {
    let query = this.db
      .from('context_processing_stage_events')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.runId) query = query.eq('run_id', filter.runId)
    if (filter.jobId) query = query.eq('job_id', filter.jobId)
    if (filter.sourceId) query = query.eq('source_id', filter.sourceId)
    if (filter.stage) query = query.eq('stage', filter.stage)

    query = query.order('started_at', { ascending: true })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapStageEvent), total: count ?? 0 },
    }
  }

  // ── Quality gate results ─────────────────────────────────────────────────

  async createQualityGateResult(
    data: Omit<QualityGateResult, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<QualityGateResult>> {
    const { data: row, error } = await this.db
      .from('context_quality_gate_results')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        run_id: data.runId,
        source_id: data.sourceId,
        source_document_id: data.sourceDocumentId,
        fact_id: data.factId,
        gate_scope: data.gateScope,
        gate_name: data.gateName,
        status: data.status,
        measured_value: data.measuredValue,
        threshold: data.threshold,
        reason: data.reason,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapQualityGateResult(row) }
  }

  async listQualityGateResults(
    filter: QualityGateFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: QualityGateResult[]; total: number }>> {
    let query = this.db
      .from('context_quality_gate_results')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.runId) query = query.eq('run_id', filter.runId)
    if (filter.sourceDocumentId) query = query.eq('source_document_id', filter.sourceDocumentId)
    if (filter.factId) query = query.eq('fact_id', filter.factId)
    if (filter.gateScope) query = query.eq('gate_scope', filter.gateScope)
    if (filter.status) query = query.eq('status', filter.status)

    query = query.order('created_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapQualityGateResult), total: count ?? 0 },
    }
  }

  // ── Circuit breakers ─────────────────────────────────────────────────────

  async getCircuitBreaker(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker | null>> {
    let query = this.db
      .from('context_provider_circuit_breakers')
      .select('*')
      .eq('provider', provider)

    if (workspaceId === null) {
      query = query.is('workspace_id', null)
    } else {
      query = query.eq('workspace_id', workspaceId)
    }

    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapCircuitBreaker(data) : null }
  }

  async upsertCircuitBreaker(
    data: Omit<CircuitBreaker, 'id'>,
  ): Promise<ServiceResult<CircuitBreaker>> {
    const { data: row, error } = await this.db
      .from('context_provider_circuit_breakers')
      .upsert(
        {
          workspace_id: data.workspaceId,
          provider: data.provider,
          state: data.state,
          failure_count: data.failureCount,
          success_count: data.successCount,
          timeout_count: data.timeoutCount,
          quota_exhausted: data.quotaExhausted,
          opened_at: data.openedAt?.toISOString() ?? null,
          half_open_after: data.halfOpenAfter?.toISOString() ?? null,
          last_failure_at: data.lastFailureAt?.toISOString() ?? null,
          last_success_at: data.lastSuccessAt?.toISOString() ?? null,
          metadata: data.metadata,
        },
        { onConflict: 'workspace_id,provider' },
      )
      .select()
      .single()

    if (error) return err('UPSERT_FAILED', error.message)
    return { ok: true, data: mapCircuitBreaker(row) }
  }

  // ── Audit log ────────────────────────────────────────────────────────────

  async createAuditLog(
    data: Omit<AuditLog, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<AuditLog>> {
    const { data: row, error } = await this.db
      .from('context_audit_log')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        actor_id: data.actorId,
        actor_type: data.actorType,
        event_type: data.eventType,
        entity_type: data.entityType,
        entity_id: data.entityId,
        before: data.before,
        after: data.after,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapAuditLog(row) }
  }

  async listAuditLogs(
    filter: AuditLogFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'createdAt'>,
  ): Promise<ServiceResult<{ items: AuditLog[]; total: number }>> {
    let query = this.db
      .from('context_audit_log')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)

    if (filter.businessId) query = query.eq('business_id', filter.businessId)
    if (filter.entityType) query = query.eq('entity_type', filter.entityType)
    if (filter.entityId) query = query.eq('entity_id', filter.entityId)
    if (filter.createdAfter) query = query.gte('created_at', filter.createdAfter.toISOString())
    if (filter.createdBefore) query = query.lte('created_at', filter.createdBefore.toISOString())

    const sortDir = sort?.direction ?? 'desc'
    query = query.order('created_at', { ascending: sortDir === 'asc' })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapAuditLog), total: count ?? 0 },
    }
  }
}
