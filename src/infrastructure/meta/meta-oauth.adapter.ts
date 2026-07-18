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

  async exchangeCode(code: string): Promise<{ accessToken: string; expiresIn?: number; tokenType?: string; grantedScopes?: string[] }> {
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
      grantedScopes: data.granted_scopes ? data.granted_scopes.split(',').filter(Boolean) : undefined,
    };
  }

  async fetchMetaUser(accessToken: string): Promise<{ id: string; name?: string }> {
    const response = await fetch(
      `https://graph.facebook.com/${config.meta.apiVersion}/me?fields=id,name&access_token=${accessToken}`
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Meta user fetch error: ${error.error?.message || response.statusText}`);
    }
    const data = await response.json();
    return { id: data.id, name: data.name };
  }

  async fetchMetaPermissions(accessToken: string): Promise<Array<{ permission: string; status: string }>> {
    const response = await fetch(
      `https://graph.facebook.com/${config.meta.apiVersion}/me/permissions?access_token=${accessToken}`
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Meta permissions fetch error: ${error.error?.message || response.statusText}`);
    }
    const data = await response.json();
    return data.data ?? [];
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
