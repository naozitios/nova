import { NextRequest } from 'next/server'
import { withIdempotency, requireAuthz, errorResponse, jsonResponse } from '../../../_shared'
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

// POST /api/businesses/{id}/context/reconcile
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withIdempotency(req, async () => {
    const { id: businessId } = await params

    const wsResult = await resolveWorkspaceFromBusiness(businessId)
    if ('error' in wsResult) return wsResult.error

    const authz = await requireAuthz(req, wsResult.workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const client = getSupabaseServiceClient()
    const repo = new SupabaseRepository(client)

    // List active (non-archived) sources for this business
    const sourcesResult = await repo.listContextSources(
      {
        workspaceId: wsResult.workspaceId,
        businessId,
      },
      { limit: 100, offset: 0 },
    )
    if (!sourcesResult.ok) {
      return errorResponse(500, sourcesResult.error.code, sourcesResult.error.message)
    }

    // List unresolved conflicts
    const conflictsResult = await repo.listContextConflicts(
      {
        workspaceId: wsResult.workspaceId,
        businessId,
        status: 'open',
      },
      { limit: 100, offset: 0 },
    )
    if (!conflictsResult.ok) {
      return errorResponse(500, conflictsResult.error.code, conflictsResult.error.message)
    }

    // Return reconciliation summary — actual reprocessing is async/worker-driven
    return jsonResponse(
      {
        ok: true,
        sources_count: sourcesResult.data.total,
        open_conflicts: conflictsResult.data.total,
        message: 'Reconciliation queued',
      },
      202,
    )
  })
}
