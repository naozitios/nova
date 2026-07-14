import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CircuitBreaker,
  CircuitBreakerState,
  ServiceResult,
} from '@/core/business-context/types'
import { getSupabaseServiceClient } from './supabase-client'
import type { JsonValue } from '@/core/business-context/types'

/** Cast Supabase JSON to JsonValue. */
function asJsonRecord(v: unknown): Record<string, JsonValue> {
  return (v ?? {}) as Record<string, JsonValue>
}

// ─── Types ──────────────────────────────────────────────────────────────────

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

export type BreakerSnapshot = Omit<CircuitBreaker, 'metadata'> & {
  failureWindowStartedAt: string
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class CircuitBreakerAdapter {
  private db: SupabaseClient
  private config: CircuitBreakerConfig

  constructor(client?: SupabaseClient, config?: Partial<CircuitBreakerConfig>) {
    this.db = client ?? getSupabaseServiceClient()
    this.config = { ...DEFAULT_BREAKER_CONFIG, ...config }
  }

  /**
   * Read current breaker state for a provider.
   * Creates a default closed breaker if none exists.
   * Auto-transitions open → half_open when half_open_after has passed.
   */
  async getState(
    workspaceId: string | null,
    provider: string,
  ): Promise<CircuitBreaker> {
    const { data, error } = await this.readRaw(workspaceId, provider)

    if (error && error.code !== 'PGRST116') {
      throw new Error(`READ_FAILED: ${error.message}`)
    }

    if (data) {
      const breaker = this.mapBreaker(data)
      if (
        breaker.state === 'open' &&
        breaker.halfOpenAfter &&
        new Date() >= breaker.halfOpenAfter
      ) {
        const transitioned = await this.transitionToHalfOpen(workspaceId, provider)
        if (transitioned.ok) return transitioned.data
      }
      return breaker
    }

    // Create default closed breaker
    const created = await this.createDefault(workspaceId, provider)
    if (!created.ok) throw new Error(`CREATE_FAILED: ${created.error.message}`)
    return created.data
  }

  /**
   * Record a failure and evaluate whether the breaker should trip.
   */
  async recordFailure(
    workspaceId: string | null,
    provider: string,
    details: { isTimeout: boolean } | boolean,
  ): Promise<ServiceResult<CircuitBreaker>> {
    const breaker = await this.getState(workspaceId, provider)
    const now = new Date()
    const isTimeout = typeof details === 'boolean' ? details : details.isTimeout
    const update: Record<string, unknown> = {
      failure_count: breaker.failureCount + 1,
      last_failure_at: now.toISOString(),
    }

    if (isTimeout) {
      update.timeout_count = breaker.timeoutCount + 1
    }

    // Evaluate trip conditions
    const shouldTrip = this.evaluateShouldTrip(breaker, now, isTimeout)

    if (shouldTrip) {
      update.state = 'open'
      update.opened_at = now.toISOString()
      update.half_open_after = new Date(now.getTime() + this.config.halfOpenAfterMs).toISOString()
    }

    const { data, error } = await this.db
      .from('context_provider_circuit_breakers')
      .update(update)
      .eq('provider', provider)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
    return { ok: true, data: this.mapBreaker(data) }
  }

  /**
   * Record a success. If half_open → close the breaker.
   */
  async recordSuccess(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker>> {
    const breaker = await this.getState(workspaceId, provider)
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

    const { data, error } = await this.db
      .from('context_provider_circuit_breakers')
      .update(update)
      .eq('provider', provider)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
    return { ok: true, data: this.mapBreaker(data) }
  }

  /**
   * Check if half_open transition is due. If so, move to half_open.
   */
  async checkHalfOpenTransition(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker>> {
    const get = await this.getState(workspaceId, provider)
    if (!get.ok) return get

    const breaker = get.data
    if (breaker.state !== 'open' || !breaker.halfOpenAfter) {
      return { ok: true, data: breaker }
    }

    const now = new Date()
    if (now >= breaker.halfOpenAfter) {
      const { data, error } = await this.db
        .from('context_provider_circuit_breakers')
        .update({ state: 'half_open' })
        .eq('provider', provider)
        .eq('workspace_id', workspaceId)
        .select()
        .single()

      if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
      return { ok: true, data: this.mapBreaker(data) }
    }

    return { ok: true, data: breaker }
  }

  /**
   * Mark quota as exhausted and immediately trip the breaker.
   */
  async markQuotaExhausted(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker>> {
    const now = new Date()
    const { data, error } = await this.db
      .from('context_provider_circuit_breakers')
      .update({
        quota_exhausted: true,
        state: 'open',
        opened_at: now.toISOString(),
        half_open_after: new Date(now.getTime() + this.config.halfOpenAfterMs).toISOString(),
      })
      .eq('provider', provider)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
    return { ok: true, data: this.mapBreaker(data) }
  }

  /**
   * Force-reset a breaker to closed (admin override).
   */
  async reset(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker>> {
    const { data, error } = await this.db
      .from('context_provider_circuit_breakers')
      .update({
        state: 'closed',
        failure_count: 0,
        success_count: 0,
        timeout_count: 0,
        quota_exhausted: false,
        opened_at: null,
        half_open_after: null,
      })
      .eq('provider', provider)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
    return { ok: true, data: this.mapBreaker(data) }
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private async transitionToHalfOpen(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker>> {
    const { data, error } = await this.db
      .from('context_provider_circuit_breakers')
      .update({ state: 'half_open' })
      .eq('provider', provider)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) return { ok: false, error: { code: 'UPDATE_FAILED', message: error.message } }
    return { ok: true, data: this.mapBreaker(data) }
  }

  private async readRaw(
    workspaceId: string | null,
    provider: string,
  ) {
    let query = this.db
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

  private async createDefault(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker>> {
    const { data, error } = await this.db
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
          metadata: this.config,
        },
        { onConflict: 'workspace_id,provider' },
      )
      .select()
      .single()

    if (error) return { ok: false, error: { code: 'CREATE_FAILED', message: error.message } }
    return { ok: true, data: this.mapBreaker(data) }
  }

  private evaluateShouldTrip(
    breaker: CircuitBreaker,
    now: Date,
    isTimeout: boolean,
  ): boolean {
    if (breaker.quotaExhausted) return true
    if (breaker.state !== 'closed') return false

    // Check consecutive timeouts
    if (isTimeout && breaker.timeoutCount + 1 >= this.config.consecutiveTimeoutThreshold) {
      return true
    }

    // Check failure threshold + rate
    const newFailureCount = breaker.failureCount + 1
    if (newFailureCount >= this.config.failureThreshold) {
      const totalAttempts = newFailureCount + breaker.successCount
      const failureRate = newFailureCount / totalAttempts
      if (failureRate >= this.config.failureRateMin) return true
    }

    return false
  }

  private mapBreaker(r: Record<string, unknown>): CircuitBreaker {
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
}
