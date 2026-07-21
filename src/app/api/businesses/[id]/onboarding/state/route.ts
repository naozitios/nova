import { NextRequest } from 'next/server'
import {
  authenticateRequest,
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '../../../_shared'
import { getOnboardingState } from '@/core/business-context/service'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  const auth = await authenticateRequest(req)
  if (!auth.ok) return auth.response

  const client = getSupabaseServiceClient()
  const { data: business, error: bizError } = await client
    .from('businesses')
    .select('workspace_id')
    .eq('id', businessId)
    .single()

  if (bizError || !business) {
    return errorResponse(404, 'NOT_FOUND', 'Business not found')
  }

  const workspaceId = business.workspace_id as string

  const authz = await requireAuthz(req, workspaceId, 'viewer', auth.userId)
  if (!authz.ok) return authz.response

  const repo = new SupabaseRepository(client)
  const result = await getOnboardingState(repo, businessId, workspaceId)

  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }

  const role = authz.ctx.role
  const canApprove = role === 'admin' || role === 'owner'

  return jsonResponse({
    ...result.data,
    permissions: {
      canApprove,
      role,
    },
  })
}
