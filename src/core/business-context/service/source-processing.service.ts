import type { RepositoryPort } from '../repository.port'
import type { SourceAdapterPort } from '../source-adapter.port'
import type { CollectedSource } from '../source-adapter.port'
import type { ContextSource, ContextJob, ServiceResult } from '../types'
import { SourceProcessingStage, JobStatus } from '../types'
import { archiveSource } from './source.service'
import {
  NO_PARSE_TYPES,
  PIPELINE_STAGES,
  getPipelineType,
} from './source-processing.types'
import {
  createSkippedStageEvents,
  createMixedStageEvents,
  createSucceededStageEvents,
  extractDocumentWarnings,
  buildJobInput,
  serializeError,
} from './pipeline-executor'

export class SourceProcessingService {
  private readonly adapters: SourceAdapterPort[] = []

  constructor(private readonly repo: RepositoryPort) {}

  registerAdapter(adapter: SourceAdapterPort): void {
    this.adapters.push(adapter)
  }

  async collectWithAdapter(
    workspaceId: string,
    businessId: string,
    source: ContextSource,
  ): Promise<ServiceResult<CollectedSource>> {
    const adapter = this.adapters.find((a) => a.supports(source.sourceType))
    if (!adapter) {
      return {
        ok: false,
        error: { code: 'NO_ADAPTER', message: `No adapter registered for source type "${source.sourceType}"` },
      }
    }
    return adapter.collect({ workspaceId, businessId, source })
  }

  async processSource(
    businessId: string,
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<{ status: string; warnings: string[] }>> {
    const sourceResult = await this.repo.getContextSource(workspaceId, sourceId)
    if (!sourceResult.ok) return sourceResult
    if (!sourceResult.data || sourceResult.data.businessId !== businessId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Source not found' } }
    }

    const source = sourceResult.data
    const idempotencyKey = `process-${sourceId}-${Date.now()}`

    let job: ContextJob
    const existingJobResult = await this.repo.getContextJobByIdempotencyKey(idempotencyKey)
    if (existingJobResult.ok && existingJobResult.data) {
      job = existingJobResult.data
      await this.repo.updateContextSource(workspaceId, sourceId, {
        status: 'processing',
      })
      return { ok: true, data: { status: 'processing', warnings: [] } }
    }

    const jobResult = await this.repo.createContextJob({
      workspaceId,
      businessId,
      sessionId: null,
      jobType: 'source_processing',
      status: JobStatus.QUEUED,
      attemptCount: 0,
      maxAttempts: 3,
      idempotencyKey,
      stage: SourceProcessingStage.QUEUED,
      input: buildJobInput(sourceId, source.sourceType),
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
    job = jobResult.data

    await this.repo.updateContextSource(workspaceId, sourceId, {
      status: 'processing',
    })

    const runResult = await this.repo.createProcessingRun({
      workspaceId,
      businessId,
      sourceId,
      jobId: job.id,
      pipelineType: getPipelineType(source.sourceType),
      status: 'running',
      currentStage: SourceProcessingStage.QUEUED,
      terminalOutcome: null,
      attemptCount: 1,
      pagesProcessed: 0,
      slidesProcessed: 0,
      documentsCreated: 0,
      factsExtracted: 0,
      warningsCount: 0,
      creditsConsumed: 0,
      qualitySummary: {},
      startedAt: new Date(),
      completedAt: null,
    })

    if (!runResult.ok) return runResult
    const runId = runResult.data?.id ?? `run-${sourceId}-${Date.now()}`

    const needsOcrBlock = source.metadata?.ocrRequired === true && source.metadata?.ocrResolved === false

    if (needsOcrBlock) {
      await createSkippedStageEvents(
        this.repo,
        { workspaceId, businessId, runId, jobId: job.id, sourceId },
        PIPELINE_STAGES,
        'ocr_blocked',
      )

      await this.repo.updateProcessingRun(workspaceId, runId, {
        status: 'blocked',
        currentStage: SourceProcessingStage.EXTRACTING,
        terminalOutcome: 'blocked_needs_user_action',
        completedAt: new Date(),
      })

      await this.repo.updateContextJob(workspaceId, job.id, {
        status: JobStatus.FAILED_PERMANENT,
        completedAt: new Date(),
      })

      await this.repo.updateContextSource(workspaceId, sourceId, {
        status: 'blocked_needs_user_action',
        terminalOutcome: 'blocked_needs_user_action',
      })

      return { ok: true, data: { status: 'blocked_needs_user_action', warnings: [] } }
    }

    const collected = await this.collectWithAdapter(workspaceId, businessId, source)
    if (!collected.ok) {
      await this.repo.updateContextJob(workspaceId, job.id, {
        status: JobStatus.FAILED_PERMANENT,
        error: serializeError(collected.error),
      })
      await this.repo.updateContextSource(workspaceId, sourceId, {
        status: 'failed_permanent',
        terminalOutcome: 'failed_permanent',
      })
      return { ok: false, error: collected.error }
    }

    const shouldSkipParse = NO_PARSE_TYPES.has(source.sourceType)

    if (shouldSkipParse) {
      await createMixedStageEvents(
        this.repo,
        { workspaceId, businessId, runId, jobId: job.id, sourceId },
        PIPELINE_STAGES,
        'parse',
        'source_type_does_not_require_parsing',
      )
    } else {
      await createSucceededStageEvents(
        this.repo,
        { workspaceId, businessId, runId, jobId: job.id, sourceId },
        PIPELINE_STAGES,
      )
    }

    const warnings = extractDocumentWarnings(collected.data)

    const terminalStatus = warnings.length > 0
      ? 'processed_with_warnings'
      : 'processed'

    await this.repo.updateProcessingRun(workspaceId, runId, {
      status: terminalStatus === 'processed_with_warnings' ? 'succeeded_with_warnings' : 'succeeded',
      currentStage: SourceProcessingStage.COMPLETED,
      terminalOutcome: terminalStatus as 'processed' | 'processed_with_warnings',
      completedAt: new Date(),
      documentsCreated: collected.data.documents.length,
      warningsCount: warnings.length,
    })

    await this.repo.updateContextJob(workspaceId, job.id, {
      status: JobStatus.SUCCEEDED,
      completedAt: new Date(),
    })

    await this.repo.updateContextSource(workspaceId, sourceId, {
      status: terminalStatus,
      terminalOutcome: terminalStatus as 'processed' | 'processed_with_warnings',
    })

    return { ok: true, data: { status: terminalStatus, warnings } }
  }

  async archiveSource(
    businessId: string,
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextSource>> {
    return archiveSource(this.repo, businessId, workspaceId, sourceId) as Promise<ServiceResult<ContextSource>>
  }
}
