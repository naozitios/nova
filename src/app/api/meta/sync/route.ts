import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/di/container';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';
import { MetaMapper } from '@/infrastructure/meta/meta-mapper';

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('meta_access_token')?.value;
  const body = await request.json().catch(() => ({}));
  const accountId = body.accountId || request.cookies.get('meta_ad_account_id')?.value;

  if (!accessToken || !accountId) {
    return NextResponse.json({ error: { code: 'AUTH_ERROR', message: 'Meta not connected. Please connect your Meta account.' } }, { status: 401 });
  }

  try {
    const metaAdapter = new MetaApiAdapter();
    const mapper = new MetaMapper();
    const campaignService = Container.getCampaignService();
    await Container.getCampaignSeed().ensure();

    const metaCampaigns = await metaAdapter.getCampaigns(accountId, accessToken);
    const existing = await campaignService.list();
    const existingIds = new Set(existing.map(e => e.id));

    let imported = 0;
    let updated = 0;
    const drifts: Array<{ campaignId: string; campaignName: string; drifts: unknown[] }> = [];

    for (const metaCampaign of metaCampaigns) {
      const config = mapper.toCampaignConfig(metaCampaign);
      const localId = `meta-${metaCampaign.id}`;

      if (existingIds.has(localId)) {
        const entry = await campaignService.get(localId);
        if (entry) {
          const driftReport = await campaignService.checkDrift(localId, config);
          if (driftReport?.hasDrift) {
            drifts.push({ campaignId: localId, campaignName: config.name, drifts: driftReport.drifts });
          }
        }
        updated++;
      } else {
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
        imported++;
      }
    }

    return NextResponse.json({
      imported,
      updated,
      drifts,
      total: metaCampaigns.length,
    });
  } catch (error) {
    return NextResponse.json({ error: { code: 'META_API_ERROR', message: error instanceof Error ? error.message : 'Sync failed' } }, { status: 502 });
  }
}
