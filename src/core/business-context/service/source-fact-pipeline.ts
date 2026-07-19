import type { RepositoryPort } from '../repository.port'
import type { ExtractionPort, ExtractedFact } from '../extraction.port'
import type { ContextFact, SourceType, ServiceResult, JsonValue } from '../types'
import type {
  PersistFactReconciliationConflict,
  PersistFactReconciliationCreate,
  PersistFactReconciliationSupersede,
} from '../repository/fact.port'
import { resolveFacts } from '../resolver'
import { computeQuestionLifecycle } from '../resolver/question-lifecycle'
import { runFactGates } from '../quality-gates'

export interface SourceFactPipelineDocument {
  sourceDocumentId: string
  contentText: string
  parserName: string
}

export interface SourceFactPipelineInput {
  workspaceId: string
  businessId: string
  sourceId: string
  sourceType: SourceType
  existingFacts: ContextFact[]
  runId: string | null
  sessionId: string | null
  documents: SourceFactPipelineDocument[]
}

export class SourceFactPipeline {
  constructor(
    private readonly repo: RepositoryPort,
    private readonly extractionPort: ExtractionPort,
  ) {}

  async process(
    input: SourceFactPipelineInput,
  ): Promise<ServiceResult<{ factsExtracted: number; warnings: string[] }>> {
    const warnings: string[] = []
    const allExtractedFacts: ExtractedFact[] = []
    const docIdByFact = new Map<ExtractedFact, string>()

    for (const doc of input.documents) {
      const extractionResult = await this.extractionPort.extractFacts({
        sourceDocumentId: doc.sourceDocumentId,
        sourceId: input.sourceId,
        businessId: input.businessId,
        workspaceId: input.workspaceId,
        contentText: doc.contentText,
        sourceType: input.sourceType,
        parserName: doc.parserName,
      })

      if (!extractionResult.ok) {
        return extractionResult
      }

      for (const fact of extractionResult.data.facts) {
        allExtractedFacts.push(fact)
        docIdByFact.set(fact, doc.sourceDocumentId)
      }
      warnings.push(...(extractionResult.data.warnings ?? []))
    }

    if (allExtractedFacts.length === 0) {
      return { ok: true, data: { factsExtracted: 0, warnings } }
    }

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
    const supersededIdsByFactKey = new Map<string, string[]>()

    for (const [factKey, newFacts] of byKey) {
      const matching = input.existingFacts.filter(
        (ef) => ef.factKey.toLowerCase().trim() === factKey,
      )

      // Meta source conflict handling (user-verified facts)
      if (input.sourceType === 'meta') {
        const activeDifferent = matching.filter(
          (ef) =>
            ef.verificationStatus !== 'superseded' &&
            ef.verificationStatus !== 'rejected' &&
            newFacts.some((nf) => JSON.stringify(nf.value) !== JSON.stringify(ef.value)),
        )
        if (activeDifferent.length > 0) {
          conflictFactKeys.add(factKey)
          toConflicts.push({ factKey, factIds: activeDifferent.map((f) => f.id) })
          continue
        }
      }

      const resolution = resolveFacts(matching, newFacts)

      for (const s of resolution.superseded) {
        toSupersede.push({ oldFactId: s.oldFactId })
        const existing = supersededIdsByFactKey.get(factKey) ?? []
        existing.push(s.oldFactId)
        supersededIdsByFactKey.set(factKey, existing)
      }

      for (const f of resolution.toCreate) {
        const supersededIds = supersededIdsByFactKey.get(factKey)
        toCreate.push({
          factKey: f.factKey,
          value: f.value,
          sourceId: input.sourceId,
          sourceExcerpt: f.sourceExcerpt,
          evidenceLocator: f.evidenceLocator as JsonValue | null,
          confidence: f.confidence,
          supersedesFactId: supersededIds?.[0] ?? null,
          sourceDocumentId: docIdByFact.get(f) ?? null,
        })
      }

      if (resolution.conflicts.length > 0) {
        for (const c of resolution.conflicts) {
          conflictFactKeys.add(c.factKey)
          toConflicts.push({ factKey: c.factKey, factIds: c.factIds })
        }
      }
    }

    let factsExtracted = 0
    if (toCreate.length > 0 || toSupersede.length > 0 || toConflicts.length > 0) {
      const reconcResult = await this.repo.persistFactReconciliation(
        input.workspaceId,
        input.businessId,
        toSupersede,
        toCreate,
        toConflicts,
      )
      if (!reconcResult.ok) return reconcResult
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

    // Fetch persisted facts when needed for gates or question lifecycle
    const gapKeys: string[] = []
    const needsFactLookup = input.runId !== null || !!input.sessionId
    if (needsFactLookup) {
      const persistedFacts = await this.repo.listContextFacts({
        workspaceId: input.workspaceId,
        businessId: input.businessId,
        sourceId: input.sourceId,
      })
      if (!persistedFacts.ok) return persistedFacts
      const facts = persistedFacts.data.items

      for (const fact of facts) {
        const hasConflict = conflictFactKeys.has(fact.factKey)

        // Fact quality gates — only when a runId exists
        if (input.runId !== null) {
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
            const gateResult = await this.repo.createQualityGateResult({
              workspaceId: input.workspaceId,
              businessId: input.businessId,
              runId: input.runId,
              sourceId: input.sourceId,
              sourceDocumentId: null,
              factId: fact.id,
              gateScope: gate.gateScope,
              gateName: gate.gateName,
              status: gate.status,
              measuredValue: gate.measuredValue,
              threshold: gate.threshold,
              reason: gate.reason,
            })
            if (!gateResult.ok) return gateResult
          }
        }

        if (fact.confidence < 0.7 || hasConflict) {
          gapKeys.push(fact.factKey)
        }
      }
    }

    // Question lifecycle
    if (input.sessionId) {
      const existingQs = await this.repo.listOnboardingQuestions({
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
      })
      if (!existingQs.ok) return existingQs
      const existingQuestions = existingQs.data.items

      const lifecycle = computeQuestionLifecycle({
        gaps: gapKeys,
        existingQuestions,
        businessId: input.businessId,
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
      })

      for (const q of lifecycle.toCreate) {
        const qResult = await this.repo.createOnboardingQuestion(q)
        if (!qResult.ok) return qResult
      }
      for (const questionId of lifecycle.toDismiss) {
        const dismissResult = await this.repo.dismissOnboardingQuestion(input.workspaceId, questionId)
        if (!dismissResult.ok) return dismissResult
      }
    }

    return { ok: true, data: { factsExtracted, warnings } }
  }
}
