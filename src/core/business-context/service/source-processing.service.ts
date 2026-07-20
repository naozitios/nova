import { createHash } from 'node:crypto'
import type { RepositoryPort } from '../repository.port'
import type { SourceAdapterPort } from '../source-adapter.port'
import type { CollectedSource } from '../source-adapter.port'
import type { DocumentParserPort } from '../document-parser.port'
import type { ExtractionPort } from '../extraction.port'
import type { ContextSource, ContextJob, ServiceResult, JsonValue, SourceType } from '../types'
import type { CanonicalDocumentIndexer } from './canonical-document-indexer'
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
import { runDocumentGates } from '../quality-gates'
import type { DocumentQualityInput } from '../quality-gates'
import type { UploadedDocumentProcessor } from './uploaded-document.processor'
import type { SourceFactPipelineDocument } from './source-fact-pipeline'
import {
  SourceFactPipeline,
} from './source-fact-pipeline'

/** Shared timeout for source-processing stages (30s heartbeat, 2× stale threshold). */
const STAGE_TIMEOUT_SECONDS = 30

export class SourceProcessingService {
  private readonly adapters: SourceAdapterPort[] = []

  constructor(
    private readonly repo: RepositoryPort,
    private readonly extractionPort?: ExtractionPort,
    private readonly uploadedProcessor?: UploadedDocumentProcessor,
    private readonly factPipeline?: SourceFactPipeline,
    private readonly documentParser?: DocumentParserPort,
    private readonly documentIndexer?: CanonicalDocumentIndexer,
  ) {}

  private _effectiveFactPipeline: SourceFactPipeline | null = null

