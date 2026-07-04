import { NextRequest, NextResponse } from 'next/server';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';
import { config } from '@/infrastructure/config';
import { getMockAnalytics } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('meta_access_token')?.value || config.meta.appSecret;
  const accountId = request.nextUrl.searchParams.get('accountId') || request.cookies.get('meta_ad_account_id')?.value || config.meta.appId;

  if (!accessToken || !accountId) {
    return NextResponse.json(getMockAnalytics());
  }

  try {
    const metaAdapter = new MetaApiAdapter();
    const campaigns = await metaAdapter.getCampaigns(accountId, accessToken);
    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return NextResponse.json({
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalRevenue: 0,
        blendedCTR: 0,
        blendedROAS: 0,
        platformBreakdown: {
          meta: { spend: 0, impressions: 0, clicks: 0, revenue: 0 },
          google: { spend: 0, impressions: 0, clicks: 0, revenue: 0 },
        },
      });
    }

    const insights = await metaAdapter.getInsights(accountId, campaignIds, '30daysago', 'today', accessToken);

    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalRevenue = 0;

    for (const i of insights) {
      totalSpend += i.spend;
      totalImpressions += i.impressions;
      totalClicks += i.clicks;
      totalRevenue += i.conversionValue;
    }

    return NextResponse.json({
      totalSpend,
      totalImpressions,
      totalClicks,
      totalRevenue,
      blendedCTR: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      blendedROAS: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      platformBreakdown: {
        meta: { spend: totalSpend, impressions: totalImpressions, clicks: totalClicks, revenue: totalRevenue },
        google: { spend: 0, impressions: 0, clicks: 0, revenue: 0 },
      },
    });
  } catch (error) {
    return NextResponse.json({ error: { code: 'META_API_ERROR', message: error instanceof Error ? error.message : 'Failed to fetch analytics' } }, { status: 502 });
  }
}
