import { NextRequest } from 'next/server'
import { requireAuthz, errorResponse, notFound, jsonResponse } from '@/app/api/businesses/_shared'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'

// GET /api/meta/sync-runs/[runId] — get sync run status
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspace_id')

  if (!workspaceId) {
    return errorResponse(400, 'VALIDATION_ERROR', 'workspace_id query parameter is required')
  }

  const authz = await requireAuthz(req, workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const repo = new SupabaseMetaRepository()
  const result = await repo.getSyncRun(workspaceId, runId)

  if (!result.ok) {
    return errorResponse(500, result.error.code, result.error.message)
  }

  if (!result.data) {
    return notFound('Sync run not found')
  }

  const run = result.data
  return jsonResponse({
    id: run.id,
    status: run.status,
    mode: run.mode,
    meta_ad_account_id: run.metaAdAccountId,
  })
}
