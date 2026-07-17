import { NextRequest } from 'next/server'
import { requireAuthz, errorResponse, jsonResponse } from '@/app/api/businesses/_shared'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'

const repo = new SupabaseMetaRepository()

function requiredParam(url: URL, key: string): string | Response {
  const value = url.searchParams.get(key)
  if (!value) return errorResponse(400, 'VALIDATION_ERROR', `${key} query parameter is required`)
  return value
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const workspaceId = requiredParam(url, 'workspace_id')
  if (workspaceId instanceof Response) return workspaceId
  const businessId = requiredParam(url, 'business_id')
  if (businessId instanceof Response) return businessId

  const authz = await requireAuthz(req, workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const accountsResult = await repo.listAdAccounts(workspaceId)
  if (!accountsResult.ok) {
    return errorResponse(500, accountsResult.error.code, accountsResult.error.message)
  }

  const selected = accountsResult.data.find((account) => account.businessId === businessId && account.isSelected)
  if (!selected) {
    return errorResponse(409, 'NO_SELECTED_META_ACCOUNT', 'No selected Meta ad account for this business')
  }

  const freshnessResult = await repo.getDataFreshness({
    workspaceId,
    metaAdAccountId: selected.id,
    since: url.searchParams.get('since') ?? undefined,
    until: url.searchParams.get('until') ?? undefined,
  })
  if (!freshnessResult.ok) {
    return errorResponse(500, freshnessResult.error.code, freshnessResult.error.message)
  }

  return jsonResponse({
    freshness: {
      latestDate: freshnessResult.data.latestDate,
      missingWindowCount: freshnessResult.data.missingWindowCount,
      gapCount: freshnessResult.data.gapCount,
    },
  })
}
