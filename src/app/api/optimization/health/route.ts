import { NextRequest, NextResponse } from 'next/server';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';
import { HealthService } from '@/core/optimization/health.service';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('meta_access_token')?.value;
  const accountId = request.nextUrl.searchParams.get('accountId') || request.cookies.get('meta_ad_account_id')?.value;

  if (!accessToken || !accountId) {
    return NextResponse.json({ error: { code: 'AUTH_ERROR', message: 'Meta not connected' } }, { status: 401 });
  }

  try {
    const metaAdapter = new MetaApiAdapter();
    const healthService = new HealthService();

    const campaigns = await metaAdapter.getCampaigns(accountId, accessToken);
    const campaignIds = campaigns.map(c => c.id);
    const insights = campaignIds.length > 0
      ? await metaAdapter.getInsights(accountId, campaignIds, '30daysago', 'today', accessToken)
      : [];

    const mappedCampaigns = campaigns.map(c => ({
      id: c.id,
      name: c.name,
      objective: c.objective,
      status: c.status,
      dailyBudget: c.dailyBudget,
      lifetimeBudget: c.lifetimeBudget,
    }));

    const mappedInsights = insights.map(i => ({
      campaignId: i.campaignId || '',
      campaignName: i.campaignName || '',
      impressions: i.impressions,
      clicks: i.clicks,
      spend: i.spend,
      reach: i.reach,
      frequency: i.frequency,
      ctr: i.ctr,
      cpc: i.cpc,
      cpm: i.cpm,
      conversions: i.conversions,
      costPerConversion: i.costPerConversion,
      roas: i.roas,
      conversionValue: i.conversionValue,
    }));

    const health = healthService.runAudit(mappedCampaigns, mappedInsights);
    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json({ error: { code: 'META_API_ERROR', message: error instanceof Error ? error.message : 'Health check failed' } }, { status: 502 });
  }
}
