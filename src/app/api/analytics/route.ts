import { NextRequest, NextResponse } from 'next/server'
import { requireAuthz } from '@/app/api/businesses/_shared'
import { getStoredAnalyticsSummary } from '@/core/meta-data/analytics-query.service'
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

  const summary = await getStoredAnalyticsSummary(repo, { workspaceId, businessId, since, until })
  if (!summary.ok) {
    const status = summary.error.code === 'NOT_SYNCED' ? 409 : 500
    return NextResponse.json({ error: summary.error }, { status })
  }

  const totalSpend = summary.data.spend
  const totalImpressions = summary.data.impressions
  const totalClicks = summary.data.clicks

  return NextResponse.json({
    totalSpend,
    totalImpressions,
    totalClicks,
    totalRevenue: 0,
    blendedCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
    blendedROAS: 0,
    platformBreakdown: {
      meta: { spend: totalSpend, impressions: totalImpressions, clicks: totalClicks, revenue: 0 },
      google: { spend: 0, impressions: 0, clicks: 0, revenue: 0 },
    },
  })
}
