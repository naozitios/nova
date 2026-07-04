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

    const entry = await campaignService.get(campaignId);
    if (!entry) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Campaign not found.' } }, { status: 404 });
    }

    const plan = await campaignService.getExecutionPlan(campaignId);
    if (!plan) {
      return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Could not generate execution plan.' } }, { status: 500 });
    }

    const results: Array<{ action: string; resource: string; success: boolean; message: string; metaId?: string }> = [];

    for (const action of plan.platformActions) {
      try {
        switch (action.action) {
          case 'create': {
            const input = mapper.toCampaignInput(entry.config, 'ACTIVE');
            const result = await metaAdapter.createCampaign(accountId, input, accessToken);
            results.push({ action: 'create', resource: action.resourceName, success: true, message: 'Campaign created on Meta.', metaId: result.id });
            break;
          }
          case 'update': {
            const input = mapper.toCampaignInput(entry.config, 'ACTIVE');
            const result = await metaAdapter.updateCampaign(campaignId.replace('meta-', ''), input, accessToken);
            results.push({ action: 'update', resource: action.resourceName, success: true, message: 'Campaign updated on Meta.', metaId: result.id });
            break;
          }
          case 'pause': {
            await metaAdapter.pauseCampaign(campaignId.replace('meta-', ''), accessToken);
            results.push({ action: 'pause', resource: action.resourceName, success: true, message: 'Campaign paused on Meta.' });
            break;
          }
          case 'delete': {
            await metaAdapter.deleteCampaign(campaignId.replace('meta-', ''), accessToken);
            results.push({ action: 'delete', resource: action.resourceName, success: true, message: 'Campaign deleted from Meta.' });
            break;
          }
          default:
            results.push({ action: action.action, resource: action.resourceName, success: false, message: `Unknown action: ${action.action}` });
        }
      } catch (error) {
        results.push({ action: action.action, resource: action.resourceName, success: false, message: error instanceof Error ? error.message : 'Meta API error' });
      }
    }

    return NextResponse.json({ results, appliedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: { code: 'META_API_ERROR', message: error instanceof Error ? error.message : 'Apply failed' } }, { status: 502 });
  }
}
