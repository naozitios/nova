import { NextRequest } from 'next/server'
import {
  authenticateRequest,
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '../../../_shared'
import { getOnboardingReview } from '@/core/business-context/service'
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

  const authn = await authenticateRequest(req)
  if (!authn.ok) return authn.response

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'viewer', authn.userId)
  if (!authz.ok) return authz.response

  const client = getSupabaseServiceClient()
  const repo = new SupabaseRepository(client)

  const result = await getOnboardingReview(repo, businessId, wsResult.workspaceId)
  if (!result.ok) {
    const status = result.error.code === 'NO_SESSION' ? 404 : 500
    return errorResponse(status, result.error.code, result.error.message)
  }

  return jsonResponse({
    profile: result.data.profile,
    unresolved_fields: result.data.unresolvedFields,
    warnings: result.data.warnings,
    sources: result.data.sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      status: s.status,
    })),
    questions: result.data.questions.map((q) => ({
      fact_key: q.factKey,
      question: q.question,
      answer: q.answer,
    })),
  })
}
