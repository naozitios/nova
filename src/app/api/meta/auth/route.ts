import { NextResponse } from 'next/server';
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter';

export async function GET() {
  const crypto = await import('crypto');
  const state = crypto.randomBytes(16).toString('hex');
  const adapter = new MetaOAuthAdapter();
  const url = adapter.getAuthorizationUrl(state);

  const response = NextResponse.json({ url });
  response.cookies.set('meta_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10,
  });

  return response;
}
