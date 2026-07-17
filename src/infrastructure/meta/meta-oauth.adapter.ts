import { config } from '@/infrastructure/config';

export class MetaOAuthAdapter {
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: config.meta.appId,
      redirect_uri: config.meta.redirectUri,
      state,
      scope: config.meta.scopes.join(','),
      response_type: 'code',
    });
    return `https://www.facebook.com/${config.meta.apiVersion}/dialog/oauth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; expiresIn?: number; tokenType?: string }> {
    const params = new URLSearchParams({
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: config.meta.redirectUri,
      code,
    });

    const response = await fetch(`https://graph.facebook.com/${config.meta.apiVersion}/oauth/access_token?${params.toString()}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Meta OAuth error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  async refreshToken(token: string): Promise<string> {
    const response = await fetch(
      `https://graph.facebook.com/${config.meta.apiVersion}/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.meta.appId}&client_secret=${config.meta.appSecret}&fb_exchange_token=${token}`
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error?.message || response.statusText}`);
    }
    const data = await response.json();
    return data.access_token;
  }
}
