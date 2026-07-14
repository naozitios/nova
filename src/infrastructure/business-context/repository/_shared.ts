import type {
  AuditLog,
  Business,
  BusinessProfileVersion,
  CircuitBreaker,
  ContextConflict,
  ContextFact,
  ContextJob,
  ContextSource,
  JsonValue,
  OnboardingQuestion,
  OnboardingSession,
  ProcessingRun,
  QualityGateResult,
  ServiceResult,
  SourceDocument,
  StageEvent,
} from '@/core/business-context/types'

// ─── Row type alias (Supabase returns snake_case) ──────────────────────────

export type Row = Record<string, unknown>

/** Cast Supabase JSON to JsonValue (safe: Supabase stores valid JSON). */
export function asJson(v: unknown): JsonValue {
  return v as JsonValue
}

export function asJsonRecord(v: unknown): Record<string, JsonValue> {
  return (v ?? {}) as Record<string, JsonValue>
}

export function asJsonRecordOrNull(v: unknown): Record<string, JsonValue> | null {
  return v != null ? (v as Record<string, JsonValue>) : null
}

// ─── Error helper ───────────────────────────────────────────────────────────

export function err<T>(code: string, message: string): ServiceResult<T> {
  return { ok: false, error: { code, message } }
}

// ─── Mapping helpers ────────────────────────────────────────────────────────

export function mapBusiness(r: Row): Business {
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

export function mapOnboardingSession(r: Row): OnboardingSession {
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

export function mapContextSource(r: Row): ContextSource {
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

export function mapSourceDocument(r: Row): SourceDocument {
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

export function mapContextFact(r: Row): ContextFact {
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

export function mapContextConflict(r: Row): ContextConflict {
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

export function mapOnboardingQuestion(r: Row): OnboardingQuestion {
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

export function mapProfileVersion(r: Row): BusinessProfileVersion {
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

export function mapContextJob(r: Row): ContextJob {
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

export function mapProcessingRun(r: Row): ProcessingRun {
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

export function mapStageEvent(r: Row): StageEvent {
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

export function mapQualityGateResult(r: Row): QualityGateResult {
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

export function mapCircuitBreaker(r: Row): CircuitBreaker {
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

export function mapAuditLog(r: Row): AuditLog {
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
