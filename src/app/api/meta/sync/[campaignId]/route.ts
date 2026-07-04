import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/di/container';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';
import { MetaMapper } from '@/infrastructure/meta/meta-mapper';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ campaignId: string }> }) {
  const accessToken = _request.cookies.get('meta_access_token')?.value;
  const accountId = _request.cookies.get('meta_ad_account_id')?.value;
  const { campaignId } = await params;

  if (!accessToken || !accountId) {
    return NextResponse.json({ error: { code: 'AUTH_ERROR', message: 'Meta not connected.' } }, { status: 401 });
  }

  try {
    const metaAdapter = new MetaApiAdapter();
    const mapper = new MetaMapper();
    const campaignService = Container.getCampaignService();

    const metaCampaigns = await metaAdapter.getCampaigns(accountId, accessToken);
    const metaCampaign = metaCampaigns.find(c => c.id === campaignId);

    if (!metaCampaign) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: `Campaign ${campaignId} not found on Meta.` } }, { status: 404 });
    }

    const config = mapper.toCampaignConfig(metaCampaign);
    const localId = `meta-${metaCampaign.id}`;
    const entry = await campaignService.get(localId);

    if (!entry) {
      await campaignService.create({
        name: config.name,
        platform: ['meta'],
        objective: config.objective,
        totalBudget: config.totalBudget.toString(),
        startDate: config.startDate,
        endDate: config.endDate,
        countries: config.adSets[0]?.targeting.countries?.join(', ') || '',
        ageMin: (config.adSets[0]?.targeting.ageRange?.[0] || 18).toString(),
        ageMax: (config.adSets[0]?.targeting.ageRange?.[1] || 65).toString(),
        languages: config.adSets[0]?.targeting.languages?.join(', ') || '',
        headline: config.adSets[0]?.creatives[0]?.headline || '',
        bodyText: config.adSets[0]?.creatives[0]?.bodyText || '',
        destinationUrl: config.adSets[0]?.creatives[0]?.destinationUrl || '',
        mediaUrl: config.adSets[0]?.creatives[0]?.mediaUrl || '',
      }, 'meta-sync');
      return NextResponse.json({ imported: true, drift: null });
    }

    const driftReport = await campaignService.checkDrift(localId, config);
    return NextResponse.json({
      imported: false,
      drift: driftReport?.hasDrift ? driftReport.drifts : null,
    });
  } catch (error) {
    return NextResponse.json({ error: { code: 'META_API_ERROR', message: error instanceof Error ? error.message : 'Sync failed' } }, { status: 502 });
  }
}
