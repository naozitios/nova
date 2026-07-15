import { NextRequest, NextResponse } from 'next/server';
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter';
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');

  if (!code) {
    return NextResponse.redirect(new URL('/settings?error=meta_oauth_no_code', request.url));
  }

  if (!stateParam) {
    return NextResponse.redirect(new URL('/settings?error=meta_oauth_no_state', request.url));
  }

  const crypto = await import('crypto');
  const client = getSupabaseServiceClient();

  // Verify signed state nonce — split state:param format
  const stateNonceParts = stateParam.split(':');
  const state = stateNonceParts[0] ?? stateParam;
  const nonce = stateNonceParts[1];

  if (!nonce) {
    return NextResponse.redirect(new URL('/settings?error=meta_oauth_invalid_state', request.url));
  }

  const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');

  const { data: oauthState, error: stateErr } = await client
    .from('meta_oauth_states')
    .select('*')
    .eq('state_nonce_hash', nonceHash)
    .is('consumed_at', null)
    .single();

  if (stateErr || !oauthState) {
    return NextResponse.redirect(new URL('/settings?error=OAUTH_CALLBACK_REPLAYED', request.url));
  }

  const codeHash = crypto.createHash('sha256').update(code).digest('hex');

  const { error: consumeErr } = await client
    .from('meta_oauth_states')
    .update({
      consumed_at: new Date().toISOString(),
      provider_code_hash: codeHash,
    })
    .eq('id', oauthState.id)
    .is('consumed_at', null);

  if (consumeErr) {
    return NextResponse.redirect(new URL('/settings?error=OAUTH_CALLBACK_REPLAYED', request.url));
  }

  await client
    .from('meta_provider_code_hashes')
    .insert({
      oauth_state_id: oauthState.id,
      provider_code_hash: codeHash,
    });

  const { data: existingCode } = await client
    .from('meta_provider_code_hashes')
    .select('id')
    .eq('provider_code_hash', codeHash)
    .neq('oauth_state_id', oauthState.id)
    .limit(1);

  if (existingCode && existingCode.length > 0) {
    return NextResponse.redirect(new URL('/settings?error=CODE_REPLAYED', request.url));
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
