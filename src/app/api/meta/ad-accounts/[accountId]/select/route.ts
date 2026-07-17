import { NextRequest } from 'next/server'
import { requireAuthz, errorResponse, jsonResponse } from '@/app/api/businesses/_shared'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'

const repo = new SupabaseMetaRepository()

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params

  const body = await req.json().catch(() => null)
  if (!body?.workspace_id || !body?.business_id) {
    return errorResponse(400, 'VALIDATION_ERROR', 'workspace_id and business_id are required in request body')
  }

  const authz = await requireAuthz(req, body.workspace_id, 'editor')
  if (!authz.ok) return authz.response

  const result = await repo.selectAdAccount({
    workspaceId: body.workspace_id,
    metaAccountId: accountId,
    businessId: body.business_id,
  })

  if (!result.ok) {
    const status = result.error.code === 'AD_ACCOUNT_NOT_FOUND' ? 404 : 500
    return errorResponse(status, result.error.code, result.error.message)
  }

  return jsonResponse({ account: result.data })
}
