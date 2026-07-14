import { NextRequest } from 'next/server'
import {
  withIdempotency,
  requireAuthz,
  createdResponse,
  errorResponse,
  jsonResponse,
} from '../../_shared'
import { createSession, getSession } from '@/core/business-context/service'
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: businessId } = await params

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  const authz = await requireAuthz(req, wsResult.workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const client = getSupabaseServiceClient()
  const repo = new SupabaseRepository(client)

  const result = await getSession(repo, businessId, wsResult.workspaceId)
  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }
  if (!result.data) {
    return errorResponse(404, 'NOT_FOUND', 'No onboarding session found')
  }

  const s = result.data
  return jsonResponse({
    id: s.id,
    workspace_id: s.workspaceId,
    business_id: s.businessId,
    status: s.status,
    current_step: s.currentStep,
    started_by: s.startedBy,
    started_at: s.startedAt.toISOString(),
    completed_at: s.completedAt?.toISOString() ?? null,
    error: s.error,
  })
}

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

    const result = await createSession(repo, businessId, wsResult.workspaceId, authz.ctx.userId)
    if (!result.ok) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500
      return errorResponse(status, result.error.code, result.error.message)
    }

    const s = result.data
    return createdResponse({
      id: s.id,
      workspace_id: s.workspaceId,
      business_id: s.businessId,
      status: s.status,
      current_step: s.currentStep,
      started_by: s.startedBy,
      started_at: s.startedAt.toISOString(),
      completed_at: s.completedAt?.toISOString() ?? null,
      error: s.error,
    })
  })
}
