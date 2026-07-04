export interface MetaAccountDTO {
  id: string;
  name: string;
  accountId: string;
  currency: string;
  timezone: string;
  status: 'connected' | 'disconnected' | 'error';
}

export interface MetaCampaignSummaryDTO {
  id: string;
  name: string;
  objective: string;
  status: string;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  startTime?: string;
  stopTime?: string;
}

export interface MetaInsightSummaryDTO {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  costPerConversion: number;
  roas: number;
  conversionValue: number;
}

export interface MetaCreativeSummaryDTO {
  id: string;
  title: string;
  body: string;
  objectUrl?: string;
  imageUrl?: string;
  status: string;
}

export interface MetaClientPort {
  getAccounts(accessToken: string): Promise<MetaAccountDTO[]>;
  getCampaigns(accountId: string, accessToken: string): Promise<MetaCampaignSummaryDTO[]>;
  getInsights(accountId: string, campaignIds: string[], since: string, until: string, accessToken: string): Promise<MetaInsightSummaryDTO[]>;
  getAdCreatives(adId: string, accessToken: string): Promise<MetaCreativeSummaryDTO[]>;
}
