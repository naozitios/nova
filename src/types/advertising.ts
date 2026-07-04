/** Advertising domain types — accounts, campaigns, ad groups, creatives, media assets, analytics, and budget rules. */
/** Supported advertising platforms. */
export type Platform = 'meta' | 'google';
/** Possible lifecycle statuses for a campaign. */
export type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft' | 'failed';

/** An ad account connected to Nova from a platform (Meta, Google). */
export interface AdAccount {
  id: string;
  platform: Platform;
  name: string;
  accountId: string;
  status: 'connected' | 'disconnected' | 'error';
  currency: string;
  timezone: string;
}

/** An advertising campaign with its ad groups, budget, schedule, and platform details. */
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

/** A logical grouping of ads within a campaign, containing targeting and creatives. */
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

/** An individual ad creative with headline, body, media, and moderation status. */
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

/** A media file (image/video) uploaded for use in ad creatives. */
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

/** A daily analytics data point for a single campaign on a platform. */
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

/** Aggregated metrics across all campaigns with blended CTR/ROAS and per-platform breakdowns. */
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

/** A cross-platform budget rebalancing rule with ROAS threshold and shift percentage. */
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
