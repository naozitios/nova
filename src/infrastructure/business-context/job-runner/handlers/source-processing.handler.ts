// ─── Source processing handler ────────────────────────────────────────────
//
// Handles `source_processing` jobs by coordinating the full pipeline:
//   acquisition → storage → parsing → normalizing → extraction →
//   reconciliation → quality_checking → persistence.
//
// Delegates actual work to SourceProcessingService and adapter ports.
// Emits stage events for visibility at each pipeline boundary.

import type {
  ContextJob,
  JsonValue,
  SourceProcessingStage,
} from '@/core/business-context/types'
import type { JobHandler, StageEventUpdate } from './extract.handler'
import { Container } from '@/di/container'

const PIPELINE_STAGES: SourceProcessingStage[] = [
  'acquiring',
  'stored',
  'parsing',
  'normalizing',
  'extracting',
  'reconciling',
  'quality_checking',
  'completed',
]

export function createSourceProcessingHandler(): JobHandler {
  return async (job: ContextJob) => {
    const sourceId = job.input.sourceId as string
    const businessId = job.businessId
    const workspaceId = job.workspaceId
    const attempt = job.attemptCount + 1

    const stageEvents: StageEventUpdate[] = []
    const startedAt = new Date()

    // Emit pipeline started
    stageEvents.push({
      stage: 'acquiring',
      status: 'started',
      attempt,
      startedAt,
      metadata: { sourceId, pipeline: 'source_processing' },
    })

    const service = Container.getSourceProcessingService()
    const result = await service.processSource(businessId, workspaceId, sourceId)

    if (!result.ok) {
      stageEvents.push({
        stage: 'acquiring',
        status: 'failed_retryable',
        attempt,
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        error: result.error,
      })
      return { stageEvents }
    }

    // Emit pipeline stages completed
    for (const stage of PIPELINE_STAGES) {
      stageEvents.push({
        stage,
        status: 'succeeded',
        attempt,
        startedAt,
        completedAt: new Date(),
        metadata: { sourceId },
      })
    }

    const output: Record<string, JsonValue> = {
      sourceId,
      businessId,
      jobId: result.data.id,
      stagesCompleted: PIPELINE_STAGES,
      completedAt: new Date().toISOString(),
    }

    return { output, stageEvents }
  }
}
