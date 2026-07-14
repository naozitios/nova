import { NextRequest } from 'next/server'
import { requireAuthz, errorResponse, jsonResponse, parsePagination } from '../../../_shared'
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

// GET /api/businesses/{id}/context/conflicts
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
  const pagination = parsePagination(req)

  const url = new URL(req.url)
  const status = url.searchParams.get('status') as 'open' | 'resolved' | null

  const result = await repo.listContextConflicts(
    {
      workspaceId: wsResult.workspaceId,
      businessId,
      status: status ?? 'open',
    },
    pagination,
  )

  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }

  return jsonResponse(result.data)
}
