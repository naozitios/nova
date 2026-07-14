// ─── Stage events (FR-043) ─────────────────────────────────────────────────
//
// Thin wrapper over ProcessingVisibilityWriter.appendStageEvent. Centralizes
// the input shape used by the runner so the facade and other modules don't
// duplicate the field mapping.

import type {
  JsonValue,
  SourceProcessingStage,
  StageEventStatus,
} from '@/core/business-context/types'
import { ProcessingVisibilityWriter } from '../processing-visibility'

export interface StageEventInput {
  workspaceId: string
  businessId: string
  runId: string
  jobId?: string | null
  sourceId: string
  stage: SourceProcessingStage
  status: StageEventStatus
  attempt: number
  workerId?: string | null
  provider?: string | null
  providerRequestId?: string | null
  startedAt: Date
  completedAt?: Date | null
  durationMs?: number | null
  pagesProcessed?: number
  slidesProcessed?: number
  bytesProcessed?: number
  documentsCreated?: number
  factsExtracted?: number
  warningsCount?: number
  creditsConsumed?: number
  errorClass?: string | null
  error?: unknown
  metadata?: Record<string, unknown>
}

export async function emitStageEvent(
  visibility: ProcessingVisibilityWriter,
  input: StageEventInput,
): Promise<void> {
  await visibility.appendStageEvent({
    workspaceId: input.workspaceId,
    businessId: input.businessId,
    runId: input.runId,
    jobId: input.jobId ?? null,
    sourceId: input.sourceId,
    stage: input.stage,
    status: input.status,
    attempt: input.attempt,
    workerId: input.workerId ?? null,
    provider: input.provider ?? null,
    providerRequestId: input.providerRequestId ?? null,
    startedAt: input.startedAt,
    completedAt: input.completedAt ?? null,
    durationMs: input.durationMs ?? null,
    pagesProcessed: input.pagesProcessed ?? 0,
    slidesProcessed: input.slidesProcessed ?? 0,
    bytesProcessed: input.bytesProcessed ?? 0,
    documentsCreated: input.documentsCreated ?? 0,
    factsExtracted: input.factsExtracted ?? 0,
    warningsCount: input.warningsCount ?? 0,
    creditsConsumed: input.creditsConsumed ?? 0,
    errorClass: input.errorClass ?? null,
    error: input.error ?? null,
    metadata: input.metadata ?? {},
  })
}
