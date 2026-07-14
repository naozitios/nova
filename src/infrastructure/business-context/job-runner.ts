// ─── Job runner for source processing (T077) ────────────────────────────────
//
// Orchestrates the full job lifecycle: lease, execute, heartbeat, stall
// detection, retry/backoff, dead-letter, circuit breaker gating, idempotency
// enforcement, stage visibility events, and sanitized error recording.
//
// Uses pure functions from job-policy.ts for all state-machine decisions.
// Uses CircuitBreakerAdapter for provider health gating.
// Uses ProcessingVisibilityWriter for stage events.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ContextJob,
  JsonValue,
  JobStatus,
  Provider,
  ServiceResult,
  SourceProcessingStage,
  StageEventStatus,
} from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'
import {
  calculateBackoffMs,
  classifyError,
  defaultRetryPolicy,
  heartbeatIntervalMs,
  isJobStalled,
  nextRetryStatus,
  stalledRecoveryStatus,
} from '@/core/business-context/job-policy'
import { CircuitBreakerAdapter } from './circuit-breaker'
import { ProcessingVisibilityWriter } from './processing-visibility'

// ─── Types ──────────────────────────────────────────────────────────────────

export type JobHandler = (
  job: ContextJob,
) => Promise<{
  output?: Record<string, JsonValue>
  stageEvents?: StageEventUpdate[]
}>

export interface StageEventUpdate {
  stage: SourceProcessingStage
  status: StageEventStatus
  attempt: number
  workerId?: string
  provider?: string
  providerRequestId?: string
  startedAt: Date
  completedAt?: Date
  durationMs?: number
  pagesProcessed?: number
  slidesProcessed?: number
  bytesProcessed?: number
  documentsCreated?: number
  factsExtracted?: number
  warningsCount?: number
  creditsConsumed?: number
  errorClass?: string
  error?: unknown
  metadata?: Record<string, unknown>
}

export interface JobRunnerConfig {
  /** Poll interval in ms between claim batches. */
  pollIntervalMs: number
  /** Max jobs to claim per poll cycle. */
  batchSize: number
  /** Worker identifier for locking and events. */
  workerId: string
  /** Max concurrent job executions. */
  maxConcurrency: number
  /** Stall sweep interval in ms. */
  stallSweepIntervalMs: number
  /** Provider to check circuit breaker for before dispatch. */
  providerOverride?: Provider
}

const DEFAULT_CONFIG: JobRunnerConfig = {
  pollIntervalMs: 2_000,
  batchSize: 10,
  workerId: 'worker-1',
  maxConcurrency: 5,
  stallSweepIntervalMs: 60_000,
}

// ─── Sanitized error recording ──────────────────────────────────────────────

const SENSITIVE_KEYS = [
  'secret', 'password', 'token', 'api_key', 'apiKey',
  'authorization', 'cookie', 'service_role', 'serviceRoleKey',
]

function sanitizeError(error: unknown): JsonValue | null {
  if (!error || typeof error !== 'object') return null
  const raw = error as Record<string, unknown>
  const result: Record<string, JsonValue> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) continue
    if (typeof value === 'string' && SENSITIVE_KEYS.some((s) => value.toLowerCase().includes(s))) continue
    result[key] = value as JsonValue
  }
  return result
}

// ─── Job runner ─────────────────────────────────────────────────────────────

export class JobRunner {
  private repo: RepositoryPort
  private breaker: CircuitBreakerAdapter
  private visibility: ProcessingVisibilityWriter
  private config: JobRunnerConfig
  private handlers: Map<string, JobHandler> = new Map()
  private running = new Set<string>()
  private runningCount = 0
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private stallTimer: ReturnType<typeof setInterval> | null = null
  private stopped = false

  constructor(
    repo: RepositoryPort,
    config?: Partial<JobRunnerConfig>,
  ) {
    this.repo = repo
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.breaker = new CircuitBreakerAdapter()
    this.visibility = new ProcessingVisibilityWriter()
  }

