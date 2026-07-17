import { NextRequest } from 'next/server'
import {
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '@/app/api/businesses/_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'
import { compareVersions } from '@/core/business-context/service'

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

// GET /api/businesses/{id}/context/versions/compare?from=X&to=Y
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  const from = req.nextUrl.searchParams.get('from')
  const to = req.nextUrl.searchParams.get('to')

  if (!from || !to) {
    return errorResponse(400, 'VALIDATION_ERROR', 'from and to query parameters are required')
  }

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const client = getSupabaseServiceClient()
  const repo = new SupabaseRepository(client)

  const result = await compareVersions(repo, businessId, wsResult.workspaceId, from, to)

  if (!result.ok) {
    if (result.error.code === 'NOT_FOUND') {
      return errorResponse(404, 'NOT_FOUND', result.error.message)
    }
    return errorResponse(500, result.error.code, result.error.message)
  }

  const changes = Object.entries(result.data.diffs).map(([key, diff]) => ({
    field_path: key,
    previous_value: diff.before,
    proposed_value: diff.after,
  }))

  return jsonResponse({
    from_version_id: result.data.fromVersion,
    to_version_id: result.data.toVersion,
    changes,
  })
}
