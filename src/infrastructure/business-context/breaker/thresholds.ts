import type { CircuitBreaker } from '@/core/business-context/types'

export interface CircuitBreakerConfig {
  failureThreshold: number
  failureWindowMs: number
  failureRateMin: number
  consecutiveTimeoutThreshold: number
  halfOpenAfterMs: number
}

export const DEFAULT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureWindowMs: 10 * 60 * 1000,
  failureRateMin: 0.5,
  consecutiveTimeoutThreshold: 3,
  halfOpenAfterMs: 5 * 60 * 1000,
}

/**
 * Decide if a new failure should trip a closed breaker to open.
 * Quota-exhausted breakers trip regardless; non-closed states never re-trip
 * from this path. Otherwise, consecutive timeouts or a high failure rate
 * inside the configured window can trip.
 */
export function evaluateShouldTrip(
  breaker: CircuitBreaker,
  now: Date,
  isTimeout: boolean,
  config: CircuitBreakerConfig,
): boolean {
  if (breaker.quotaExhausted) return true
  if (breaker.state !== 'closed') return false

  if (isTimeout && breaker.timeoutCount + 1 >= config.consecutiveTimeoutThreshold) {
    return true
  }

  const newFailureCount = breaker.failureCount + 1
  if (newFailureCount >= config.failureThreshold) {
    const totalAttempts = newFailureCount + breaker.successCount
    const failureRate = newFailureCount / totalAttempts
    if (failureRate >= config.failureRateMin) return true
  }

  return false
}
