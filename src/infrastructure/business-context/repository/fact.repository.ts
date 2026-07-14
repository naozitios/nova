import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ContextConflict,
  ContextFact,
  OnboardingQuestion,
  ServiceResult,
} from '@/core/business-context/types'
import type {
  ConflictFilter,
  FactFilter,
  PaginationParams,
  QuestionFilter,
} from '@/core/business-context/repository.port'
import {
  err,
  mapContextConflict,
  mapContextFact,
  mapOnboardingQuestion,
} from './_shared'

// ─── ContextFact + ContextConflict + OnboardingQuestion ─────────────────────

export class FactRepository {
  constructor(private db: SupabaseClient) {}

  // ── Context facts ────────────────────────────────────────────────────────

  async createContextFact(
    data: Omit<ContextFact, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextFact>> {
    const { data: row, error } = await this.db
      .from('context_facts')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        fact_key: data.factKey,
        value: data.value,
        source_id: data.sourceId,
        source_document_id: data.sourceDocumentId,
        source_excerpt: data.sourceExcerpt,
        evidence_locator: data.evidenceLocator,
        confidence: data.confidence,
        verification_status: data.verificationStatus,
        supersedes_fact_id: data.supersedesFactId,
        valid_from: data.validFrom.toISOString(),
        valid_to: data.validTo?.toISOString() ?? null,
        created_by: data.createdBy,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapContextFact(row) }
  }

  async getContextFact(
    workspaceId: string,
    factId: string,
  ): Promise<ServiceResult<ContextFact | null>> {
    const { data, error } = await this.db
      .from('context_facts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', factId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextFact(data) : null }
  }

  async listContextFacts(
    filter: FactFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextFact[]; total: number }>> {
    let query = this.db
      .from('context_facts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.factKey) query = query.eq('fact_key', filter.factKey)
    if (filter.sourceId) query = query.eq('source_id', filter.sourceId)
    if (filter.active !== undefined) {
      if (filter.active) {
        query = query.is('valid_to', null).not('verification_status', 'in', '(rejected,superseded)')
      } else {
        query = query.or('valid_to.not.is.null,verification_status.in.(rejected,superseded)')
      }
    }

    query = query.order('created_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapContextFact), total: count ?? 0 },
    }
  }

  async updateContextFact(
    workspaceId: string,
    factId: string,
    data: Partial<Pick<ContextFact, 'value' | 'verificationStatus' | 'supersedesFactId' | 'validTo' | 'confidence'>>,
  ): Promise<ServiceResult<ContextFact>> {
    const update: Record<string, unknown> = {}
    if (data.value !== undefined) update.value = data.value
    if (data.verificationStatus !== undefined) update.verification_status = data.verificationStatus
    if (data.supersedesFactId !== undefined) update.supersedes_fact_id = data.supersedesFactId
    if (data.validTo !== undefined) update.valid_to = data.validTo?.toISOString() ?? null
    if (data.confidence !== undefined) update.confidence = data.confidence

    const { data: row, error } = await this.db
      .from('context_facts')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', factId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapContextFact(row) }
  }

  // ── Context conflicts ────────────────────────────────────────────────────

  async createContextConflict(
    data: Omit<ContextConflict, 'id' | 'createdAt'>,
  ): Promise<ServiceResult<ContextConflict>> {
    const { data: row, error } = await this.db
      .from('context_conflicts')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        fact_key: data.factKey,
        fact_ids: data.factIds,
        status: data.status,
        resolution_fact_id: data.resolutionFactId,
        resolution_note: data.resolutionNote,
        resolved_by: data.resolvedBy,
        resolved_at: data.resolvedAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapContextConflict(row) }
  }

  async getContextConflict(
    workspaceId: string,
    conflictId: string,
  ): Promise<ServiceResult<ContextConflict | null>> {
    const { data, error } = await this.db
      .from('context_conflicts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', conflictId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextConflict(data) : null }
  }

  async listContextConflicts(
    filter: ConflictFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextConflict[]; total: number }>> {
    let query = this.db
      .from('context_conflicts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.status) query = query.eq('status', filter.status)
    if (filter.factKey) query = query.eq('fact_key', filter.factKey)

    query = query.order('created_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapContextConflict), total: count ?? 0 },
    }
  }

  async resolveContextConflict(
    workspaceId: string,
    conflictId: string,
    resolutionFactId: string,
    resolvedBy: string,
    note?: string,
  ): Promise<ServiceResult<ContextConflict>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('context_conflicts')
      .update({
        status: 'resolved',
        resolution_fact_id: resolutionFactId,
        resolved_by: resolvedBy,
        resolution_note: note ?? null,
        resolved_at: now,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', conflictId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapContextConflict(row) }
  }

  // ── Onboarding questions ─────────────────────────────────────────────────

  async createOnboardingQuestion(
    data: Omit<OnboardingQuestion, 'id'>,
  ): Promise<ServiceResult<OnboardingQuestion>> {
    const { data: row, error } = await this.db
      .from('onboarding_questions')
      .insert({
        workspace_id: data.workspaceId,
        session_id: data.sessionId,
        business_id: data.businessId,
        fact_key: data.factKey,
        question_type: data.questionType,
        question: data.question,
        options: data.options,
        reason: data.reason,
        priority: data.priority,
        status: data.status,
        answer: data.answer,
        answered_by: data.answeredBy,
        answered_at: data.answeredAt?.toISOString() ?? null,
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapOnboardingQuestion(row) }
  }

  async getOnboardingQuestion(
    workspaceId: string,
    questionId: string,
  ): Promise<ServiceResult<OnboardingQuestion | null>> {
    const { data, error } = await this.db
      .from('onboarding_questions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', questionId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapOnboardingQuestion(data) : null }
  }

  async listOnboardingQuestions(
    filter: QuestionFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: OnboardingQuestion[]; total: number }>> {
    let query = this.db
      .from('onboarding_questions')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('session_id', filter.sessionId)

    if (filter.status) query = query.eq('status', filter.status)

    query = query.order('priority', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapOnboardingQuestion), total: count ?? 0 },
    }
  }

  async answerOnboardingQuestion(
    workspaceId: string,
    questionId: string,
    answer: unknown,
    answeredBy: string,
  ): Promise<ServiceResult<OnboardingQuestion>> {
    const now = new Date().toISOString()
    const { data: row, error } = await this.db
      .from('onboarding_questions')
      .update({
        status: 'answered',
        answer,
        answered_by: answeredBy,
        answered_at: now,
      })
      .eq('workspace_id', workspaceId)
      .eq('id', questionId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapOnboardingQuestion(row) }
  }
}
