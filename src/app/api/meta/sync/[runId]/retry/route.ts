import { Container } from '@/di/container';
import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  withIdempotency,
  requireAuthz,
  errorResponse,
  jsonResponse,
} from '@/app/api/businesses/_shared'

const RetrySchema = z.object({
  workspace_id: z.string().uuid(),
})

// POST /api/meta/sync/[runId]/retry — schedule a sync retry
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  return withIdempotency(req, async () => {
    const { runId } = await params
    const body = await req.clone().json().catch(() => null)
    const queryWorkspaceId = new URL(req.url).searchParams.get('workspace_id')

    const workspaceId = body?.workspace_id ?? queryWorkspaceId
    if (!workspaceId) {
      return errorResponse(400, 'VALIDATION_ERROR', 'workspace_id is required in body or query')
    }

    const validation = RetrySchema.safeParse({ workspace_id: workspaceId })
    if (!validation.success) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid workspace_id')
    }

    const authz = await requireAuthz(req, workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const repo = Container.getMetaRepository()
    const result = await repo.scheduleSyncRetry(workspaceId, runId)

    if (!result.ok) {
      const status = result.error.code === 'SYNC_RUN_NOT_FOUND' ? 404 : 500
      return errorResponse(status, result.error.code, result.error.message)
    }

    const run = result.data
    return jsonResponse({
      run: {
        id: run.id,
        status: run.status,
        mode: run.mode,
        meta_ad_account_id: run.metaAdAccountId,
      },
    })
  }, { operation: 'meta_sync_retry' as const })
}
