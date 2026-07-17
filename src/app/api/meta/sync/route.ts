import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  withIdempotency,
  requireAuthz,
  errorResponse,
  createdResponse,
} from '@/app/api/businesses/_shared'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'

const SyncStartSchema = z.object({
  workspace_id: z.string().uuid(),
  business_id: z.string().uuid(),
  mode: z.enum(['initial_backfill', 'manual_refresh']),
})

// POST /api/meta/sync — start a sync run
export async function POST(req: NextRequest) {
  return withIdempotency(req, async () => {
    const body = await req.clone().json().catch(() => null)
    if (!body) {
      return errorResponse(400, 'INVALID_BODY', 'Request body must be valid JSON')
    }

    const validation = SyncStartSchema.safeParse(body)
    if (!validation.success) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid request data', validation.error.flatten().fieldErrors)
    }

    const { workspace_id: workspaceId, business_id: businessId, mode } = validation.data

    const authz = await requireAuthz(req, workspaceId, 'editor')
    if (!authz.ok) return authz.response

    const repo = new SupabaseMetaRepository()

    // Find selected ad account for this business
    const accountsResult = await repo.listAdAccounts(workspaceId)
    if (!accountsResult.ok) {
      return errorResponse(500, accountsResult.error.code, accountsResult.error.message)
    }

    const selected = accountsResult.data.find(
      (a) => a.businessId === businessId && a.isSelected,
    )
    if (!selected) {
      return errorResponse(409, 'NO_SELECTED_META_ACCOUNT', 'No selected Meta ad account for this business')
    }

    const idempotencyKey = req.headers.get('idempotency-key') ?? crypto.randomUUID()
    const runResult = await repo.createSyncRun({
      workspaceId,
      metaAdAccountId: selected.id,
      mode,
      idempotencyKey,
    })

    if (!runResult.ok) {
      return errorResponse(500, runResult.error.code, runResult.error.message)
    }

    const run = runResult.data
    return createdResponse({
      run: {
        id: run.id,
        status: run.status,
        mode: run.mode,
        meta_ad_account_id: run.metaAdAccountId,
      },
    })
  }, { operation: 'meta_sync_start' as const })
}
