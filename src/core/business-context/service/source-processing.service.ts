import { createHash } from 'node:crypto'
import type { RepositoryPort } from '../repository.port'
import type { SourceAdapterPort } from '../source-adapter.port'
import type { CollectedSource, CollectedDocument } from '../source-adapter.port'
import type { ExtractionPort, ExtractedFact } from '../extraction.port'
import type { ContextSource, ContextJob, ServiceResult, JsonValue } from '../types'
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
import { runDocumentGates, runFactGates, hasBlockingFailures } from '../quality-gates'
import type { DocumentQualityInput } from '../quality-gates'
import { resolveFacts } from '../resolver'

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
    options?: { sessionId?: string },
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
          await this.repo.updateContextJob(workspaceId, job.id, {
            status: JobStatus.FAILED_PERMANENT,
            error: serializeError(docResult.error),
          })
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

        for (const [factKey, newFacts] of byKey) {
          const matching = existingFacts.filter(
            (ef) => ef.factKey.toLowerCase().trim() === factKey,
          )

          const resolution = resolveFacts(matching, newFacts)

          // Persist new facts
          for (const f of resolution.toCreate) {
            await this.repo.createContextFact({
              workspaceId,
              businessId,
              factKey: f.factKey,
              value: f.value,
              sourceId,
              sourceDocumentId: null,
              sourceExcerpt: f.sourceExcerpt,
              evidenceLocator: f.evidenceLocator as JsonValue | null,
              confidence: f.confidence,
              verificationStatus: 'extracted',
              supersedesFactId: null,
              validFrom: new Date(),
              validTo: null,
              createdBy: 'system',
            })
            factsExtracted++
          }

          // Track conflicts
          if (resolution.conflicts.length > 0) {
            for (const c of resolution.conflicts) {
              conflictFactKeys.add(c.factKey)
            }
          }

          // Update superseded facts
          for (const s of resolution.superseded) {
            await this.repo.updateContextFact(workspaceId, s.oldFactId, {
              verificationStatus: 'superseded',
              validTo: new Date(),
            })
          }
        }

        // Fact quality gates + lifecycle questions
        const persistedFacts = await this.repo.listContextFacts({
          workspaceId,
          businessId,
          sourceId,
        })
        const facts = persistedFacts.ok ? persistedFacts.data.items : []

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

          // Create lifecycle questions for low-confidence or conflicting facts
          const needsQuestion =
            fact.confidence < 0.7 || hasConflict
          if (needsQuestion && options?.sessionId) {
            const reason = hasConflict
              ? `Conflicting values for "${fact.factKey}" — needs review`
              : `Low confidence (${fact.confidence}) for "${fact.factKey}" — needs verification`
            await this.repo.createOnboardingQuestion({
              workspaceId,
              sessionId: options?.sessionId ?? '',
              businessId,
              factKey: fact.factKey,
              questionType: hasConflict ? 'conflict_review' : 'confidence_review',
              question: `Please verify: ${fact.factKey} = ${JSON.stringify(fact.value)}`,
              options: null,
              reason,
              priority: hasConflict ? 10 : 5,
              status: 'open',
              answer: null,
              answeredBy: null,
              answeredAt: null,
            })
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
