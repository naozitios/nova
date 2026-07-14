import type { ErrorClass, JobStatus, RetryPolicy } from './types'

// ─── Constants ───────────────────────────────────────────────────────────────

const RETRYABLE_ERROR_CLASSES: readonly ErrorClass[] = [
  'provider_timeout',
  'provider_5xx',
  'worker_oom',
]

const RETRYABLE_ERROR_CLASSES_WITH_NETWORK: readonly string[] = [
  ...RETRYABLE_ERROR_CLASSES,
  'network_transient',
  'rate_limited',
]

const NON_RETRYABLE_ERROR_CLASSES: readonly ErrorClass[] = [
  'validation',
  'auth',
  'ssrf',
  'malware',
  'unsupported_file',
  'budget_exceeded',
  'schema_contract',
  'quota_exhausted',
]

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  backoffBaseMs: 30_000,
  backoffFactor: 4,
  jitterPercent: 0.2,
  backoffCapMs: 30 * 60_000,
  maxAttempts: 4,
  retryableClasses: [...RETRYABLE_ERROR_CLASSES_WITH_NETWORK],
}

const HEARTBEAT_INTERVAL_MS = 30_000
const STALL_MULTIPLIER = 2

// ─── Error classification ────────────────────────────────────────────────────

export function isRetryableErrorClass(errorClass: string | null): boolean {
  if (errorClass === null) return true // unknown errors are retryable
  return RETRYABLE_ERROR_CLASSES_WITH_NETWORK.includes(errorClass)
}

export function isNonRetryableErrorClass(errorClass: string | null): boolean {
  if (errorClass === null) return false
  return NON_RETRYABLE_ERROR_CLASSES.includes(errorClass as ErrorClass)
}

export function classifyError(errorClass: string | null): 'retryable' | 'non_retryable' | 'unknown' {
  if (errorClass === null) return 'unknown'
  if (isRetryableErrorClass(errorClass)) return 'retryable'
  if (isNonRetryableErrorClass(errorClass)) return 'non_retryable'
  return 'unknown'
}

// ─── Backoff calculation ─────────────────────────────────────────────────────

export function calculateBackoffMs(
  attempt: number,
  policy: Partial<RetryPolicy> = {},
): number {
  const p = { ...DEFAULT_RETRY_POLICY, ...policy }
  const base = p.backoffBaseMs * Math.pow(p.backoffFactor, attempt - 1)
  const capped = Math.min(base, p.backoffCapMs)
  const jitter = capped * p.jitterPercent
  const jitterOffset = (Math.random() * 2 - 1) * jitter
  return Math.max(0, Math.round(capped + jitterOffset))
}

// ─── Retry eligibility ───────────────────────────────────────────────────────

export function isRetryEligible(params: {
  errorClass: string | null
  attemptCount: number
  maxAttempts: number
}): boolean {
  if (params.attemptCount >= params.maxAttempts) return false
  if (params.errorClass !== null && isNonRetryableErrorClass(params.errorClass))
    return false
  return true
}

export function nextRetryStatus(params: {
  errorClass: string | null
  attemptCount: number
  maxAttempts: number
}): JobStatus {
  if (!isRetryEligible(params)) return 'failed_permanent'
  return 'retry_waiting'
}

// ─── Heartbeat / stall detection ─────────────────────────────────────────────

export function isJobStalled(params: {
  heartbeatAt: Date | null
  stageTimeoutSeconds: number | null
  now: Date
}): boolean {
  if (!params.heartbeatAt || !params.stageTimeoutSeconds) return false
  const elapsedMs = params.now.getTime() - params.heartbeatAt.getTime()
  const thresholdMs = params.stageTimeoutSeconds * 1000 * STALL_MULTIPLIER
  return elapsedMs > thresholdMs
}

export function heartbeatIntervalMs(): number {
  return HEARTBEAT_INTERVAL_MS
}

export function stallThresholdMs(stageTimeoutSeconds: number): number {
  return stageTimeoutSeconds * 1000 * STALL_MULTIPLIER
}

// ─── Terminal transitions ────────────────────────────────────────────────────

const TERMINAL_STATES: readonly JobStatus[] = [
  'succeeded',
  'failed_permanent',
  'dead_lettered',
  'cancelled',
]

export function isTerminalJobStatus(status: JobStatus): boolean {
  return TERMINAL_STATES.includes(status)
}

export function canTransition(
  from: JobStatus,
  to: JobStatus,
): boolean {
  const transitions: Record<JobStatus, readonly JobStatus[]> = {
    queued: ['scheduled', 'running', 'cancelled'],
    scheduled: ['queued', 'running', 'cancelled'],
    running: ['succeeded', 'failed_retryable', 'failed_permanent', 'stalled', 'cancelled'],
    retry_waiting: ['queued', 'failed_permanent', 'dead_lettered', 'cancelled'],
    succeeded: [],
    failed_retryable: ['retry_waiting', 'cancelled'],
    failed_permanent: ['retry_waiting', 'cancelled'],
    stalled: ['retry_waiting', 'dead_lettered', 'cancelled'],
    dead_lettered: [],
    cancelled: [],
  }
  return transitions[from].includes(to)
}

// ─── Stall recovery ──────────────────────────────────────────────────────────

export function stalledRecoveryStatus(params: {
  attemptCount: number
  maxAttempts: number
}): JobStatus {
  if (params.attemptCount >= params.maxAttempts) return 'dead_lettered'
  return 'retry_waiting'
}

// ─── Default retry policy ────────────────────────────────────────────────────

export function defaultRetryPolicy(): RetryPolicy {
  return { ...DEFAULT_RETRY_POLICY }
}
