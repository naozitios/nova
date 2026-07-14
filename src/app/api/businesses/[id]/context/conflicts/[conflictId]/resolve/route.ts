import { NextRequest } from 'next/server'
import { requireAuthz, errorResponse, jsonResponse, parseJsonBody, validateWithSchema, withIdempotency } from '../../../../../_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'
import { z } from 'zod'

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

const ResolveSchema = z.object({
  resolutionFactId: z.string().uuid(),
  note: z.string().optional(),
})

// POST /api/businesses/{id}/context/conflicts/{conflictId}/resolve
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; conflictId: string }> },
) {
  return withIdempotency(req, async () => {
    const { id: businessId, conflictId } = await params

    const wsResult = await resolveWorkspaceFromBusiness(businessId)
    if ('error' in wsResult) return wsResult.error

    const authz = await requireAuthz(req, wsResult.workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const body = await parseJsonBody(req)
    if (!body.ok) return body.response

    const validated = validateWithSchema(ResolveSchema, body.data)
    if (!validated.ok) return validated.response

    const client = getSupabaseServiceClient()
    const repo = new SupabaseRepository(client)

    // Verify conflict exists and is open
    const conflict = await repo.getContextConflict(wsResult.workspaceId, conflictId)
    if (!conflict.ok) {
      return errorResponse(500, conflict.error.code, conflict.error.message)
    }
    if (!conflict.data) {
      return errorResponse(404, 'NOT_FOUND', 'Conflict not found')
    }
    if (conflict.data.status === 'resolved') {
      return errorResponse(409, 'CONFLICT', 'Conflict already resolved')
    }

    // Verify resolution fact exists
    const fact = await repo.getContextFact(wsResult.workspaceId, validated.data.resolutionFactId)
    if (!fact.ok) {
      return errorResponse(500, fact.error.code, fact.error.message)
    }
    if (!fact.data) {
      return errorResponse(404, 'NOT_FOUND', 'Resolution fact not found')
    }

    const result = await repo.resolveContextConflict(
      wsResult.workspaceId,
      conflictId,
      validated.data.resolutionFactId,
      authz.ctx.userId,
      validated.data.note,
    )

    if (!result.ok) {
      return errorResponse(500, result.error.code, result.error.message)
    }

    return jsonResponse(result.data)
  })
}
