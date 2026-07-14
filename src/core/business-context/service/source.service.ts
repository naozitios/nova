// US2: Source management — register, list, get, process, archive, queue scan.

import type { RepositoryPort } from '../repository.port'
import type { ContextSource, ContextJob } from '../types'
import { SourceProcessingStage, JobStatus } from '../types'

export interface RegisterSourceInput {
  sourceType: string
  sourceName: string
  externalReference?: string
}

export async function registerSource(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  input: RegisterSourceInput,
): Promise<{ ok: true; data: ContextSource } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const business = await repo.getBusiness(workspaceId, businessId)
  if (!business.ok) return business
  if (!business.data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Business not found' } }
  }

  return repo.createContextSource({
    workspaceId,
    businessId,
    sourceType: input.sourceType as any,
    sourceName: input.sourceName,
    externalReference: input.externalReference ?? null,
    status: 'registered',
    currentStage: null,
    terminalOutcome: null,
    metadata: {},
    collectedAt: new Date(),
  })
}

export async function listSources(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<{ ok: true; data: { items: ContextSource[]; total: number } } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  return repo.listContextSources({
    workspaceId,
    businessId,
  })
}

export async function getSource(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  sourceId: string,
): Promise<{ ok: true; data: ContextSource | null } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  return repo.getContextSource(workspaceId, sourceId)
}

export async function processSource(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  sourceId: string,
): Promise<{ ok: true; data: ContextJob } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const source = await repo.getContextSource(workspaceId, sourceId)
  if (!source.ok) return source
  if (!source.data || source.data.businessId !== businessId) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Source not found' } }
  }

  const idempotencyKey = `process-${sourceId}-${Date.now()}`

  const jobResult = await repo.createContextJob({
    workspaceId,
    businessId,
    sessionId: null,
    jobType: 'source_processing',
    status: JobStatus.QUEUED,
    attemptCount: 0,
    maxAttempts: 3,
    idempotencyKey,
    stage: SourceProcessingStage.QUEUED,
    input: { sourceId, sourceType: source.data.sourceType },
    output: null,
    error: null,
    errorClass: null,
    retryPolicy: {},
    nextRunAt: null,
    lockedBy: null,
    lockedAt: null,
    heartbeatAt: null,
    stageTimeoutSeconds: null,
    startedAt: null,
    completedAt: null,
  })

  if (!jobResult.ok) return jobResult

  await repo.updateContextSource(workspaceId, sourceId, {
    status: 'queued',
    currentStage: SourceProcessingStage.QUEUED,
  })

  return jobResult
}

export async function archiveSource(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  sourceId: string,
): Promise<{ ok: true; data: ContextSource } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const source = await repo.getContextSource(workspaceId, sourceId)
  if (!source.ok) return source
  if (!source.data || source.data.businessId !== businessId) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Source not found' } }
  }

  return repo.updateContextSource(workspaceId, sourceId, {
    status: 'archived',
    terminalOutcome: 'archived' as any,
  })
}

export async function queueScan(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<{ ok: true; data: ContextJob[] } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const sourcesResult = await repo.listContextSources({
    workspaceId,
    businessId,
    status: 'registered',
  })
  if (!sourcesResult.ok) return sourcesResult

  const jobs: ContextJob[] = []
  for (const source of sourcesResult.data.items) {
    const idempotencyKey = `scan-${source.id}-${Date.now()}`

    const jobResult = await repo.createContextJob({
      workspaceId,
      businessId,
      sessionId: null,
      jobType: 'source_processing',
      status: JobStatus.QUEUED,
      attemptCount: 0,
      maxAttempts: 3,
      idempotencyKey,
      stage: SourceProcessingStage.QUEUED,
      input: { sourceId: source.id, sourceType: source.sourceType },
      output: null,
      error: null,
      errorClass: null,
      retryPolicy: {},
      nextRunAt: null,
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
      stageTimeoutSeconds: null,
      startedAt: null,
      completedAt: null,
    })

    if (jobResult.ok) {
      jobs.push(jobResult.data)
      await repo.updateContextSource(workspaceId, source.id, {
        status: 'queued',
        currentStage: SourceProcessingStage.QUEUED,
      })
    }
  }

  return { ok: true, data: jobs }
}
