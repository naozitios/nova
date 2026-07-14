import type { SupabaseClient } from '@supabase/supabase-js'
import type { OnboardingQuestion, ServiceResult } from '@/core/business-context/types'
import type {
  PaginationParams,
  QuestionFilter,
} from '@/core/business-context/repository.port'
import { err, mapOnboardingQuestion } from '../_shared'

// ─── OnboardingQuestion ─────────────────────────────────────────────────────

export class QuestionRepository {
  constructor(private db: SupabaseClient) {}

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
