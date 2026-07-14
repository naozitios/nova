import type { SupabaseClient } from '@supabase/supabase-js'
import type { CircuitBreaker, ServiceResult } from '@/core/business-context/types'
import type { CircuitBreakerConfig } from './thresholds'
import { getState, mapBreaker } from './state'
import { evaluateShouldTrip } from './thresholds'

/**
 * Record a failure. Increments failure_count (and timeout_count when
 * applicable), stamps last_failure_at, and trips the breaker to open if
 * the threshold logic says so.
 */
export async function recordFailure(
  db: SupabaseClient,
  workspaceId: string | null,
  provider: string,
  details: { isTimeout: boolean } | boolean,
  config: CircuitBreakerConfig,
): Promise<ServiceResult<CircuitBreaker>> {
  const breaker = await getState(db, workspaceId, provider, config)
  const now = new Date()
  const isTimeout = typeof details === 'boolean' ? details : details.isTimeout
  const update: Record<string, unknown> = {
    failure_count: breaker.failureCount + 1,
    last_failure_at: now.toISOString(),
  }

  if (isTimeout) {
    update.timeout_count = breaker.timeoutCount + 1
  }

  if (evaluateShouldTrip(breaker, now, isTimeout, config)) {
    update.state = 'open'
    update.opened_at = now.toISOString()
    update.half_open_after = new Date(now.getTime() + config.halfOpenAfterMs).toISOString()
  }

  const { data, error } = await db
    .from('context_provider_circuit_breakers')
    .update(update)
    .eq('provider', provider)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
  return { ok: true, data: mapBreaker(data) }
}

/**
 * Record a success. Bumps success_count / last_success_at. If the breaker
 * is currently half_open, this probe closes it and clears failure counts.
 */
export async function recordSuccess(
  db: SupabaseClient,
  workspaceId: string | null,
  provider: string,
  config: CircuitBreakerConfig,
): Promise<ServiceResult<CircuitBreaker>> {
  const breaker = await getState(db, workspaceId, provider, config)
  const now = new Date()
  const update: Record<string, unknown> = {
    success_count: breaker.successCount + 1,
    last_success_at: now.toISOString(),
  }

  if (breaker.state === 'half_open') {
    update.state = 'closed'
    update.failure_count = 0
    update.timeout_count = 0
    update.half_open_after = null
  }

  const { data, error } = await db
    .from('context_provider_circuit_breakers')
    .update(update)
    .eq('provider', provider)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
  return { ok: true, data: mapBreaker(data) }
}

/**
 * Mark a provider's quota as exhausted and immediately trip to open.
 * Used when the upstream returns a hard quota error.
 */
export async function markQuotaExhausted(
  db: SupabaseClient,
  workspaceId: string | null,
  provider: string,
  config: CircuitBreakerConfig,
): Promise<ServiceResult<CircuitBreaker>> {
  const now = new Date()
  const { data, error } = await db
    .from('context_provider_circuit_breakers')
    .update({
      quota_exhausted: true,
      state: 'open',
      opened_at: now.toISOString(),
      half_open_after: new Date(now.getTime() + config.halfOpenAfterMs).toISOString(),
    })
    .eq('provider', provider)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
  return { ok: true, data: mapBreaker(data) }
}
