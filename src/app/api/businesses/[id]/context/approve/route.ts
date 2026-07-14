import { NextRequest } from 'next/server'
import {
  requireAuthz,
  withIdempotency,
  errorResponse,
  createdResponse,
} from '@/app/api/businesses/_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'
import { approveContext } from '@/core/business-context/service'

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

// POST /api/businesses/{id}/context/approve — approve a draft profile as current
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withIdempotency(req, async () => {
    const { id: businessId } = await params

    const wsResult = await resolveWorkspaceFromBusiness(businessId)
    if ('error' in wsResult) return wsResult.error

    // Require admin/owner for approval
    const authz = await requireAuthz(req, wsResult.workspaceId, 'admin')
    if (!authz.ok) return authz.response

    const client = getSupabaseServiceClient()
    const repo = new SupabaseRepository(client)

    // Compile draft to get the profile to approve
    const { compileDraft } = await import('@/core/business-context/service')
    const draftResult = await compileDraft(repo, businessId, wsResult.workspaceId)
    if (!draftResult.ok) {
      return errorResponse(500, draftResult.error.code, draftResult.error.message)
    }

    const result = await approveContext(repo, {
      businessId,
      workspaceId: wsResult.workspaceId,
      profile: draftResult.data.profile,
      approvedBy: authz.ctx.userId,
    })
    if (!result.ok) {
      return errorResponse(500, result.error.code, result.error.message)
    }

    const v = result.data
    return createdResponse({
      id: v.id,
      workspace_id: v.workspaceId,
      business_id: v.businessId,
      version: v.version,
      profile: v.profile,
      status: v.status,
      change_summary: v.changeSummary,
      created_by: v.createdBy,
      created_at: v.createdAt.toISOString(),
      approved_by: v.approvedBy,
      approved_at: v.approvedAt?.toISOString() ?? null,
    })
  })
}
