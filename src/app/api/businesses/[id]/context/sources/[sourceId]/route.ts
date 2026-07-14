import { NextRequest } from 'next/server'
import {
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '../../../../_shared'
import {
  getSource,
} from '@/core/business-context/service'
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
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id: businessId, sourceId } = await params

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const client = getSupabaseServiceClient()
  const repo = new SupabaseRepository(client)

  const result = await getSource(repo, businessId, wsResult.workspaceId, sourceId)
  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }
  if (!result.data) {
    return errorResponse(404, 'NOT_FOUND', 'Source not found')
  }

  const s = result.data
  return jsonResponse({
    id: s.id,
    workspace_id: s.workspaceId,
    business_id: s.businessId,
    source_type: s.sourceType,
    source_name: s.sourceName,
    external_reference: s.externalReference,
    status: s.status,
    current_stage: s.currentStage,
    terminal_outcome: s.terminalOutcome,
    metadata: s.metadata,
    collected_at: s.collectedAt.toISOString(),
  })
}
