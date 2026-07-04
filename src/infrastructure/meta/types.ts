export interface MetaAccount {
  id: string;
  name: string;
  accountId: string;
  currency: string;
  timezone: string;
  status: 'active' | 'disabled' | 'unsettled';
}

export interface MetaCampaignDTO {
  id: string;
  name: string;
  objective: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
  buyingType: string;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  startTime: string;
  stopTime: string | null;
  createdTime: string;
  updatedTime: string;
  bidStrategy: string | null;
}

export interface MetaInsightDTO {
  campaignId: string;
  campaignName: string;
  dateStart: string;
  dateStop: string;
  impressions: string;
  clicks: string;
  spend: string;
  reach: string;
  frequency: string;
  cpm: string;
  cpc: string;
  ctr: string;
  conversions: string;
  costPerConversion: string;
  conversionRate: string;
  roas: string;
  purchaseConversionValue: string;
}

export interface MetaCreativeDTO {
  id: string;
  name: string;
  title: string;
  body: string;
  objectUrl: string;
  imageUrl: string;
  status: 'ACTIVE' | 'PAUSED' | 'DELETED';
}

export interface MetaCampaignInput {
  name: string;
  objective: string;
  status: 'ACTIVE' | 'PAUSED';
  dailyBudget?: number;
  lifetimeBudget?: number;
  startTime: string;
  stopTime?: string;
  bidStrategy?: string;
}

export interface MetaAuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  adAccountId?: string;
}

export interface MetaErrorResponse {
  error: {
    message: string;
    type: string;
    code: number;
    errorSubcode?: number;
    fbtraceId?: string;
  };
}
