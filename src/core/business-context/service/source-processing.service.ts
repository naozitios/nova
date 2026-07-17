import { createHash } from 'node:crypto'
import type { RepositoryPort } from '../repository.port'
import type { SourceAdapterPort } from '../source-adapter.port'
import type { CollectedSource } from '../source-adapter.port'
import type { ExtractionPort, ExtractedFact } from '../extraction.port'
import type {
  PersistFactReconciliationConflict,
  PersistFactReconciliationCreate,
  PersistFactReconciliationSupersede,
} from '../repository/fact.port'
import type { ContextSource, ContextJob, ServiceResult, JsonValue } from '../types'
import { SourceProcessingStage, JobStatus } from '../types'
import { computeQuestionLifecycle } from '../resolver/question-lifecycle'
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
import { runDocumentGates, runFactGates } from '../quality-gates'
import type { DocumentQualityInput } from '../quality-gates'
import { resolveFacts } from '../resolver'

/** Shared timeout for source-processing stages (30s heartbeat, 2× stale threshold). */
const STAGE_TIMEOUT_SECONDS = 30

export class SourceProcessingService {
  private readonly adapters: SourceAdapterPort[] = []

  constructor(
    private readonly repo: RepositoryPort,
    private readonly extractionPort?: ExtractionPort,
  ) {}

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

    // ── B31 pipeline: extraction, persistence, quality gates ──────────────

    let factsExtracted = 0
    const warnings: string[] = []

