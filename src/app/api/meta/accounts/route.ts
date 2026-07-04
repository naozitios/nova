import { NextRequest, NextResponse } from 'next/server';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('meta_access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({ error: { code: 'AUTH_ERROR', message: 'Meta not connected. Please connect your Meta account.' } }, { status: 401 });
  }

  try {
    const adapter = new MetaApiAdapter();
    const accounts = await adapter.getAccounts(accessToken);
    return NextResponse.json(accounts);
  } catch (error) {
    return NextResponse.json({ error: { code: 'META_API_ERROR', message: error instanceof Error ? error.message : 'Failed to fetch accounts' } }, { status: 502 });
  }
}
