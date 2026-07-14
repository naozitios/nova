import type { SupabaseClient } from '@supabase/supabase-js'
import type { CircuitBreaker, ServiceResult } from '@/core/business-context/types'
import { getSupabaseServiceClient } from '../supabase-client'
import {
  DEFAULT_BREAKER_CONFIG,
  type CircuitBreakerConfig,
} from './thresholds'
import { getState, mapBreaker, transitionToHalfOpen } from './state'
import {
  markQuotaExhausted,
  recordFailure,
  recordSuccess,
} from './operations'

export class CircuitBreakerAdapter {
  private db: SupabaseClient
  private config: CircuitBreakerConfig

  constructor(client?: SupabaseClient, config?: Partial<CircuitBreakerConfig>) {
    this.db = client ?? getSupabaseServiceClient()
    this.config = { ...DEFAULT_BREAKER_CONFIG, ...config }
  }

  async getState(
    workspaceId: string | null,
    provider: string,
  ): Promise<CircuitBreaker> {
    return getState(this.db, workspaceId, provider, this.config)
  }

  async recordFailure(
    workspaceId: string | null,
    provider: string,
    details: { isTimeout: boolean } | boolean,
  ): Promise<ServiceResult<CircuitBreaker>> {
    return recordFailure(this.db, workspaceId, provider, details, this.config)
  }

  async recordSuccess(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker>> {
    return recordSuccess(this.db, workspaceId, provider, this.config)
  }

  async markQuotaExhausted(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker>> {
    return markQuotaExhausted(this.db, workspaceId, provider, this.config)
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
    return { ok: true, data: mapBreaker(data) }
  }

  /**
   * Check if half_open transition is due. If so, move to half_open.
   */
  async checkHalfOpenTransition(
    workspaceId: string | null,
    provider: string,
  ): Promise<ServiceResult<CircuitBreaker>> {
    const breaker = await this.getState(workspaceId, provider)
    if (breaker.state !== 'open' || !breaker.halfOpenAfter) {
      return { ok: true, data: breaker }
    }
    const now = new Date()
    if (now >= breaker.halfOpenAfter) {
      return transitionToHalfOpen(this.db, workspaceId, provider)
    }
    return { ok: true, data: breaker }
  }
}
