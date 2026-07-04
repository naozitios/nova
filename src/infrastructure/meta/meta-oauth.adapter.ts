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
    return `https://www.facebook.com/v22.0/dialog/oauth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<{ accessToken: string; adAccountId?: string }> {
    const params = new URLSearchParams({
      client_id: config.meta.appId,
      client_secret: config.meta.appSecret,
      redirect_uri: config.meta.redirectUri,
      code,
    });

    const response = await fetch(`https://graph.facebook.com/v22.0/oauth/access_token?${params.toString()}`);
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Meta OAuth error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const adAccountId = await this.getDefaultAdAccount(data.access_token);

    return { accessToken: data.access_token, adAccountId };
  }

  private async getDefaultAdAccount(accessToken: string): Promise<string | undefined> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/v22.0/me/adaccounts?fields=id,account_id&limit=1&access_token=${accessToken}`
      );
      if (!response.ok) return undefined;
      const data = await response.json();
      return data.data?.[0]?.id;
    } catch {
      return undefined;
    }
  }

  async refreshToken(token: string): Promise<string> {
    const response = await fetch(
      `https://graph.facebook.com/v22.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${config.meta.appId}&client_secret=${config.meta.appSecret}&fb_exchange_token=${token}`
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token refresh failed: ${error.error?.message || response.statusText}`);
    }
    const data = await response.json();
    return data.access_token;
  }
}
