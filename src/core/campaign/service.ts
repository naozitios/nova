import { CampaignConfig, CampaignVersion, ExecutionPlan, DriftReport } from './types';
import { CampaignFormInput, generateConfig, configToFormInput } from './generator';
import { validateConfig } from './validator';
import { createVersion, computeDiff } from './versioning';
import { generateExecutionPlan, detectDrift } from './planner';
import { CampaignRepositoryPort, CampaignEntry } from './repository.port';

export class CampaignService {
  constructor(private repo: CampaignRepositoryPort) {}

  async create(input: CampaignFormInput, authoredBy = 'system'): Promise<{ id: string; config: CampaignConfig; errors: string[] }> {
    const config = generateConfig(input);
    const errors = validateConfig(config).map(e => e.message);
    const version = createVersion(config, null, 1, authoredBy, 'Campaign created');
    const entry = await this.repo.save(config, version);
    return { id: entry.id, config, errors };
  }

  async get(id: string): Promise<CampaignEntry | undefined> {
    return this.repo.get(id);
  }

  async list(): Promise<CampaignEntry[]> {
    return this.repo.list();
  }

  async update(
    id: string,
    input: Partial<CampaignFormInput>,
    authoredBy = 'system',
    commitMessage = 'Campaign updated'
  ): Promise<{ config: CampaignConfig | null; errors: string[]; plan: ExecutionPlan | null }> {
    const entry = await this.repo.get(id);
    if (!entry) return { config: null, errors: ['Campaign not found'], plan: null };

    const updatedConfig = { ...entry.config };

    if (input.name !== undefined) updatedConfig.name = input.name;
    if (input.platform !== undefined) updatedConfig.platform = input.platform as CampaignConfig['platform'];
    if (input.objective !== undefined) updatedConfig.objective = input.objective as CampaignConfig['objective'];
    if (input.totalBudget !== undefined) updatedConfig.totalBudget = parseInt(input.totalBudget) || 0;
    if (input.startDate !== undefined) updatedConfig.startDate = input.startDate;
    if (input.endDate !== undefined) updatedConfig.endDate = input.endDate;

    if (input.countries !== undefined || input.ageMin !== undefined || input.ageMax !== undefined || input.languages !== undefined) {
      const adSet = updatedConfig.adSets[0] || {
        name: `${updatedConfig.name} - Ad Set`,
        targeting: { countries: [], ageRange: [18, 65], languages: [] },
        bidAmount: Math.round((updatedConfig.totalBudget || 0) * 0.003),
        creatives: [],
      };

      if (input.countries !== undefined) {
        adSet.targeting.countries = input.countries.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
      }
      if (input.ageMin !== undefined) adSet.targeting.ageRange[0] = parseInt(input.ageMin) || 18;
      if (input.ageMax !== undefined) adSet.targeting.ageRange[1] = parseInt(input.ageMax) || 65;
      if (input.languages !== undefined) {
        adSet.targeting.languages = input.languages.split(',').map(l => l.trim().toLowerCase()).filter(Boolean);
      }

      updatedConfig.adSets = [adSet];
    }

    const errors = validateConfig(updatedConfig).map(e => e.message);
    if (errors.length > 0) {
      return { config: null, errors, plan: null };
    }

    const diffs = computeDiff(entry.config, updatedConfig);
    const plan = generateExecutionPlan(id, updatedConfig.name, diffs, updatedConfig.platform);
    const newVersion = entry.currentVersion + 1;
    const version = createVersion(updatedConfig, entry.config, newVersion, authoredBy, commitMessage);
    await this.repo.update(id, updatedConfig, diffs, version);

    return { config: updatedConfig, errors: [], plan };
  }

  async getVersionHistory(id: string): Promise<CampaignVersion[]> {
    const entry = await this.repo.get(id);
    return entry?.versions ?? [];
  }

  async getVersion(id: string, versionNumber: number): Promise<CampaignVersion | undefined> {
    const entry = await this.repo.get(id);
    return entry?.versions.find(v => v.version === versionNumber);
  }

  async rollback(id: string, versionNumber: number, authoredBy = 'system'): Promise<{ config: CampaignConfig | null; errors: string[] }> {
    const entry = await this.repo.get(id);
    if (!entry) return { config: null, errors: ['Campaign not found'] };

    const targetVersion = entry.versions.find(v => v.version === versionNumber);
    if (!targetVersion) return { config: null, errors: [`Version ${versionNumber} not found`] };

    if (versionNumber === entry.currentVersion) {
      return { config: entry.config, errors: [] };
    }

    const newVersion = entry.currentVersion + 1;
    const version = createVersion(targetVersion.config, entry.config, newVersion, authoredBy, `Rolled back to v${versionNumber}`);
    await this.repo.update(id, targetVersion.config, version.diffs, version);

    return { config: targetVersion.config, errors: [] };
  }

  async checkDrift(id: string, platformState: Partial<CampaignConfig>): Promise<DriftReport | null> {
    const entry = await this.repo.get(id);
    if (!entry) return null;
    return detectDrift(id, entry.config.name, entry.config, platformState);
  }

  async getExecutionPlan(id: string): Promise<ExecutionPlan | null> {
    const entry = await this.repo.get(id);
    if (!entry) return null;

    if (entry.versions.length < 2) {
      return generateExecutionPlan(id, entry.config.name, [], entry.config.platform);
    }

    const current = entry.versions[entry.versions.length - 1];
    return generateExecutionPlan(id, entry.config.name, current.diffs, entry.config.platform);
  }

  async delete(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }

  configToFormInput(config: CampaignConfig): CampaignFormInput {
    return configToFormInput(config);
  }
}

// Re-export types used by frontend
export type { CampaignFormInput } from './generator';
export type { CampaignEntry } from './repository.port';
