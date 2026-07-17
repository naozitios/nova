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
import type {
  PersistFactReconciliationConflict,
  PersistFactReconciliationCreate,
  PersistFactReconciliationResult,
  PersistFactReconciliationSupersede,
} from '@/core/business-context/repository/fact.port'
import { err, mapContextFact } from '../_shared'
import { ConflictRepository } from './conflict.repository'
import { QuestionRepository } from './question.repository'

// ─── ContextFact + ContextConflict + OnboardingQuestion ─────────────────────
//
// `FactRepository` keeps the legacy public API (a single class implementing
// all three entity contracts) by delegating the conflict and question methods
// to the entity-specific repositories. The fact methods remain inlined here
// because the file is named after the fact entity.

export class FactRepository {
  private conflict: ConflictRepository
  private question: QuestionRepository

  constructor(private db: SupabaseClient) {
    this.conflict = new ConflictRepository(db)
    this.question = new QuestionRepository(db)
  }

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

  // ── Context conflicts (delegated) ───────────────────────────────────────

  createContextConflict = (
    data: Parameters<ConflictRepository['createContextConflict']>[0],
  ): ReturnType<ConflictRepository['createContextConflict']> =>
    this.conflict.createContextConflict(data)

  getContextConflict = (
    workspaceId: string,
    conflictId: string,
  ): ReturnType<ConflictRepository['getContextConflict']> =>
    this.conflict.getContextConflict(workspaceId, conflictId)

  listContextConflicts = (
    filter: ConflictFilter,
    pagination?: PaginationParams,
  ): ReturnType<ConflictRepository['listContextConflicts']> =>
    this.conflict.listContextConflicts(filter, pagination)

  resolveContextConflict = (
    workspaceId: string,
    conflictId: string,
    resolutionFactId: string,
    resolvedBy: string,
    note?: string,
  ): ReturnType<ConflictRepository['resolveContextConflict']> =>
    this.conflict.resolveContextConflict(workspaceId, conflictId, resolutionFactId, resolvedBy, note)

  // ── Onboarding questions (delegated) ─────────────────────────────────────

  createOnboardingQuestion = (
    data: Parameters<QuestionRepository['createOnboardingQuestion']>[0],
  ): ReturnType<QuestionRepository['createOnboardingQuestion']> =>
    this.question.createOnboardingQuestion(data)

  getOnboardingQuestion = (
    workspaceId: string,
    questionId: string,
  ): ReturnType<QuestionRepository['getOnboardingQuestion']> =>
    this.question.getOnboardingQuestion(workspaceId, questionId)

  listOnboardingQuestions = (
    filter: QuestionFilter,
    pagination?: PaginationParams,
  ): ReturnType<QuestionRepository['listOnboardingQuestions']> =>
    this.question.listOnboardingQuestions(filter, pagination)

  answerOnboardingQuestion = (
    workspaceId: string,
    questionId: string,
    answer: unknown,
    answeredBy: string,
  ): ReturnType<QuestionRepository['answerOnboardingQuestion']> =>
    this.question.answerOnboardingQuestion(workspaceId, questionId, answer, answeredBy)

  dismissOnboardingQuestion = (
    workspaceId: string,
    questionId: string,
  ): ReturnType<QuestionRepository['dismissOnboardingQuestion']> =>
    this.question.dismissOnboardingQuestion(workspaceId, questionId)

  // ── Fact reconciliation RPC ──────────────────────────────────────────────

  async persistFactReconciliation(
    workspaceId: string,
    businessId: string,
    supersessionUpdates: PersistFactReconciliationSupersede[],
    factCreations: PersistFactReconciliationCreate[],
    conflicts?: PersistFactReconciliationConflict[],
  ): Promise<ServiceResult<PersistFactReconciliationResult>> {
    const { data, error } = await this.db.rpc('persist_fact_reconciliation', {
      p_workspace_id: workspaceId,
      p_business_id: businessId,
      p_supersession_updates: supersessionUpdates,
      p_fact_creations: factCreations,
      ...(conflicts && conflicts.length > 0 ? { p_conflicts: conflicts } : {}),
    })

    if (error) return err('RPC_FAILED', error.message)
    return { ok: true, data: data as PersistFactReconciliationResult }
  }
}