    if (this.extractionPort && !shouldSkipParse) {
      const allExtractedFacts: ExtractedFact[] = []
      const allDocumentGateInputs: DocumentQualityInput[] = []

      // Snapshot existing business facts BEFORE persisting new ones
      // so reconciliation compares against the true prior state
      const existingFactsResult = await this.repo.listContextFacts({
        workspaceId,
        businessId,
      })
      const existingFacts = existingFactsResult.ok ? existingFactsResult.data.items : []

      // Persist each collected document and run document quality gates
      for (let i = 0; i < collected.data.documents.length; i++) {
        const doc = collected.data.documents[i]
        const contentHash = createHash('sha256').update(doc.contentText ?? '').digest('hex')

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
          contentText: doc.contentText,
          storagePath: null,
          contentHash,
          httpStatus: doc.httpStatus ?? null,
          pageOrSlideCount: doc.pageOrSlideCount ?? null,
          parserName: 'passthrough',
          parserVersion: '1.0.0',
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

        // Document quality gates
        const docGateInput: DocumentQualityInput = {
          sourceDocumentId: persistedDocId,
          mimeType: doc.mimeType ?? 'text/plain',
          contentHash,
          contentText: doc.contentText,
          pageOrSlideCount: doc.pageOrSlideCount ?? null,
          pagesProcessed: 1,
          slidesProcessed: 0,
          parserWarnings: [],
          ocrConfidence: null,
          evidenceLocatorsPresent: false,
          truncationDetected: false,
        }
        allDocumentGateInputs.push(docGateInput)

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

        // Extract facts from each document
        const extractionResult = await this.extractionPort.extractFacts({
          sourceDocumentId: persistedDocId,
          sourceId,
          businessId,
          workspaceId,
          contentText: doc.contentText,
          sourceType: source.sourceType,
          parserName: 'passthrough',
        })

        if (extractionResult.ok) {
          allExtractedFacts.push(...extractionResult.data.facts)
        } else {
          warnings.push(`Extraction failed for document "${doc.title ?? doc.fileName ?? persistedDocId}": ${extractionResult.error.message}`)
        }
      }

      // Reconcile extracted facts against ALL existing business facts
      if (allExtractedFacts.length > 0) {

        // Group by fact key for reconciliation
        const byKey = new Map<string, ExtractedFact[]>()
        for (const f of allExtractedFacts) {
          const key = f.factKey.toLowerCase().trim()
          if (!byKey.has(key)) byKey.set(key, [])
          byKey.get(key)!.push(f)
        }

        const conflictFactKeys = new Set<string>()

        const toCreate: PersistFactReconciliationCreate[] = []
        const toSupersede: PersistFactReconciliationSupersede[] = []
        const toConflicts: PersistFactReconciliationConflict[] = []

        // Track which oldFactIds were superseded per key for provenance
        const supersededIdsByFactKey = new Map<string, string[]>()

        for (const [factKey, newFacts] of byKey) {
          const matching = existingFacts.filter(
            (ef) => ef.factKey.toLowerCase().trim() === factKey,
          )

          if (source.sourceType === 'meta') {
            const activeDifferent = matching.filter((ef) =>
              ef.verificationStatus !== 'superseded' &&
              ef.verificationStatus !== 'rejected' &&
              newFacts.some((nf) => JSON.stringify(nf.value) !== JSON.stringify(ef.value))
            )
            if (activeDifferent.length > 0) {
              conflictFactKeys.add(factKey)
              toConflicts.push({ factKey, factIds: activeDifferent.map((f) => f.id) })
              continue
            }
          }

          const resolution = resolveFacts(matching, newFacts)

          // Collect supersession payloads and track oldFactIds per key FIRST
          for (const s of resolution.superseded) {
            toSupersede.push({
              oldFactId: s.oldFactId,
            })
            const existing = supersededIdsByFactKey.get(factKey) ?? []
            existing.push(s.oldFactId)
            supersededIdsByFactKey.set(factKey, existing)
          }

          // Collect creation payloads with supersession provenance
          for (const f of resolution.toCreate) {
            const supersededIds = supersededIdsByFactKey.get(factKey)
            toCreate.push({
              factKey: f.factKey,
              value: f.value,
              sourceId,
              sourceExcerpt: f.sourceExcerpt,
              evidenceLocator: f.evidenceLocator as JsonValue | null,
              confidence: f.confidence,
              supersedesFactId: supersededIds?.[0] ?? null,
            })
          }

          // Track conflicts
          if (resolution.conflicts.length > 0) {
            for (const c of resolution.conflicts) {
              conflictFactKeys.add(c.factKey)
              toConflicts.push({ factKey: c.factKey, factIds: c.factIds })
            }
          }
        }

        // Batch persist all reconciled facts
        if (toCreate.length > 0 || toSupersede.length > 0 || toConflicts.length > 0) {
          const reconcResult = await this.repo.persistFactReconciliation(
            workspaceId,
            businessId,
            toSupersede,
            toCreate,
            toConflicts,
          )
          if (!reconcResult.ok) {
            if (!options?.job) {
              await this.repo.updateContextJob(workspaceId, job.id, {
                status: JobStatus.FAILED_PERMANENT,
                error: serializeError(reconcResult.error),
              })
            }
            await this.repo.updateContextSource(workspaceId, sourceId, {
              status: 'failed_permanent',
              terminalOutcome: 'failed_permanent',
            })
            return { ok: false, error: reconcResult.error }
          }
          if (!Array.isArray(reconcResult.data.created_fact_ids)) {
            return {
              ok: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Reconciliation RPC returned success but payload missing created_fact_ids',
              },
            }
          }
          factsExtracted += reconcResult.data.created_fact_ids.length
        }

        // Fact quality gates + lifecycle questions
        const persistedFacts = await this.repo.listContextFacts({
          workspaceId,
          businessId,
          sourceId,
        })
        const facts = persistedFacts.ok ? persistedFacts.data.items : []
        const gapKeys: string[] = []

        for (const fact of facts) {
          const hasConflict = conflictFactKeys.has(fact.factKey)
          const factGates = runFactGates({
            factId: fact.id,
            factKey: fact.factKey,
            value: fact.value,
            sourceId: fact.sourceId,
            sourceExcerpt: fact.sourceExcerpt,
            evidenceLocator: fact.evidenceLocator,
            confidence: fact.confidence,
            verificationStatus: fact.verificationStatus,
            hasConflict,
            supersedesFactId: fact.supersedesFactId,
          })

          for (const gate of factGates) {
            await this.repo.createQualityGateResult({
              workspaceId,
              businessId,
              runId,
              sourceId,
              sourceDocumentId: null,
              factId: fact.id,
              gateScope: gate.gateScope,
              gateName: gate.gateName,
              status: gate.status,
              measuredValue: gate.measuredValue,
              threshold: gate.threshold,
              reason: gate.reason,
            })
          }

          // Collect gap keys for lifecycle
          if (fact.confidence < 0.7 || hasConflict) {
            gapKeys.push(fact.factKey)
          }
        }

        // ── Question lifecycle: create only toCreate, dismiss only toDismiss ──
        const sessionId = options?.sessionId ?? options?.job?.sessionId ?? null
        if (sessionId) {
          const existingQs = await this.repo.listOnboardingQuestions({
            workspaceId,
            sessionId,
          })
          const existingQuestions = existingQs.ok ? existingQs.data.items : []

          const lifecycle = computeQuestionLifecycle({
            gaps: gapKeys,
            existingQuestions,
            businessId,
            workspaceId,
            sessionId,
          })

          for (const q of lifecycle.toCreate) {
            const qResult = await this.repo.createOnboardingQuestion(q)
            if (!qResult.ok) {
              return { ok: false, error: qResult.error }
            }
          }
          for (const questionId of lifecycle.toDismiss) {
            await this.repo.dismissOnboardingQuestion(workspaceId, questionId)
          }
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