  // ─── Handler registration ───────────────────────────────────────────────

  /** Register a handler for a job type. */
  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler)
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /** Start the polling loop and stall sweep. */
  start(): void {
    this.stopped = false
    this.pollTimer = setInterval(() => this.pollCycle(), this.config.pollIntervalMs)
    this.stallTimer = setInterval(() => this.sweepStalled(), this.config.stallSweepIntervalMs)
  }

  /** Stop gracefully — waits for in-flight jobs to finish. */
  async stop(): Promise<void> {
    this.stopped = true
    if (this.pollTimer) clearInterval(this.pollTimer)
    if (this.stallTimer) clearInterval(this.stallTimer)
    // Wait for in-flight jobs
    while (this.runningCount > 0) {
      await new Promise((r) => setTimeout(r, 100))
    }
  }

  // ─── Poll cycle ─────────────────────────────────────────────────────────

  private async pollCycle(): Promise<void> {
    if (this.stopped) return
    if (this.runningCount >= this.config.maxConcurrency) return

    const availableSlots = this.config.maxConcurrency - this.runningCount
    const limit = Math.min(this.config.batchSize, availableSlots)
    if (limit <= 0) return

    // FR-042: Check circuit breaker before dispatch
    if (this.config.providerOverride) {
      const cbCheck = await this.checkCircuitBreaker(this.config.providerOverride)
      if (!cbCheck) return
    }

    // Claim queued or retry_waiting jobs
    const claimed = await this.claimJobs(limit)
    if (!claimed || claimed.length === 0) return

    // Execute each claimed job
    for (const job of claimed) {
      this.runningCount++
      this.running.add(job.id)
      this.executeJob(job).finally(() => {
        this.runningCount--
        this.running.delete(job.id)
      })
    }
  }

  // ─── Job claiming ───────────────────────────────────────────────────────

  private async claimJobs(limit: number): Promise<ContextJob[]> {
    // Claim queued jobs
    const queued = await this.repo.claimRunnableJobs(
      { status: 'queued' },
      this.config.workerId,
      limit,
    )
    if (!queued.ok) return []

    let jobs = queued.data

    // If slots remain, also claim retry_waiting jobs whose next_run_at has passed
    if (jobs.length < limit) {
      const retryLimit = limit - jobs.length
      const retryResult = await this.repo.claimRunnableJobs(
        { status: 'retry_waiting' },
        this.config.workerId,
        retryLimit,
      )
      if (retryResult.ok) {
        jobs = [...jobs, ...retryResult.data]
      }
    }

    return jobs
  }

  // ─── Job execution ──────────────────────────────────────────────────────

  private async executeJob(job: ContextJob): Promise<void> {
    const handler = this.handlers.get(job.jobType)
    if (!handler) {
      await this.handleNoHandler(job)
      return
    }

    const attempt = job.attemptCount + 1
    const startedAt = new Date()

    // FR-043: Emit started stage event
    await this.emitStageEvent({
      workspaceId: job.workspaceId,
      businessId: job.businessId,
      runId: job.id, // Using job ID as run ID for job-level events
      jobId: job.id,
      sourceId: job.input.sourceId as string ?? '',
      stage: (job.stage as SourceProcessingStage) ?? 'queued',
      status: 'started',
      attempt,
      workerId: this.config.workerId,
      startedAt,
    })

    // Start heartbeat refresh
    const heartbeatTimer = this.startHeartbeat(job)

    try {
      // Execute the handler
      const result = await handler(job)
      const completedAt = new Date()
      const durationMs = completedAt.getTime() - startedAt.getTime()

      // Stop heartbeat
      clearInterval(heartbeatTimer)

      // Record success
      const updateData: Partial<Pick<ContextJob, 'status' | 'output' | 'completedAt' | 'lockedBy' | 'lockedAt' | 'heartbeatAt'>> = {
        status: 'succeeded',
        output: result.output ?? null,
        completedAt,
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
      }

      await this.repo.updateContextJob(job.workspaceId, job.id, updateData)

      // FR-043: Emit succeeded stage event
      await this.emitStageEvent({
        workspaceId: job.workspaceId,
        businessId: job.businessId,
        runId: job.id,
        jobId: job.id,
        sourceId: job.input.sourceId as string ?? '',
        stage: (job.stage as SourceProcessingStage) ?? 'queued',
        status: 'succeeded',
        attempt,
        workerId: this.config.workerId,
        startedAt,
        completedAt,
        durationMs,
      })

      // FR-042: Record success on circuit breaker
      if (this.config.providerOverride) {
        await this.breaker.recordSuccess(null, this.config.providerOverride)
      }

      // Emit any additional stage events from the handler
      if (result.stageEvents) {
        for (const evt of result.stageEvents) {
          await this.emitStageEvent({
            ...evt,
            workspaceId: job.workspaceId,
            businessId: job.businessId,
            runId: job.id,
            jobId: job.id,
            sourceId: job.input.sourceId as string ?? '',
          })
        }
      }
    } catch (err) {
      clearInterval(heartbeatTimer)
      await this.handleJobFailure(job, err, attempt, startedAt)
    }
  }

  // ─── Heartbeat ──────────────────────────────────────────────────────────

  private startHeartbeat(job: ContextJob): ReturnType<typeof setInterval> {
    const interval = heartbeatIntervalMs()
    return setInterval(async () => {
      if (this.stopped || !this.running.has(job.id)) return
      await this.repo.updateContextJob(job.workspaceId, job.id, {
        heartbeatAt: new Date(),
      })
    }, interval)
  }

  // ─── Failure handling ───────────────────────────────────────────────────

  private async handleJobFailure(
    job: ContextJob,
    error: unknown,
    attempt: number,
    startedAt: Date,
  ): Promise<void> {
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()
    const errorRecord = sanitizeError(error)
    const errorClass = extractErrorClass(error)
    const classification = classifyError(errorClass)

    // FR-042: Record failure on circuit breaker
    if (this.config.providerOverride) {
      const isTimeout = errorClass === 'provider_timeout'
      await this.breaker.recordFailure(null, this.config.providerOverride, isTimeout)
    }

    // Determine next status
    const maxAttempts = job.maxAttempts
    const retryPolicy = { ...defaultRetryPolicy(), ...job.retryPolicy }
    const nextStatus = nextRetryStatus({ errorClass, attemptCount: attempt, maxAttempts })

    if (nextStatus === 'failed_permanent') {
      // Non-retryable or exhausted → permanent failure
      await this.repo.updateContextJob(job.workspaceId, job.id, {
        status: 'failed_permanent',
        errorClass,
        error: errorRecord,
        completedAt,
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
      })

      // FR-043: Emit failed stage event
      await this.emitStageEvent({
        workspaceId: job.workspaceId,
        businessId: job.businessId,
        runId: job.id,
        jobId: job.id,
        sourceId: job.input.sourceId as string ?? '',
        stage: (job.stage as SourceProcessingStage) ?? 'queued',
        status: 'failed_permanent',
        attempt,
        workerId: this.config.workerId,
        startedAt,
        completedAt,
        durationMs,
        errorClass,
        error: errorRecord,
      })
    } else if (nextStatus === 'retry_waiting') {
      // Schedule retry with exponential backoff
      const backoffMs = calculateBackoffMs(attempt, retryPolicy)
      const nextRunAt = new Date(Date.now() + backoffMs)

      await this.repo.updateContextJob(job.workspaceId, job.id, {
        status: 'retry_waiting',
        attemptCount: attempt,
        nextRunAt,
        errorClass,
        error: errorRecord,
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
      })

      // FR-043: Emit failed_retryable stage event
      await this.emitStageEvent({
        workspaceId: job.workspaceId,
        businessId: job.businessId,
        runId: job.id,
        jobId: job.id,
        sourceId: job.input.sourceId as string ?? '',
        stage: (job.stage as SourceProcessingStage) ?? 'queued',
        status: 'failed_retryable',
        attempt,
        workerId: this.config.workerId,
        startedAt,
        completedAt,
        durationMs,
        errorClass,
        error: errorRecord,
      })
    }
  }

  // ─── No handler found ───────────────────────────────────────────────────

  private async handleNoHandler(job: ContextJob): Promise<void> {
    await this.repo.updateContextJob(job.workspaceId, job.id, {
      status: 'failed_permanent',
      errorClass: 'validation',
      error: {
        code: 'NO_HANDLER',
        message: `No handler registered for job type: ${job.jobType}`,
      },
      completedAt: new Date(),
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
    })
  }

  // ─── Stall sweep (FR-041) ───────────────────────────────────────────────

  private async sweepStalled(): Promise<void> {
    if (this.stopped) return

    // Find running jobs with stale heartbeats
    const now = new Date()
    const candidates = await this.repo.claimRunnableJobs(
      { status: 'running', heartbeatExpired: now },
      this.config.workerId,
      this.config.batchSize,
    )
    if (!candidates.ok) return

    for (const job of candidates.data) {
      if (!job.stageTimeoutSeconds || !job.heartbeatAt) continue

      if (isJobStalled({ heartbeatAt: job.heartbeatAt, stageTimeoutSeconds: job.stageTimeoutSeconds, now })) {
        await this.recoverStalled(job)
      }
    }
  }

  private async recoverStalled(job: ContextJob): Promise<void> {
    const attempt = job.attemptCount
    const maxAttempts = job.maxAttempts
    const recoveryStatus = stalledRecoveryStatus({ attemptCount: attempt, maxAttempts })

    if (recoveryStatus === 'dead_lettered') {
      // FR-041: Exhausted stalled → dead_lettered
      await this.repo.updateContextJob(job.workspaceId, job.id, {
        status: 'dead_lettered',
        errorClass: 'provider_timeout',
        error: {
          code: 'STALLED_EXHAUSTED',
          message: 'Job stalled and exceeded max attempts',
        },
        completedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
      })
    } else {
      // FR-041: Retryable stalled → retry_waiting
      const retryPolicy = { ...defaultRetryPolicy(), ...job.retryPolicy }
      const backoffMs = calculateBackoffMs(attempt, retryPolicy)
      const nextRunAt = new Date(Date.now() + backoffMs)

      await this.repo.updateContextJob(job.workspaceId, job.id, {
        status: 'retry_waiting',
        nextRunAt,
        errorClass: 'provider_timeout',
        error: {
          code: 'STALLED_RETRY',
          message: 'Job stalled, scheduling retry',
        },
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
      })
    }
  }

  // ─── Circuit breaker (FR-042) ──────────────────────────────────────────

  private async checkCircuitBreaker(provider: Provider): Promise<boolean> {
    const state = await this.breaker.getState(null, provider)
    if (!state.ok) return true // Fail open
    if (state.data.state === 'open') {
      // Check if half-open transition is due
      const transitioned = await this.breaker.checkHalfOpenTransition(null, provider)
      if (transitioned.ok && transitioned.data.state === 'half_open') {
        return true // Allow one trial request
      }
      return false // Breaker open, reject
    }
    return true // closed or half_open
  }

  // ─── Stage events (FR-043) ─────────────────────────────────────────────

  private async emitStageEvent(input: StageEventInput): Promise<void> {
    await this.visibility.appendStageEvent({
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
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface StageEventInput {
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

function extractErrorClass(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const e = error as Record<string, unknown>
  if (typeof e.errorClass === 'string') return e.errorClass
  if (typeof e.code === 'string') return e.code.toLowerCase()
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('timeout')) return 'provider_timeout'
    if (msg.includes('oom') || msg.includes('out of memory')) return 'worker_oom'
  }
  return null
}
