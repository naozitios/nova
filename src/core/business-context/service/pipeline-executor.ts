import type { RepositoryPort } from '../repository.port'
import type { CollectedSource } from '../source-adapter.port'
import type { ServiceResult, StageEvent } from '../types'
import { SourceProcessingStage, StageEventStatus } from '../types'
import type { JsonValue } from '../types'
import type { PipelineStage } from './source-processing.types'

interface StageEventBase {
  workspaceId: string
  businessId: string
  runId: string
  jobId: string
  sourceId: string
}

function baseStageEvent(
  base: StageEventBase,
  pipelineStage: PipelineStage,
  status: StageEventStatus,
  metadata: Record<string, JsonValue> = {},
): Omit<StageEvent, 'id'> {
  return {
    ...base,
    stage: pipelineStage as SourceProcessingStage,
    status,
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
    errorClass: null,
    error: null,
    metadata,
  }
}

export async function createSkippedStageEvents(
  repo: RepositoryPort,
  base: StageEventBase,
  stages: readonly PipelineStage[],
  reason: string,
): Promise<ServiceResult<void>> {
  for (const stage of stages) {
    const result = await repo.createStageEvent(baseStageEvent(base, stage, StageEventStatus.SKIPPED, { reason }))
    if (!result.ok) return result
  }
  return { ok: true, data: undefined }
}

export async function createSucceededStageEvents(
  repo: RepositoryPort,
  base: StageEventBase,
  stages: readonly PipelineStage[],
): Promise<ServiceResult<void>> {
  for (const stage of stages) {
    const result = await repo.createStageEvent(baseStageEvent(base, stage, StageEventStatus.SUCCEEDED, {}))
    if (!result.ok) return result
  }
  return { ok: true, data: undefined }
}

export async function createMixedStageEvents(
  repo: RepositoryPort,
  base: StageEventBase,
  stages: readonly PipelineStage[],
  skipStage: string | null,
  skipReason: string,
): Promise<ServiceResult<void>> {
  for (const stage of stages) {
    let result: ServiceResult<StageEvent>
    if (stage === skipStage) {
      result = await repo.createStageEvent(baseStageEvent(base, stage, StageEventStatus.SKIPPED, { reason: skipReason }))
    } else {
      result = await repo.createStageEvent(baseStageEvent(base, stage, StageEventStatus.SUCCEEDED, {}))
    }
    if (!result.ok) return result
  }
  return { ok: true, data: undefined }
}

export function extractDocumentWarnings(collected: CollectedSource): string[] {
  const warnings: string[] = []
  for (const doc of collected.documents) {
    if (doc.metadata?.warnings) {
      const docWarnings = Array.isArray(doc.metadata.warnings)
        ? doc.metadata.warnings
        : [doc.metadata.warnings]
      for (const w of docWarnings) {
        if (typeof w === 'string') warnings.push(w)
      }
    }
  }
  return warnings
}

export function buildJobInput(
  sourceId: string,
  sourceType: string,
): { sourceId: string; sourceType: string } {
  return { sourceId, sourceType }
}

export function serializeError(error: { code: string; message: string; details?: unknown }): string {
  return JSON.stringify(error)
}
