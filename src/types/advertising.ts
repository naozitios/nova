export type Platform = 'meta' | 'google';
export type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft' | 'failed';

export interface AdAccount {
  id: string;
  platform: Platform;
  name: string;
  accountId: string;
  status: 'connected' | 'disconnected' | 'error';
  currency: string;
  timezone: string;
}

export interface Campaign {
  id: string;
  name: string;
  platform: Platform;
  status: CampaignStatus;
  objective: string;
  totalBudget: number;
  startDate: string;
  endDate: string;
  adGroups: AdGroup[];
  createdAt: string;
  updatedAt: string;
}

export interface AdGroup {
  id: string;
  name: string;
  platform: Platform;
  targeting: {
    countries: string[];
    ageRange: [number, number];
    languages: string[];
  };
  bidAmount: number;
  creatives: Creative[];
}

export interface Creative {
  id: string;
  name: string;
  platform: Platform;
  headline: string;
  bodyText: string;
  destinationUrl: string;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  status: 'approved' | 'pending' | 'rejected';
  rejectionReason?: string;
}

export interface MediaAsset {
  id: string;
  name: string;
  fileUrl: string;
  fileType: 'image' | 'video';
  fileSize: number;
  dimensions: { width: number; height: number };
  uploadedAt: string;
  validationStatus: 'valid' | 'invalid' | 'pending';
  validationMessage?: string;
}

export interface AnalyticsSnapshot {
  date: string;
  platform: Platform;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  revenue: number;
}

export interface AggregatedMetrics {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalRevenue: number;
  blendedCTR: number;
  blendedROAS: number;
  platformBreakdown: {
    meta: { spend: number; impressions: number; clicks: number; revenue: number };
    google: { spend: number; impressions: number; clicks: number; revenue: number };
  };
}

export interface BudgetRule {
  id: string;
  name: string;
  enabled: boolean;
  minBudget: number;
  maxBudget: number;
  platformA: Platform;
  platformB: Platform;
  roasThreshold: number;
  shiftPercentage: number;
  lastExecuted?: string;
}
