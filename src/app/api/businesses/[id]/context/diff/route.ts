import { NextRequest } from 'next/server'
import {
  requireAuthz,
  parseJsonBody,
  errorResponse,
  jsonResponse,
} from '@/app/api/businesses/_shared'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'
import { compileDraft, computeDiff } from '@/core/business-context/service'

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

// GET /api/businesses/{id}/context/diff — compare draft vs current profile
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

  // Compile draft from active facts
  const draftResult = await compileDraft(repo, businessId, wsResult.workspaceId)
  if (!draftResult.ok) {
    return errorResponse(500, draftResult.error.code, draftResult.error.message)
  }

  // Compute diff between current and draft
  const diffResult = await computeDiff(
    repo,
    businessId,
    wsResult.workspaceId,
    draftResult.data.profile,
  )
  if (!diffResult.ok) {
    return errorResponse(500, diffResult.error.code, diffResult.error.message)
  }

  // Convert FieldDiffMap to array format
  const fields = Object.entries(diffResult.data.diffs).map(([key, diff]) => ({
    key,
    current: diff.before,
    draft: diff.after,
  }))

  return jsonResponse({
    current_version: diffResult.data.currentVersion,
    draft_version: diffResult.data.draftVersion,
    fields,
  })
}
