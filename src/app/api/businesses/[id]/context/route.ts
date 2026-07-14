import { NextRequest } from 'next/server'
import {
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '@/app/api/businesses/_shared'
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

// GET /api/businesses/{id}/context — current profile version
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

  const result = await repo.getCurrentProfileVersion(wsResult.workspaceId, businessId)
  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }
  if (!result.data) {
    return errorResponse(404, 'NOT_FOUND', 'No current profile version')
  }

  const v = result.data
  return jsonResponse({
    id: v.id,
    workspace_id: v.workspaceId,
    business_id: v.businessId,
    version: v.version,
    profile: v.profile,
    profile_markdown: v.profileMarkdown,
    status: v.status,
    change_summary: v.changeSummary,
    created_by: v.createdBy,
    created_at: v.createdAt.toISOString(),
    approved_by: v.approvedBy,
    approved_at: v.approvedAt?.toISOString() ?? null,
  })
}
