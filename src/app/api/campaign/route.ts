import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/di/container';
import { config } from '@/infrastructure/config';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';

export async function GET() {
  const accessToken = config.meta.appSecret;
  const accountId = config.meta.appId;

  if (accessToken && accountId) {
    try {
      const metaAdapter = new MetaApiAdapter();
      const campaigns = await metaAdapter.getCampaigns(accountId, accessToken);
      return NextResponse.json(campaigns);
    } catch {
      // Fall through to seeded campaigns
    }
  }

  const service = Container.getCampaignService();
  await Container.getCampaignSeed().ensure();
  const campaigns = await service.list();
  return NextResponse.json(campaigns);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const service = Container.getCampaignService();
    const result = await service.create(body, body.authoredBy || 'api');

    if (result.errors.length > 0) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: result.errors.join(', '), details: result.errors } }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } }, { status: 500 });
  }
}
