import type {
  ContextJob,
  ProcessingRun,
  ServiceResult,
  StageEvent,
} from '../types'
import type { PaginationParams, SortParams } from './repository.port'

export interface JobFilter {
  workspaceId: string
  businessId: string
  jobType?: string
  status?: string
}

export interface RunnableJobFilter {
  status: string
  jobType?: string
  lockedByIsNull?: boolean
  heartbeatExpired?: Date
}

export interface ProcessingRunFilter {
  workspaceId: string
  businessId: string
  sourceId?: string
  jobId?: string
  status?: string
}

export interface StageEventFilter {
  workspaceId: string
  businessId: string
  runId?: string
  jobId?: string
  sourceId?: string
  stage?: string
}

export interface JobRepositoryPort {
  createContextJob(
    data: Omit<ContextJob, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextJob>>

  getContextJob(
    workspaceId: string,
    jobId: string,
  ): Promise<ServiceResult<ContextJob | null>>

  getContextJobByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<ServiceResult<ContextJob | null>>

  listContextJobs(
    filter: JobFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextJob[]; total: number }>>

  claimRunnableJobs(
    filter: RunnableJobFilter,
    workerId: string,
    limit: number,
  ): Promise<ServiceResult<ContextJob[]>>

  updateContextJob(
    workspaceId: string,
    jobId: string,
    data: Partial<
      Pick<
        ContextJob,
        | 'status'
        | 'attemptCount'
        | 'output'
        | 'error'
        | 'errorClass'
        | 'nextRunAt'
        | 'lockedBy'
        | 'lockedAt'
        | 'heartbeatAt'
        | 'startedAt'
        | 'completedAt'
      >
    >,
  ): Promise<ServiceResult<ContextJob>>

  createStageEvent(
    data: Omit<StageEvent, 'id'>,
  ): Promise<ServiceResult<StageEvent>>

  listStageEvents(
    filter: StageEventFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: StageEvent[]; total: number }>>
}

export interface ProcessingRunRepositoryPort {
  createProcessingRun(
    data: Omit<ProcessingRun, 'id'>,
  ): Promise<ServiceResult<ProcessingRun>>

  getProcessingRun(
    workspaceId: string,
    runId: string,
  ): Promise<ServiceResult<ProcessingRun | null>>

  listProcessingRuns(
    filter: ProcessingRunFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'startedAt'>,
  ): Promise<ServiceResult<{ items: ProcessingRun[]; total: number }>>

  updateProcessingRun(
    workspaceId: string,
    runId: string,
    data: Partial<
      Pick<
        ProcessingRun,
        | 'status'
        | 'currentStage'
        | 'terminalOutcome'
        | 'attemptCount'
        | 'pagesProcessed'
        | 'slidesProcessed'
        | 'documentsCreated'
        | 'factsExtracted'
        | 'warningsCount'
        | 'creditsConsumed'
        | 'qualitySummary'
        | 'completedAt'
      >
    >,
  ): Promise<ServiceResult<ProcessingRun>>
}
