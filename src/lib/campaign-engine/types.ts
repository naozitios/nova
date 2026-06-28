export type Platform = 'meta' | 'google';
export type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft' | 'failed';
export type CampaignObjective = 'CONVERSIONS' | 'BRAND_AWARENESS' | 'TRAFFIC' | 'RETENTION';
export type MediaType = 'image' | 'video';

export interface TargetingConfig {
  countries: string[];
  ageRange: [number, number];
  languages: string[];
}

export interface CreativeConfig {
  headline: string;
  bodyText: string;
  destinationUrl: string;
  mediaUrl: string;
  mediaType: MediaType;
}

export interface AdSetConfig {
  name: string;
  targeting: TargetingConfig;
  bidAmount: number;
  creatives: CreativeConfig[];
}

export interface CampaignConfig {
  name: string;
  platform: Platform[];
  objective: CampaignObjective;
  totalBudget: number;
  startDate: string;
  endDate: string;
  adSets: AdSetConfig[];
}

export type ChangeType = 'added' | 'removed' | 'modified';

export interface ConfigDiff {
  path: string;
  changeType: ChangeType;
  before: unknown;
  after: unknown;
}

export interface CampaignVersion {
  version: number;
  config: CampaignConfig;
  diffs: ConfigDiff[];
  timestamp: string;
  authoredBy: string;
  commitMessage: string;
}

export interface ExecutionPlan {
  campaignId: string;
  campaignName: string;
  generatedAt: string;
  changes: ConfigDiff[];
  platformActions: PlatformAction[];
  summary: {
    additions: number;
    modifications: number;
    removals: number;
  };
}

export interface PlatformAction {
  platform: Platform;
  action: 'create' | 'update' | 'pause' | 'resume' | 'delete';
  resource: 'campaign' | 'ad_set' | 'creative';
  resourceName: string;
  details: string;
}

export interface DriftReport {
  campaignId: string;
  campaignName: string;
  checkedAt: string;
  hasDrift: boolean;
  drifts: ConfigDiff[];
  platformState: Partial<CampaignConfig>;
  internalState: Partial<CampaignConfig>;
}
