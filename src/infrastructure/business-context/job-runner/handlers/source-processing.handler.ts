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
import type { SourceProcessingService } from '@/core/business-context/service/source-processing.service'

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

export function createSourceProcessingHandler(
  serviceOverride?: SourceProcessingService,
): JobHandler {
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

    // Lazy-resolve service to avoid static Container import cycle.
    // In tests, pass serviceOverride; in production, dynamic import() breaks the cycle.
    const service = serviceOverride
      ?? (await import('@/di/container')).Container.getSourceProcessingService()
    const result = await service.processSource(businessId, workspaceId, sourceId, { job })

    if (!result.ok) {
      const err = new Error(result.error.message) as Error & { code: string }
      err.code = result.error.code
      throw err
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
      status: result.data.status,
      warnings: result.data.warnings,
      stagesCompleted: PIPELINE_STAGES,
      completedAt: new Date().toISOString(),
    }

    if (result.data.status === 'blocked_needs_user_action') {
      return { output, stageEvents, terminalStatus: 'blocked_needs_user_action' }
    }

    return { output, stageEvents }
  }
}