  private get effectiveFactPipeline(): SourceFactPipeline | undefined {
    if (this._effectiveFactPipeline === null) {
      this._effectiveFactPipeline = this.factPipeline
        ?? (this.extractionPort ? new SourceFactPipeline(this.repo, this.extractionPort) : undefined)
        ?? null
    }
    return this._effectiveFactPipeline ?? undefined
  }

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
    options?: { sessionId?: string; job?: ContextJob },
  ): Promise<ServiceResult<{ status: string; warnings: string[] }>> {
    const sourceResult = await this.repo.getContextSource(workspaceId, sourceId)
    if (!sourceResult.ok) return sourceResult
    if (!sourceResult.data || sourceResult.data.businessId !== businessId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Source not found' } }
    }

    const source = sourceResult.data
    let job: ContextJob

    if (options?.job) {
      job = options.job
    } else {
      const idempotencyKey = `process-${sourceId}-${Date.now()}`

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
      stageTimeoutSeconds: STAGE_TIMEOUT_SECONDS,
      startedAt: null,
      completedAt: null,
    })
    if (!jobResult.ok) return jobResult
      job = jobResult.data
    }

    await this.repo.updateContextSource(workspaceId, sourceId, {
      status: 'processing',
    })

    let runId: string

    if (options?.job) {
      // Reuse existing processing run from the first attempt so stage events
      // from failure and recovery land on the same run.
      const existingRuns = await this.repo.listProcessingRuns(
        { workspaceId, businessId, sourceId, jobId: job.id },
        { limit: 1, offset: 0 },
      )
      if (existingRuns.ok && existingRuns.data.items.length > 0) {
        runId = existingRuns.data.items[0].id
        await this.repo.updateProcessingRun(workspaceId, runId, {
          status: 'running',
          currentStage: SourceProcessingStage.QUEUED,
        })
      } else {
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
        if (!runResult.data?.id) {
          return {
            ok: false,
            error: { code: 'INTERNAL_ERROR', message: 'createProcessingRun succeeded but returned no ID' },
          }
        }
        runId = runResult.data.id
      }
    } else {
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
      if (!runResult.data?.id) {
        return {
          ok: false,
          error: { code: 'INTERNAL_ERROR', message: 'createProcessingRun succeeded but returned no ID' },
        }
      }
      runId = runResult.data.id
    }

    const needsOcrBlock = source.metadata?.ocrRequired === true && source.metadata?.ocrResolved === false

    if (needsOcrBlock) {
      const stageResult = await createSkippedStageEvents(
        this.repo,
        { workspaceId, businessId, runId, jobId: job.id, sourceId },
        PIPELINE_STAGES,
        'ocr_blocked',
      )
      if (!stageResult.ok) return stageResult

      await this.repo.updateProcessingRun(workspaceId, runId, {
        status: 'blocked',
        currentStage: SourceProcessingStage.EXTRACTING,
        terminalOutcome: 'blocked_needs_user_action',
        completedAt: new Date(),
      })

      if (!options?.job) {
        await this.repo.updateContextJob(workspaceId, job.id, {
          status: JobStatus.FAILED_PERMANENT,
          completedAt: new Date(),
        })
      }

      await this.repo.updateContextSource(workspaceId, sourceId, {
        status: 'blocked_needs_user_action',
        terminalOutcome: 'blocked_needs_user_action',
      })

      return { ok: true, data: { status: 'blocked_needs_user_action', warnings: [] } }
    }

    // Route uploaded documents through single-document processor
    const jobInput = job.input as Record<string, unknown> | null
    const documentId = typeof jobInput?.documentId === 'string' && jobInput.documentId.length > 0
      ? jobInput.documentId
      : undefined
    if (documentId) {
      if (!this.uploadedProcessor) {
        return { ok: false, error: { code: 'NO_PROCESSOR', message: 'UploadedDocumentProcessor not injected' } }
      }

      const processorResult = await this.uploadedProcessor.process({
        workspaceId,
        businessId,
        sourceId,
        documentId,
        runId,
        sessionId: options?.sessionId ?? job.sessionId ?? undefined,
      })

      // Update run status based on processor result
      if (processorResult.ok) {
        await this.repo.updateProcessingRun(workspaceId, runId, {
          status: processorResult.data.status === 'processed_with_warnings' ? 'succeeded_with_warnings' : 'succeeded',
          currentStage: SourceProcessingStage.COMPLETED,
          terminalOutcome: processorResult.data.status as 'processed' | 'processed_with_warnings',
          completedAt: new Date(),
          documentsCreated: 1,
        })

        if (!options?.job) {
          await this.repo.updateContextJob(workspaceId, job.id, {
            status: JobStatus.SUCCEEDED,
            completedAt: new Date(),
          })
        }

        await this.repo.updateContextSource(workspaceId, sourceId, {
          status: processorResult.data.status,
          terminalOutcome: processorResult.data.status as 'processed' | 'processed_with_warnings',
        })
      } else {
        await this.repo.updateProcessingRun(workspaceId, runId, {
          status: 'failed',
          terminalOutcome: 'failed_permanent',
          completedAt: new Date(),
        })

        if (!options?.job) {
          await this.repo.updateContextJob(workspaceId, job.id, {
            status: JobStatus.FAILED_PERMANENT,
            error: serializeError(processorResult.error),
          })
        }

        await this.repo.updateContextSource(workspaceId, sourceId, {
          status: 'failed_permanent',
          terminalOutcome: 'failed_permanent',
        })
      }

      return processorResult
    }

    const collected = await this.collectWithAdapter(workspaceId, businessId, source)
    if (!collected.ok) {
      await this.repo.updateProcessingRun(workspaceId, runId, {
        status: 'failed',
        terminalOutcome: 'failed_permanent',
        completedAt: new Date(),
      })

      await this.repo.createStageEvent({
        workspaceId,
        businessId,
        runId,
        jobId: job.id,
        sourceId,
        stage: PIPELINE_STAGES[0] as SourceProcessingStage,
        status: 'failed_permanent',
        attempt: 0,
        workerId: null,
        provider: null,
        providerRequestId: null,
        startedAt: new Date(),
        completedAt: new Date(),
        durationMs: null,
        pagesProcessed: 0,
        slidesProcessed: 0,
        bytesProcessed: 0,
        documentsCreated: 0,
        factsExtracted: 0,
        warningsCount: 0,
        creditsConsumed: 0,
        errorClass: collected.error.code.toLowerCase(),
        error: serializeError(collected.error),
        metadata: {},
      })

      if (!options?.job) {
        await this.repo.updateContextJob(workspaceId, job.id, {
          status: JobStatus.FAILED_PERMANENT,
          error: serializeError(collected.error),
        })
      }
      await this.repo.updateContextSource(workspaceId, sourceId, {
        status: 'failed_permanent',
        terminalOutcome: 'failed_permanent',
      })
      return { ok: false, error: collected.error }
    }

    const shouldSkipParse = NO_PARSE_TYPES.has(source.sourceType)

    if (shouldSkipParse) {
      const stageResult = await createMixedStageEvents(
        this.repo,
        { workspaceId, businessId, runId, jobId: job.id, sourceId },
        PIPELINE_STAGES,
        'parse',
        'source_type_does_not_require_parsing',
      )
      if (!stageResult.ok) return stageResult
    } else {
      const stageResult = await createSucceededStageEvents(
        this.repo,
        { workspaceId, businessId, runId, jobId: job.id, sourceId },
        PIPELINE_STAGES,
      )
      if (!stageResult.ok) return stageResult
    }

    // ── B31 pipeline: persistence, quality gates, fact extraction ──────────

    let factsExtracted = 0
    const warnings: string[] = []

    if (this.extractionPort && !shouldSkipParse) {
      const existingFactsResult = await this.repo.listContextFacts({
        workspaceId,
        businessId,
      })
      const existingFacts = existingFactsResult.ok ? existingFactsResult.data.items : []

      const persistedDocs: SourceFactPipelineDocument[] = []

      for (let i = 0; i < collected.data.documents.length; i++) {
        const doc = collected.data.documents[i]

        const hasRaw = !!(doc.rawContent && doc.rawMimeType && this.documentParser && this.documentIndexer)

        let canonicalContent = doc.contentText ?? ''
        let effectiveParserName = 'passthrough'
        let effectiveParserVersion = '1.0.0'

        if (hasRaw) {
          const parseResult = await this.documentParser.parseContent({
            content: Buffer.from(doc.rawContent!, 'utf-8'),
            mimeType: doc.rawMimeType!,
          })
          if (!parseResult.ok) {
            if (!options?.job) {
              await this.repo.updateContextJob(workspaceId, job.id, {
                status: JobStatus.FAILED_PERMANENT,
                error: serializeError(parseResult.error),
              })
            }
            await this.repo.updateContextSource(workspaceId, sourceId, {
              status: 'failed_permanent',
              terminalOutcome: 'failed_permanent',
            })
            return { ok: false, error: parseResult.error }
          }
          canonicalContent = parseResult.data.contentText
          effectiveParserName = parseResult.data.parserName
          effectiveParserVersion = parseResult.data.parserVersion
        }

        const contentHash = createHash('sha256').update(canonicalContent).digest('hex')

        const docResult = await this.repo.createSourceDocument({
          workspaceId,
          businessId,
          sourceId,
          url: doc.url ?? null,
          title: doc.title ?? null,
          documentType: null,
          mimeType: doc.mimeType ?? null,
          fileName: doc.fileName ?? null,
          fileSizeBytes: doc.fileSizeBytes ?? null,
          contentText: canonicalContent,
          storagePath: null,
          processedStoragePath: null,
          processingStatus: 'pending',
          embeddingModel: null,
          indexedAt: null,
          contentHash,
          httpStatus: doc.httpStatus ?? null,
          pageOrSlideCount: doc.pageOrSlideCount ?? null,
          parserName: effectiveParserName,
          parserVersion: effectiveParserVersion,
          effectiveAt: new Date(),
          supersedesDocumentId: null,
          metadata: (doc.metadata ?? {}) as Record<string, JsonValue>,
          retrievedAt: new Date(),
        })

        if (!docResult.ok) {
          if (!options?.job) {
            await this.repo.updateContextJob(workspaceId, job.id, {
              status: JobStatus.FAILED_PERMANENT,
              error: serializeError(docResult.error),
            })
          }
          await this.repo.updateContextSource(workspaceId, sourceId, {
            status: 'failed_permanent',
            terminalOutcome: 'failed_permanent',
          })
          return { ok: false, error: docResult.error }
        }

        const persistedDocId = docResult.data.id

        if (hasRaw) {
          const pathId = createHash('sha256').update(doc.url ?? doc.fileName ?? contentHash).digest('hex').slice(0, 16)
          const processedPath = `websites/${workspaceId}/${businessId}/${sourceId}/${pathId}.md`
          const indexResult = await this.documentIndexer.index({
            workspaceId,
            businessId,
            documentId: persistedDocId,
            markdown: canonicalContent,
            processedStoragePath: processedPath,
            parserName: effectiveParserName,
            parserVersion: effectiveParserVersion,
            pageOrSlideCount: doc.pageOrSlideCount ?? null,
            baseLocator: doc.url ? { url: doc.url } : undefined,
          })
          if (!indexResult.ok) {
            if (!options?.job) {
              await this.repo.updateContextJob(workspaceId, job.id, {
                status: JobStatus.FAILED_PERMANENT,
                error: serializeError(indexResult.error),
              })
            }
            await this.repo.updateContextSource(workspaceId, sourceId, {
              status: 'failed_permanent',
              terminalOutcome: 'failed_permanent',
            })
            return indexResult
          }
        }

        persistedDocs.push({
          sourceDocumentId: persistedDocId,
          contentText: canonicalContent,
          parserName: effectiveParserName,
        })

        const docGateInput: DocumentQualityInput = {
          sourceDocumentId: persistedDocId,
          mimeType: doc.mimeType ?? 'text/plain',
          contentHash,
          contentText: canonicalContent,
          pageOrSlideCount: doc.pageOrSlideCount ?? null,
          pagesProcessed: 1,
          slidesProcessed: 0,
          parserWarnings: [],
          ocrConfidence: null,
          evidenceLocatorsPresent: false,
          truncationDetected: false,
        }

        const docGates = runDocumentGates(docGateInput)
        for (const gate of docGates) {
          await this.repo.createQualityGateResult({
            workspaceId,
            businessId,
            runId,
            sourceId,
            sourceDocumentId: persistedDocId,
            factId: null,
            gateScope: gate.gateScope,
            gateName: gate.gateName,
            status: gate.status,
            measuredValue: gate.measuredValue,
            threshold: gate.threshold,
            reason: gate.reason,
          })
        }
      }

      if (this.effectiveFactPipeline) {
        const pipelineResult = await this.effectiveFactPipeline.process({
          workspaceId,
          businessId,
          sourceId,
          sourceType: source.sourceType as SourceType,
          existingFacts,
          runId,
          sessionId: options?.sessionId ?? options?.job?.sessionId ?? null,
          documents: persistedDocs,
        })

        if (pipelineResult.ok) {
          factsExtracted = pipelineResult.data.factsExtracted
          warnings.push(...pipelineResult.data.warnings)
        } else {
          if (!options?.job) {
            await this.repo.updateContextJob(workspaceId, job.id, {
              status: JobStatus.FAILED_PERMANENT,
              error: serializeError(pipelineResult.error),
            })
          }
          await this.repo.updateContextSource(workspaceId, sourceId, {
            status: 'failed_permanent',
            terminalOutcome: 'failed_permanent',
          })
          return pipelineResult
        }
      }
    }

    warnings.push(...extractDocumentWarnings(collected.data))

    const terminalStatus = warnings.length > 0
      ? 'processed_with_warnings'
      : 'processed'

    await this.repo.updateProcessingRun(workspaceId, runId, {
      status: terminalStatus === 'processed_with_warnings' ? 'succeeded_with_warnings' : 'succeeded',
      currentStage: SourceProcessingStage.COMPLETED,
      terminalOutcome: terminalStatus as 'processed' | 'processed_with_warnings',
      completedAt: new Date(),
      documentsCreated: collected.data.documents.length,
      factsExtracted,
      warningsCount: warnings.length,
    })

    if (!options?.job) {
      await this.repo.updateContextJob(workspaceId, job.id, {
        status: JobStatus.SUCCEEDED,
        completedAt: new Date(),
      })
    }

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
