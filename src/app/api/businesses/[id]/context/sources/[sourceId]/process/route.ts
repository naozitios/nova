import { NextRequest } from 'next/server'
import {
  withIdempotency,
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '../../../../../_shared'
import {
  processSource,
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> },
) {
  const { id: businessId, sourceId } = await params

  const wsResult = await resolveWorkspaceFromBusiness(businessId)
  if ('error' in wsResult) return wsResult.error

  return withIdempotency(req, async () => {
    const authz = await requireAuthz(req, wsResult.workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const client = getSupabaseServiceClient()
    const repo = new SupabaseRepository(client)

    const result = await processSource(repo, businessId, wsResult.workspaceId, sourceId)
    if (!result.ok) {
      const status = result.error.code === 'NOT_FOUND' ? 404 : 500
      return errorResponse(status, result.error.code, result.error.message)
    }

    const j = result.data
    return jsonResponse({
      id: j.id,
      workspace_id: j.workspaceId,
      business_id: j.businessId,
      session_id: j.sessionId,
      job_type: j.jobType,
      status: j.status,
      attempt_count: j.attemptCount,
      max_attempts: j.maxAttempts,
      idempotency_key: j.idempotencyKey,
      stage: j.stage,
      input: j.input,
      output: j.output,
      error: j.error,
      error_class: j.errorClass,
      next_run_at: j.nextRunAt?.toISOString() ?? null,
      heartbeat_at: j.heartbeatAt?.toISOString() ?? null,
      created_at: j.createdAt.toISOString(),
    }, 202)
  }, { operation: 'process_source' as const, workspaceId: wsResult.workspaceId })
}
