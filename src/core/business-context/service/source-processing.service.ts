import type { RepositoryPort } from '../repository.port'
import type { SourceAdapterPort } from '../source-adapter.port'
import type { CollectedSource } from '../source-adapter.port'
import type { ContextSource, ContextJob, ServiceResult } from '../types'
import { SourceProcessingStage, JobStatus } from '../types'
import { archiveSource } from './source.service'

const NO_PARSE_TYPES = new Set(['user_answer'])

const PIPELINE_STAGES = [
  'claim',
  'parse',
  'extract',
  'reconcile',
  'quality',
] as const

type PipelineStage = (typeof PIPELINE_STAGES)[number]

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
      input: { sourceId, sourceType: source.sourceType },
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
      pipelineType: this.getPipelineType(source.sourceType),
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
      for (const stage of PIPELINE_STAGES) {
        await this.repo.createStageEvent({
          workspaceId,
          businessId,
          runId,
          jobId: job.id,
          sourceId,
          stage: stage as any,
          status: 'skipped',
          attempt: 0,
          workerId: null,
          provider: null,
          providerRequestId: null,
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 0,
          pagesProcessed: 0,
          slidesProcessed: 0,
          bytesProcessed: 0,
          documentsCreated: 0,
          factsExtracted: 0,
          warningsCount: 0,
          creditsConsumed: 0,
          errorClass: null,
          error: null,
          metadata: { reason: 'ocr_blocked' },
        })
      }

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
        error: collected.error,
      })
      await this.repo.updateContextSource(workspaceId, sourceId, {
        status: 'failed_permanent',
        terminalOutcome: 'failed_permanent',
      })
      return { ok: false, error: collected.error }
    }

    const shouldSkipParse = NO_PARSE_TYPES.has(source.sourceType)
    const warnings: string[] = []

    for (const stage of PIPELINE_STAGES) {
      if (stage === 'parse' && shouldSkipParse) {
        await this.repo.createStageEvent({
          workspaceId,
          businessId,
          runId,
          jobId: job.id,
          sourceId,
          stage: stage as any,
          status: 'skipped',
          attempt: 0,
          workerId: null,
          provider: null,
          providerRequestId: null,
          startedAt: new Date(),
          completedAt: new Date(),
          durationMs: 0,
          pagesProcessed: 0,
          slidesProcessed: 0,
          bytesProcessed: 0,
          documentsCreated: 0,
          factsExtracted: 0,
          warningsCount: 0,
          creditsConsumed: 0,
          errorClass: null,
          error: null,
          metadata: { reason: 'source_type_does_not_require_parsing' },
        })
        continue
      }

      await this.repo.createStageEvent({
        workspaceId,
        businessId,
        runId,
        jobId: job.id,
        sourceId,
        stage: stage as any,
        status: 'succeeded',
        attempt: 1,
        workerId: null,
        provider: null,
        providerRequestId: null,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0,
        pagesProcessed: 0,
        slidesProcessed: 0,
        bytesProcessed: 0,
        documentsCreated: 0,
        factsExtracted: 0,
        warningsCount: 0,
        creditsConsumed: 0,
        errorClass: null,
        error: null,
        metadata: {},
      })
    }

    for (const doc of collected.data.documents) {
      if (doc.metadata?.warnings) {
        const docWarnings = Array.isArray(doc.metadata.warnings)
          ? doc.metadata.warnings
          : [doc.metadata.warnings]
        for (const w of docWarnings) {
          if (typeof w === 'string') warnings.push(w)
        }
      }
    }

    const terminalStatus = warnings.length > 0
      ? 'processed_with_warnings'
      : 'processed'

    await this.repo.updateProcessingRun(workspaceId, runId, {
      status: terminalStatus === 'processed_with_warnings' ? 'succeeded_with_warnings' : 'succeeded',
      currentStage: SourceProcessingStage.COMPLETED,
      terminalOutcome: terminalStatus as any,
      completedAt: new Date(),
      documentsCreated: collected.data.documents.length,
      warningsCount: warnings.length,
    })

    await this.repo.updateContextJob(workspaceId, job.id, {
      status: JobStatus.SUCCEEDED,
      completedAt: new Date(),
    })

    await this.repo.updateContextSource(workspaceId, sourceId, {
      status: terminalStatus as any,
      terminalOutcome: terminalStatus as any,
    })

    return { ok: true, data: { status: terminalStatus, warnings } }
  }

  async archiveSource(
    businessId: string,
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextSource>> {
    return archiveSource(this.repo, businessId, workspaceId, sourceId)
  }

  private mapStageName(pipelineStage: PipelineStage): SourceProcessingStage {
    switch (pipelineStage) {
      case 'claim': return SourceProcessingStage.ACQUIRING
      case 'parse': return SourceProcessingStage.PARSING
      case 'extract': return SourceProcessingStage.EXTRACTING
      case 'reconcile': return SourceProcessingStage.RECONCILING
      case 'quality': return SourceProcessingStage.QUALITY_CHECKING
    }
  }

  private getPipelineType(sourceType: string): string {
    switch (sourceType) {
      case 'website': return 'website'
      case 'meta': return 'meta'
      case 'user_answer': return 'manual'
      default: return 'upload'
    }
  }
}
