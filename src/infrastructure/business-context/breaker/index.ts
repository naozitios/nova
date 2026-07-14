import type { CircuitBreaker } from '@/core/business-context/types'

export type BreakerSnapshot = Omit<CircuitBreaker, 'metadata'> & {
  failureWindowStartedAt: string
}

export { CircuitBreakerAdapter } from './circuit-breaker'
export {
  DEFAULT_BREAKER_CONFIG,
  type CircuitBreakerConfig,
} from './thresholds'
