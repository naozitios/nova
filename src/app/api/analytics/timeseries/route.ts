import { NextRequest, NextResponse } from 'next/server';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';
import { config } from '@/infrastructure/config';
import { getMockTimeSeries } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('meta_access_token')?.value || config.meta.appSecret;
  const accountId = request.nextUrl.searchParams.get('accountId') || request.cookies.get('meta_ad_account_id')?.value || config.meta.appId;

  if (!accessToken || !accountId) {
    return NextResponse.json(getMockTimeSeries());
  }

  try {
    const metaAdapter = new MetaApiAdapter();
    const campaigns = await metaAdapter.getCampaigns(accountId, accessToken);
    const campaignIds = campaigns.map(c => c.id);

    if (campaignIds.length === 0) {
      return NextResponse.json([]);
    }

    const insights = await metaAdapter.getInsights(accountId, campaignIds, '30daysago', 'today', accessToken);

    const snapshots = insights.map(i => ({
      date: i.campaignId ? new Date().toISOString().split('T')[0] : '',
      platform: 'meta' as const,
      campaignId: i.campaignId,
      campaignName: i.campaignName,
      spend: i.spend,
      impressions: i.impressions,
      clicks: i.clicks,
      revenue: i.conversionValue,
    }));

    return NextResponse.json(snapshots);
  } catch (error) {
    return NextResponse.json({ error: { code: 'META_API_ERROR', message: error instanceof Error ? error.message : 'Failed to fetch time series' } }, { status: 502 });
  }
}
