import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Business,
  BusinessProfileVersion,
  OnboardingSession,
  ServiceResult,
} from '@/core/business-context/types'
import type {
  BusinessFilter,
  OnboardingFilter,
  PaginationParams,
  SortParams,
} from '@/core/business-context/repository.port'
import {
  err,
  mapBusiness,
  mapOnboardingSession,
} from './_shared'

// ─── Business + OnboardingSession ────────────────────────────────────────────

export class BusinessRepository {
  constructor(private db: SupabaseClient) {}

  // ── Businesses ───────────────────────────────────────────────────────────

  async createBusiness(
    data: Omit<Business, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<Business>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('businesses')
      .insert({
        workspace_id: data.workspaceId,
        name: data.name,
        website_url: data.websiteUrl,
        status: data.status,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapBusiness(row) }
  }

  async getBusiness(
    workspaceId: string,
    businessId: string,
  ): Promise<ServiceResult<Business | null>> {
    const { data, error } = await this.db
      .from('businesses')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', businessId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapBusiness(data) : null }
  }

  async listBusinesses(
    filter: BusinessFilter,
    pagination?: PaginationParams,
    sort?: SortParams<'name' | 'createdAt' | 'updatedAt'>,
  ): Promise<ServiceResult<{ items: Business[]; total: number }>> {
    let query = this.db
      .from('businesses')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)

    if (filter.status) query = query.eq('status', filter.status)

    const sortField = sort?.field === 'createdAt' ? 'created_at'
      : sort?.field === 'updatedAt' ? 'updated_at'
      : sort?.field ?? 'created_at'
    const sortDir = sort?.direction ?? 'desc'
    query = query.order(sortField, { ascending: sortDir === 'asc' })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapBusiness), total: count ?? 0 },
    }
  }

  async updateBusiness(
    workspaceId: string,
    businessId: string,
    data: Partial<Pick<Business, 'name' | 'websiteUrl' | 'status'>>,
  ): Promise<ServiceResult<Business>> {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) update.name = data.name
    if (data.websiteUrl !== undefined) update.website_url = data.websiteUrl
    if (data.status !== undefined) update.status = data.status

    const { data: row, error } = await this.db
      .from('businesses')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', businessId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapBusiness(row) }
  }

  // ── Onboarding sessions ──────────────────────────────────────────────────

  async createOnboardingSession(
    data: Omit<OnboardingSession, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<OnboardingSession>> {
    const { data: row, error } = await this.db
      .from('onboarding_sessions')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        status: data.status,
        current_step: data.currentStep,
        started_by: data.startedBy,
        started_at: data.startedAt.toISOString(),
        completed_at: data.completedAt?.toISOString() ?? null,
        error: data.error,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapOnboardingSession(row) }
  }

  async getOnboardingSession(
    workspaceId: string,
    sessionId: string,
  ): Promise<ServiceResult<OnboardingSession | null>> {
    const { data, error } = await this.db
      .from('onboarding_sessions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', sessionId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapOnboardingSession(data) : null }
  }

  async listOnboardingSessions(
    filter: OnboardingFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: OnboardingSession[]; total: number }>> {
    let query = this.db
      .from('onboarding_sessions')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)

    if (filter.businessId) query = query.eq('business_id', filter.businessId)
    if (filter.status) query = query.eq('status', filter.status)

    query = query.order('started_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapOnboardingSession), total: count ?? 0 },
    }
  }

  async updateOnboardingSession(
    workspaceId: string,
    sessionId: string,
    data: Partial<Pick<OnboardingSession, 'status' | 'currentStep' | 'completedAt' | 'error'>>,
  ): Promise<ServiceResult<OnboardingSession>> {
    const update: Record<string, unknown> = {}
    if (data.status !== undefined) update.status = data.status
    if (data.currentStep !== undefined) update.current_step = data.currentStep
    if (data.completedAt !== undefined) update.completed_at = data.completedAt?.toISOString() ?? null
    if (data.error !== undefined) update.error = data.error

    const { data: row, error } = await this.db
      .from('onboarding_sessions')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', sessionId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapOnboardingSession(row) }
  }

  // ── Atomic onboarding approval (RPC) ────────────────────────────────────────

  async approveOnboardingV1(
    workspaceId: string,
    businessId: string,
    approverId: string,
  ): Promise<ServiceResult<BusinessProfileVersion>> {
    const { data, error } = await this.db.rpc('approve_onboarding_v1', {
      p_workspace_id: workspaceId,
      p_business_id: businessId,
      p_approver_id: approverId,
    })

    if (error) return err('RPC_FAILED', error.message)
    if (!data?.ok) {
      return {
        ok: false,
        error: {
          code: data?.error?.code ?? 'APPROVAL_FAILED',
          message: data?.error?.message ?? 'Onboarding approval failed',
          details: data?.error?.details,
        },
      }
    }

    const row = data.data
    return {
      ok: true,
      data: {
        id: row.id,
        workspaceId: row.workspaceId,
        businessId: row.businessId,
        version: row.version,
        profile: row.profile,
        profileMarkdown: row.profileMarkdown ?? null,
        status: row.status,
        changeSummary: row.changeSummary ?? null,
        createdBy: row.createdBy,
        createdAt: new Date(row.createdAt),
        approvedBy: row.approvedBy ?? null,
        approvedAt: row.approvedAt ? new Date(row.approvedAt) : null,
      },
    }
  }
}
