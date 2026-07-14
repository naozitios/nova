import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CircuitBreaker,
  CircuitBreakerState,
  JsonValue,
  ServiceResult,
} from '@/core/business-context/types'
import type { CircuitBreakerConfig } from './thresholds'

function asJsonRecord(v: unknown): Record<string, JsonValue> {
  return (v ?? {}) as Record<string, JsonValue>
}

export function mapBreaker(r: Record<string, unknown>): CircuitBreaker {
  return {
    id: r.id as string,
    workspaceId: (r.workspace_id as string) ?? null,
    provider: r.provider as string,
    state: r.state as CircuitBreakerState,
    failureCount: Number(r.failure_count),
    successCount: Number(r.success_count),
    timeoutCount: Number(r.timeout_count),
    quotaExhausted: r.quota_exhausted as boolean,
    openedAt: r.opened_at ? new Date(r.opened_at as string) : null,
    halfOpenAfter: r.half_open_after ? new Date(r.half_open_after as string) : null,
    lastFailureAt: r.last_failure_at ? new Date(r.last_failure_at as string) : null,
    lastSuccessAt: r.last_success_at ? new Date(r.last_success_at as string) : null,
    metadata: asJsonRecord(r.metadata),
  }
}

export async function readRaw(
  db: SupabaseClient,
  workspaceId: string | null,
  provider: string,
) {
  let query = db
    .from('context_provider_circuit_breakers')
    .select('*')
    .eq('provider', provider)

  if (workspaceId === null) {
    query = query.is('workspace_id', null)
  } else {
    query = query.eq('workspace_id', workspaceId)
  }

  return query.single()
}

export async function createDefault(
  db: SupabaseClient,
  workspaceId: string | null,
  provider: string,
  config: CircuitBreakerConfig,
): Promise<ServiceResult<CircuitBreaker>> {
  const { data, error } = await db
    .from('context_provider_circuit_breakers')
    .upsert(
      {
        workspace_id: workspaceId,
        provider,
        state: 'closed',
        failure_count: 0,
        success_count: 0,
        timeout_count: 0,
        quota_exhausted: false,
        metadata: config,
      },
      { onConflict: 'workspace_id,provider' },
    )
    .select()
    .single()

  if (error) return { ok: false, error: { code: 'CREATE_FAILED', message: error.message } }
  return { ok: true, data: mapBreaker(data) }
}

export async function transitionToHalfOpen(
  db: SupabaseClient,
  workspaceId: string | null,
  provider: string,
): Promise<ServiceResult<CircuitBreaker>> {
  const { data, error } = await db
    .from('context_provider_circuit_breakers')
    .update({ state: 'half_open' })
    .eq('provider', provider)
    .eq('workspace_id', workspaceId)
    .select()
    .single()

  if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
  return { ok: true, data: mapBreaker(data) }
}

/**
 * Read current breaker state for a provider. Creates a default closed
 * breaker if none exists. Auto-transitions open → half_open when the
 * configured half_open_after window has elapsed.
 */
export async function getState(
  db: SupabaseClient,
  workspaceId: string | null,
  provider: string,
  config: CircuitBreakerConfig,
): Promise<CircuitBreaker> {
  const { data, error } = await readRaw(db, workspaceId, provider)

  if (error && error.code !== 'PGRST116') {
    throw new Error(`READ_FAILED: ${error.message}`)
  }

  if (data) {
    const breaker = mapBreaker(data)
    if (
      breaker.state === 'open' &&
      breaker.halfOpenAfter &&
      new Date() >= breaker.halfOpenAfter
    ) {
      const transitioned = await transitionToHalfOpen(db, workspaceId, provider)
      if (transitioned.ok) return transitioned.data
    }
    return breaker
  }

  const created = await createDefault(db, workspaceId, provider, config)
  if (!created.ok) throw new Error(`CREATE_FAILED: ${created.error.message}`)
  return created.data
}
