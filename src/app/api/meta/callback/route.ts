import { NextRequest, NextResponse } from 'next/server';
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const savedState = request.cookies.get('meta_oauth_state')?.value;

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=meta_oauth_no_code', request.url));
  }

  if (state && savedState && state !== savedState) {
    return NextResponse.redirect(new URL('/settings?error=meta_oauth_state_mismatch', request.url));
  }

  try {
    const adapter = new MetaOAuthAdapter();
    const result = await adapter.exchangeCode(code);

    const response = NextResponse.redirect(new URL('/settings?meta_connected=true', request.url));
    response.cookies.set('meta_access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 60,
    });
    if (result.adAccountId) {
      response.cookies.set('meta_ad_account_id', result.adAccountId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 60,
      });
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(new URL(`/settings?error=meta_oauth_failed&message=${encodeURIComponent(message)}`, request.url));
  }
}
