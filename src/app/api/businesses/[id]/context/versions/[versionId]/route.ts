import { NextRequest } from 'next/server'
import {
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '@/app/api/businesses/_shared'
import { getVersion } from '@/core/business-context/service'
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
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id: businessId, versionId } = await params
  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const repo = new SupabaseRepository(getSupabaseServiceClient())
  const result = await getVersion(repo, businessId, wsResult.workspaceId, versionId)
  if (!result.ok) return errorResponse(500, result.error.code, result.error.message)
  if (!result.data) return errorResponse(404, 'NOT_FOUND', 'Profile version not found')

  const version = result.data
  return jsonResponse({
    id: version.id,
    version: version.version,
    status: version.status,
    profile: version.profile,
    base_version_id: null,
    approved_by: version.approvedBy,
    approved_at: version.approvedAt?.toISOString() ?? null,
    updated_at: version.createdAt.toISOString(),
    change_summary: version.changeSummary,
    draft_change_count: 0,
    section_readiness: [],
  })
}
