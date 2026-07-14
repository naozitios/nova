import { NextRequest } from 'next/server'
import {
  requireAuthz,
  withIdempotency,
  errorResponse,
  jsonResponse,
} from '@/app/api/businesses/_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'
import { compileDraft } from '@/core/business-context/service'

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

// POST /api/businesses/{id}/context/draft — compile draft from active facts
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

    const result = await compileDraft(repo, businessId, wsResult.workspaceId)
    if (!result.ok) {
      return errorResponse(500, result.error.code, result.error.message)
    }

    return jsonResponse({
      profile: result.data.profile,
      unresolved_fields: result.data.unresolvedFields,
      warnings: result.data.warnings,
      markdown: result.data.markdown,
    })
  })
}
