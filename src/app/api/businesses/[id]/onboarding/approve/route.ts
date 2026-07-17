import { NextRequest } from 'next/server'
import {
  withIdempotency,
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '../../../_shared'
import { approveV1 } from '@/core/business-context/service'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'

const APPROVAL_ERROR_STATUS: Record<string, number> = {
  NO_SESSION: 404,
  SESSION_NOT_READY: 409,
  EVIDENCE_SOURCE_REQUIRED: 422,
  SOURCE_NOT_PROCESSED: 409,
  QUALITY_GATE_BLOCKING: 409,
  ACTIVE_JOB: 409,
  MISSING_REQUIRED_FACT: 422,
  REQUIRED_KEY_UNKNOWN: 422,
  OPEN_CONFLICTS: 409,
  PROFILE_INCOMPLETE: 422,
}

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withIdempotency(req, async () => {
    const { id: businessId } = await params

    const wsResult = await resolveWorkspaceFromBusiness(businessId)
    if ('error' in wsResult) return wsResult.error

    // Approve requires admin or owner role
    const authz = await requireAuthz(req, wsResult.workspaceId, 'admin')
    if (!authz.ok) return authz.response

    const client = getSupabaseServiceClient()
    const repo = new SupabaseRepository(client)

    const result = await approveV1(
      repo,
      businessId,
      wsResult.workspaceId,
      authz.ctx.userId,
    )
    if (!result.ok) {
      const status = APPROVAL_ERROR_STATUS[result.error.code] ?? 500
      return errorResponse(status, result.error.code, result.error.message, result.error.details)
    }

    const v = result.data
    return jsonResponse({
      id: v.id,
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
  }, { operation: 'approve_onboarding' as const })
}
