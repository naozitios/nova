import { NextRequest, NextResponse } from 'next/server';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';
import { HealthService } from '@/core/optimization/health.service';
import { ActionCenter } from '@/core/optimization/action-center';

let actionCenter: ActionCenter | null = null;

function getActionCenter(): ActionCenter {
  if (!actionCenter) actionCenter = new ActionCenter();
  return actionCenter;
}

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('meta_access_token')?.value;
  const body = await request.json().catch(() => ({}));
  const accountId = body.accountId || request.cookies.get('meta_ad_account_id')?.value;

  if (!accessToken || !accountId) {
    return NextResponse.json({ error: { code: 'AUTH_ERROR', message: 'Meta not connected' } }, { status: 401 });
  }

  try {
    const metaAdapter = new MetaApiAdapter();
    const healthService = new HealthService();
    const center = getActionCenter();

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
      campaignId: i.campaignId,
      campaignName: i.campaignName,
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

    const recommendations = healthService.generateRecommendations(mappedCampaigns, mappedInsights);
    const created: string[] = [];

    for (const rec of recommendations) {
      const isExisting = center.list('pending_review').some(a => a.reason === rec.finding);
      if (!isExisting) {
        center.createAction({
          action: rec.recommendedAction,
          source: rec.type,
          priority: rec.confidence === 'high' ? 'high' : rec.confidence === 'medium' ? 'medium' : 'low',
          risk: rec.type === 'budget_waste' ? 'low' : rec.type === 'scaling' ? 'medium' : 'high',
          estimatedImpact: rec.expectedImpact,
          category: rec.type === 'budget_waste' ? 'reduce' : rec.type === 'scaling' ? 'scale' : rec.type === 'creative_fatigue' ? 'fix' : 'fix',
          description: rec.finding,
          reason: rec.finding,
          evidence: rec.evidence,
          affectedCampaigns: [rec.campaignName],
        });
        created.push(rec.id);
      }
    }

    return NextResponse.json({ generated: recommendations.length, created: created.length });
  } catch (error) {
    return NextResponse.json({ error: { code: 'META_API_ERROR', message: error instanceof Error ? error.message : 'Refresh failed' } }, { status: 502 });
  }
}
