import type { MetaClientPort, MetaAccountDTO, MetaCampaignSummaryDTO, MetaInsightSummaryDTO, MetaCreativeSummaryDTO } from '@/core/optimization/meta-client.port';
import type { MetaCampaignDTO, MetaCampaignInput } from '@/infrastructure/meta/types';
import { config } from '@/infrastructure/config';

/** Meta Graph API adapter — implements MetaClientPort for fetching accounts, campaigns, insights, and creatives from Meta. */
/** Adapter that implements MetaClientPort by calling the Meta (Facebook) Graph API. */
export class MetaApiAdapter implements MetaClientPort {
  private baseUrl = `https://graph.facebook.com/${config.meta.apiVersion}`;

  /** Generic fetch helper that appends the access token and handles errors. */
  private async fetch<T>(path: string, accessToken: string, options?: RequestInit): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}/${path}`;
    const separator = url.includes('?') ? '&' : '?';
    const finalUrl = `${url}${separator}access_token=${accessToken}`;

    const response = await fetch(finalUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`Meta API error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  /** Lists ad accounts accessible by the given access token with full field set. */
  async listAccessibleAdAccounts(accessToken: string) {
    const data = await this.fetch<{
      data: Array<{
        id: string;
        account_id: string;
        name: string;
        currency?: string;
        timezone_name?: string;
        business?: { id: string; name: string } | null;
        account_status: number;
      }>;
    }>(
      'me/adaccounts?fields=id,account_id,name,currency,timezone_name,business{id,name},account_status',
      accessToken
    );
    return data.data.map(a => ({
      id: a.id,
      accountId: a.account_id,
      name: a.name,
      currency: a.currency ?? null,
      timezoneName: a.timezone_name ?? null,
      businessId: a.business?.id ?? null,
      businessName: a.business?.name ?? null,
      rawMetadata: a,
    }));
  }

  /** Fetches all ad accounts accessible by the given access token. */
  async getAccounts(accessToken: string): Promise<MetaAccountDTO[]> {
    const data = await this.fetch<{ data: Array<{ id: string; name: string; account_id: string; currency: string; timezone_name: string; account_status: number }> }>(
      'me/adaccounts?fields=id,name,account_id,currency,timezone_name,account_status',
      accessToken
    );
    return data.data.map(a => ({
      id: a.id,
      name: a.name,
      accountId: a.account_id,
      currency: a.currency,
      timezone: a.timezone_name,
      status: a.account_status === 1 ? 'connected' as const : a.account_status === 2 ? 'disconnected' as const : 'error' as const,
    }));
  }

  /** Fetches all campaigns for a given ad account. */
  async getCampaigns(accountId: string, accessToken: string): Promise<MetaCampaignSummaryDTO[]> {
    const data = await this.fetch<{ data: Record<string, string>[] }>(
      `${accountId}/campaigns?fields=id,name,objective,status,buying_type,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time,bid_strategy&limit=100`,
      accessToken
    );
    return data.data.map(c => ({
      id: c.id || '',
      name: c.name || '',
      objective: c.objective || '',
      status: c.status || '',
      dailyBudget: c.daily_budget || null,
      lifetimeBudget: c.lifetime_budget || null,
    }));
  }

  /** Fetches performance insights for specified campaigns within a date range, chunked to avoid API limits. */
  async getInsights(accountId: string, campaignIds: string[], since: string, until: string, accessToken: string): Promise<MetaInsightSummaryDTO[]> {
    const allRaw: Record<string, string>[] = [];
    const chunkSize = 10;

    for (let i = 0; i < campaignIds.length; i += chunkSize) {
      const chunk = campaignIds.slice(i, i + chunkSize);
      const filter = chunk.map(id => `campaign_ids:['${id}']`).join(',');
      const data = await this.fetch<{ data: Record<string, string>[] }>(
        `${accountId}/insights?fields=campaign_id,campaign_name,date_start,date_stop,impressions,clicks,spend,reach,frequency,cpm,cpc,ctr,conversions,cost_per_conversion,conversion_rate,roas,purchase_conversion_value&filtering=[${filter}]&time_range={'since':'${since}','until':'${until}'}&level=campaign&limit=100`,
        accessToken
      );
      allRaw.push(...data.data);
    }

    return allRaw.map(i => ({
      campaignId: i.campaign_id || '',
      campaignName: i.campaign_name || '',
      impressions: parseInt(i.impressions) || 0,
      clicks: parseInt(i.clicks) || 0,
      spend: parseFloat(i.spend) || 0,
      reach: parseInt(i.reach) || 0,
      frequency: parseFloat(i.frequency) || 0,
      ctr: parseFloat(i.ctr) || 0,
      cpc: parseFloat(i.cpc) || 0,
      cpm: parseFloat(i.cpm) || 0,
      conversions: parseInt(i.conversions) || 0,
      costPerConversion: parseFloat(i.cost_per_conversion) || 0,
      roas: parseFloat(i.roas) || 0,
      conversionValue: parseFloat(i.purchase_conversion_value) || 0,
    }));
  }

  /** Fetches creatives associated with a given ad ID. */
  async getAdCreatives(adId: string, accessToken: string): Promise<MetaCreativeSummaryDTO[]> {
    const data = await this.fetch<{ data: Record<string, string>[] }>(
      `${adId}/creatives?fields=id,name,title,body,object_url,image_url,status`,
      accessToken
    );
    return data.data.map(c => ({
      id: c.id || '',
      title: c.title || c.name || '',
      body: c.body || '',
      status: (c.status || 'ACTIVE') as MetaCreativeSummaryDTO['status'],
    }));
  }

  /** Creates a new campaign on Meta under the given ad account. */
  async createCampaign(accountId: string, input: MetaCampaignInput, accessToken: string): Promise<MetaCampaignDTO> {
    const body = {
      name: input.name,
      objective: input.objective,
      status: input.status,
      special_ad_categories: [],
      ...(input.lifetimeBudget ? { lifetime_budget: input.lifetimeBudget } : {}),
      ...(input.dailyBudget ? { daily_budget: input.dailyBudget } : {}),
      start_time: input.startTime,
      ...(input.stopTime ? { stop_time: input.stopTime } : {}),
    };

    const result = await this.fetch<MetaCampaignDTO>(
      `${accountId}/campaigns`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
    return result;
  }

  /** Updates specific fields of an existing Meta campaign. */
  async updateCampaign(campaignId: string, input: Partial<MetaCampaignInput>, accessToken: string): Promise<MetaCampaignDTO> {
    const body: Record<string, unknown> = {};
    if (input.name) body.name = input.name;
    if (input.status) body.status = input.status;
    if (input.lifetimeBudget) body.lifetime_budget = input.lifetimeBudget;
    if (input.dailyBudget) body.daily_budget = input.dailyBudget;
    if (input.stopTime) body.stop_time = input.stopTime;

    const result = await this.fetch<MetaCampaignDTO>(
      campaignId,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
    return result;
  }

  /** Pauses a Meta campaign by setting its status to PAUSED. */
  async pauseCampaign(campaignId: string, accessToken: string): Promise<void> {
    await this.fetch<{ success: boolean }>(
      campaignId,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({ status: 'PAUSED' }),
      }
    );
  }

  /** Deletes a Meta campaign. */
  async deleteCampaign(campaignId: string, accessToken: string): Promise<void> {
    await this.fetch<{ success: boolean }>(
      campaignId,
      accessToken,
      { method: 'DELETE' }
    );
  }

  /** Fetches a paginated resource and returns data with optional next page cursor. */
  private async fetchPage<T>(path: string, accessToken: string, after?: string): Promise<{ data: T[]; nextPageUrl: string | null }> {
    const url = after ? `${path}&after=${after}` : path;
    const raw = await this.fetch<{ data: T[]; paging?: { next?: string } }>(url, accessToken);
    return { data: raw.data, nextPageUrl: raw.paging?.next ?? null };
  }

  /** Fetches a page of campaigns for a given ad account. */
  async getCampaignsPage(accountId: string, accessToken: string, after?: string): Promise<{ data: Record<string, string>[]; nextPageUrl: string | null }> {
    return this.fetchPage<Record<string, string>>(
      `${accountId}/campaigns?fields=id,name,objective,status,buying_type,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time,bid_strategy&limit=100`,
      accessToken,
      after,
    );
  }

  /** Fetches a page of ad sets for a given ad account. */
  async getAdSetsPage(accountId: string, accessToken: string, after?: string): Promise<{ data: Record<string, string>[]; nextPageUrl: string | null }> {
    return this.fetchPage<Record<string, string>>(
      `${accountId}/adsets?fields=id,name,status,campaign_id,targeting,daily_budget,lifetime_budget,bid_strategy&limit=100`,
      accessToken,
      after,
    );
  }

  /** Fetches a page of ads for a given ad account. */
  async getAdsPage(accountId: string, accessToken: string, after?: string): Promise<{ data: Record<string, string>[]; nextPageUrl: string | null }> {
    return this.fetchPage<Record<string, string>>(
      `${accountId}/ads?fields=id,name,status,adset_id,campaign_id,creative&limit=100`,
      accessToken,
      after,
    );
  }

  /** Fetches a page of creatives for a given ad account. */
  async getCreativesPage(accountId: string, accessToken: string, after?: string): Promise<{ data: Record<string, string>[]; nextPageUrl: string | null }> {
    return this.fetchPage<Record<string, string>>(
      `${accountId}/adcreatives?fields=id,name,title,body,image_hash,image_url,video_id,link_url,call_to_action_type,object_type&limit=100`,
      accessToken,
      after,
    );
  }

  /** Fetches a paginated page of daily ad-level insights for a given account and date window. */
  async getDailyAdInsightsPage(
    accountId: string,
    window: { since: string; until: string },
    accessToken: string,
    after?: string,
  ): Promise<{ data: Record<string, string>[]; nextPageUrl: string | null }> {
    const fields = 'date_start,date_stop,campaign_id,adset_id,ad_id,spend,impressions,reach,clicks,actions,action_values';
    const path = `${accountId}/insights?fields=${fields}&level=ad&time_range={'since':'${window.since}','until':'${window.until}'}`;
    return this.fetchPage<Record<string, string>>(path, accessToken, after);
  }
}
