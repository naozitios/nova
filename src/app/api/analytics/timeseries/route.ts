import { NextRequest, NextResponse } from 'next/server'
import { requireAuthz } from '@/app/api/businesses/_shared'
import { getStoredTimeseries } from '@/core/meta-data/analytics-query.service'
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository'

const repo = new SupabaseMetaRepository()

function getRequiredParam(request: NextRequest, key: string): string | Response {
  const value = request.nextUrl.searchParams.get(key)
  if (!value) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: `${key} query parameter is required` } },
      { status: 400 },
    )
  }
  return value
}

export async function GET(request: NextRequest) {
  const workspaceId = getRequiredParam(request, 'workspace_id')
  if (workspaceId instanceof Response) return workspaceId
  const businessId = getRequiredParam(request, 'business_id')
  if (businessId instanceof Response) return businessId
  const since = getRequiredParam(request, 'since')
  if (since instanceof Response) return since
  const until = getRequiredParam(request, 'until')
  if (until instanceof Response) return until

  const authz = await requireAuthz(request, workspaceId, 'viewer')
  if (!authz.ok) return authz.response

  const timeseries = await getStoredTimeseries(repo, { workspaceId, businessId, since, until })
  if (!timeseries.ok) {
    const status = timeseries.error.code === 'NOT_SYNCED' ? 409 : 500
    return NextResponse.json({ error: timeseries.error }, { status })
  }

  return NextResponse.json(timeseries.data.map((point) => ({
    date: point.date,
    platform: 'meta' as const,
    spend: point.spend,
    impressions: point.impressions,
    clicks: point.clicks,
    revenue: 0,
  })))
}
