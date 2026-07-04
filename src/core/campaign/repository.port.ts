import { CampaignConfig, CampaignVersion, ExecutionPlan, DriftReport, ConfigDiff } from './types';

export interface CampaignEntry {
  id: string;
  config: CampaignConfig;
  versions: CampaignVersion[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRepositoryPort {
  save(config: CampaignConfig, version: CampaignVersion): CampaignEntry | Promise<CampaignEntry>;
  get(id: string): CampaignEntry | undefined | Promise<CampaignEntry | undefined>;
  list(): CampaignEntry[] | Promise<CampaignEntry[]>;
  update(id: string, config: CampaignConfig, diffs: ConfigDiff[], version: CampaignVersion): CampaignEntry | null | Promise<CampaignEntry | null>;
  delete(id: string): boolean | Promise<boolean>;
}
