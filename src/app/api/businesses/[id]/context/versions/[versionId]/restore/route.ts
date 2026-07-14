import { NextRequest } from 'next/server'
import {
  requireAuthz,
  withIdempotency,
  errorResponse,
  createdResponse,
} from '@/app/api/businesses/_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'
import { restoreContextVersion } from '@/core/business-context/service'

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

// POST /api/businesses/{id}/context/versions/{versionId}/restore — restore a previous version
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  return withIdempotency(req, async () => {
    const { id: businessId, versionId } = await params

    const wsResult = await resolveWorkspaceFromBusiness(businessId)
    if ('error' in wsResult) return wsResult.error

    // Require admin/owner for restore
    const authz = await requireAuthz(req, wsResult.workspaceId, 'admin')
    if (!authz.ok) return authz.response

    const client = getSupabaseServiceClient()
    const repo = new SupabaseRepository(client)

    const result = await restoreContextVersion(repo, {
      businessId,
      workspaceId: wsResult.workspaceId,
      versionId,
      restoredBy: authz.ctx.userId,
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
