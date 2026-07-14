import type { JsonValue } from './entities'

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError }

export interface ServiceError {
  code: string
  message: string
  details?: Record<string, JsonValue>
}

export interface RetryPolicy {
  backoffBaseMs: number
  backoffFactor: number
  jitterPercent: number
  backoffCapMs: number
  maxAttempts: number
  retryableClasses: string[]
}
