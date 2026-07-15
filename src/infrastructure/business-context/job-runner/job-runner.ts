// ─── Job runner facade ────────────────────────────────────────────────────
//
// Orchestrates the full job lifecycle by delegating each concern to a
// focused module:
//   - lease        → lease acquisition (claimJobs)
//   - heartbeat    → per-job heartbeat refresh
//   - execution    → per-job handler dispatch and success/failure paths
//   - retry        → retry classification and backoff
//   - dead-letter  → terminal transitions and stall recovery
//   - stage-events → FR-043 stage visibility events
//   - errors       → error sanitization and classification
//   - handlers/*   → job-type specific work
//
// All state-machine decisions live in core/job-policy. This file is a thin
// lifecycle manager: it owns polling timers, in-flight tracking, and the
// circuit-breaker gate; the actual job execution is in ./execution.ts.

import type {
  CircuitBreaker,
  Provider,
} from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'
import { CircuitBreakerAdapter } from '../breaker/circuit-breaker'
import { ProcessingVisibilityWriter } from '../processing-visibility'
import { claimJobs } from './lease'
import { sweepStalled } from './dead-letter'
import { dispatchJob } from './execution'
import { sanitizeError } from './errors'
import type { JobHandler } from './handlers/extract.handler'

export type { JobHandler, StageEventUpdate } from './handlers/extract.handler'
export type { StageEventInput } from './stage-events'

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
  /** Max ms to wait for in-flight jobs during stop() before returning. */
  shutdownTimeoutMs: number
}

const DEFAULT_CONFIG: JobRunnerConfig = {
  pollIntervalMs: 2_000,
  batchSize: 10,
  workerId: 'worker-1',
  maxConcurrency: 5,
  stallSweepIntervalMs: 60_000,
  shutdownTimeoutMs: 30_000,
}

export class JobRunner {
  private repo: RepositoryPort
  private breaker: CircuitBreakerAdapter
  private visibility: ProcessingVisibilityWriter
  private config: JobRunnerConfig
  private handlers: Map<string, JobHandler> = new Map()
  private running = new Set<string>()
  private runningCount = 0
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private stallTimer: ReturnType<typeof setTimeout> | null = null
  private stopped = true
  private activeCycles = 0
  private pollAbort: AbortController | null = null

  constructor(repo: RepositoryPort, config?: Partial<JobRunnerConfig>) {
    this.repo = repo
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.breaker = new CircuitBreakerAdapter()
    this.visibility = new ProcessingVisibilityWriter()
  }

  registerHandler(jobType: string, handler: JobHandler): void {
    this.handlers.set(jobType, handler)
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.schedulePoll()
    this.scheduleStallSweep()
  }

  async stop(): Promise<void> {
    this.stopped = true
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    if (this.stallTimer !== null) {
      clearTimeout(this.stallTimer)
      this.stallTimer = null
    }
    const ac = new AbortController()
    this.pollAbort = ac
    const deadline = new Promise<void>((resolve) => {
      const id = setTimeout(resolve, this.config.shutdownTimeoutMs)
      ac.signal.addEventListener('abort', () => clearTimeout(id))
    })

    const waitForDrain = (async () => {
      while (
        (this.activeCycles > 0 || this.runningCount > 0) &&
        !ac.signal.aborted
      ) {
        await new Promise((r) => setTimeout(r, 10))
      }
    })()

    await Promise.race([waitForDrain, deadline])
    ac.abort()
  }

  private schedulePoll(): void {
    if (this.stopped) return
    this.pollTimer = setTimeout(() => {
      this.pollCycle()
        .catch((e) => console.error('[JobRunner] poll error', sanitizeError(e)))
        .finally(() => this.schedulePoll())
    }, this.config.pollIntervalMs)
  }

  private scheduleStallSweep(): void {
    if (this.stopped) return
    this.stallTimer = setTimeout(() => {
      this.sweepStalled()
        .catch((e) => console.error('[JobRunner] stall-sweep error', sanitizeError(e)))
        .finally(() => this.scheduleStallSweep())
    }, this.config.stallSweepIntervalMs)
  }

  private async pollCycle(): Promise<void> {
    if (this.stopped) return
    this.activeCycles++
    try {
      if (this.runningCount >= this.config.maxConcurrency) return

      const availableSlots = this.config.maxConcurrency - this.runningCount
      const limit = Math.min(this.config.batchSize, availableSlots)
      if (limit <= 0) return

      if (this.config.providerOverride) {
        const cbCheck = await this.checkCircuitBreaker(this.config.providerOverride)
        if (!cbCheck) return
      }

      const claimed = await claimJobs(this.repo, this.config.workerId, limit)
      if (this.pollAbort?.signal.aborted) return
      if (claimed.length === 0) return

      for (const job of claimed) {
        this.runningCount++
        this.running.add(job.id)
        this.dispatch(job)
          .catch((e) => console.error('[JobRunner] dispatch error', sanitizeError(e)))
          .finally(() => {
            this.runningCount--
            this.running.delete(job.id)
          })
      }
    } finally {
      this.activeCycles--
    }
  }

  private async dispatch(job: import('@/core/business-context/types').ContextJob): Promise<void> {
    await dispatchJob(job, this.handlers, {
      repo: this.repo,
      breaker: this.breaker,
      visibility: this.visibility,
      workerId: this.config.workerId,
      providerOverride: this.config.providerOverride,
      isActive: () => this.running.has(job.id),
    })
  }

  private async sweepStalled(): Promise<void> {
    this.activeCycles++
    try {
      if (this.stopped) return
      await sweepStalled(this.repo, this.config.workerId, this.config.batchSize)
    } finally {
      this.activeCycles--
    }
  }

  private async checkCircuitBreaker(provider: Provider): Promise<boolean> {
    let state: CircuitBreaker
    try {
      state = await this.breaker.getState(null, provider)
    } catch {
      return true // Fail open on read error
    }
    if (state.state === 'open') {
      const transitioned = await this.breaker.checkHalfOpenTransition(null, provider)
      if (transitioned.ok && transitioned.data.state === 'half_open') {
        return true // Allow one trial request
      }
      return false // Breaker open, reject
    }
    return true // closed or half_open
  }
}
