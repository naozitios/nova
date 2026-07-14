import { NextRequest } from 'next/server'
import {
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '../../../_shared'
import { getSession } from '@/core/business-context/service'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'

async function resolveWorkspaceFromBusiness(
  businessId: string,
): Promise<{ workspaceId: string } | { error: Response }> {
  const client = getSupabaseServiceClient()
  const { data, error } = await client
    .from('businesses')
    .select('workspace_id')
    .eq('id', businessId)
    .single()

  if (error || !data) {
    return { error: errorResponse(404, 'NOT_FOUND', 'Business not found') }
  }
  return { workspaceId: data.workspace_id as string }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const client = getSupabaseServiceClient()
  const repo = new SupabaseRepository(client)

  const sessionResult = await getSession(repo, businessId, wsResult.workspaceId)
  if (!sessionResult.ok) {
    return errorResponse(500, sessionResult.error.code, sessionResult.error.message)
  }
  if (!sessionResult.data) {
    return jsonResponse({ questions: [] })
  }

  const questionsResult = await repo.listOnboardingQuestions({
    workspaceId: wsResult.workspaceId,
    sessionId: sessionResult.data.id,
    status: 'open',
  })
  if (!questionsResult.ok) {
    return errorResponse(500, questionsResult.error.code, questionsResult.error.message)
  }

  return jsonResponse({
    questions: questionsResult.data.items.map((q) => ({
      id: q.id,
      session_id: q.sessionId,
      business_id: q.businessId,
      fact_key: q.factKey,
      question_type: q.questionType,
      question: q.question,
      options: q.options,
      reason: q.reason,
      priority: q.priority,
      status: q.status,
      answer: q.answer,
    })),
  })
}
