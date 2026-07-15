import { NextResponse } from 'next/server';
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter';
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client';

export async function GET() {
  const crypto = await import('crypto');
  const nonce = crypto.randomBytes(32).toString('hex');
  const nonceHash = crypto.createHash('sha256').update(nonce).digest('hex');
  const state = crypto.randomBytes(16).toString('hex');

  const client = getSupabaseServiceClient();
  const { error: insertErr } = await client
    .from('meta_oauth_states')
    .insert({
      workspace_id: '00000000-0000-0000-0000-000000000000',
      created_by: '00000000-0000-0000-0000-000000000000',
      state_nonce_hash: nonceHash,
      return_path: '/settings',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

  if (insertErr) {
    return NextResponse.json({ error: 'Failed to create OAuth state' }, { status: 500 });
  }

  const adapter = new MetaOAuthAdapter();
  const url = adapter.getAuthorizationUrl(`${state}:${nonce}`);

  const response = NextResponse.json({ url });
  response.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
  });

  return response;
}
