import { CampaignConfig, CampaignVersion, ExecutionPlan, DriftReport } from './types';
import { generateConfig, CampaignFormInput } from './generator';
import { validateConfig } from './validator';
import { createVersion, computeDiff } from './versioning';
import { generateExecutionPlan, detectDrift } from './planner';

interface CampaignEntry {
  id: string;
  config: CampaignConfig;
  versions: CampaignVersion[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

const store = new Map<string, CampaignEntry>();

function generateId(): string {
  return `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export const campaignStore = {
  create(input: CampaignFormInput, authoredBy = 'system'): { id: string; config: CampaignConfig; errors: string[] } {
    const config = generateConfig(input);
    const errors = validateConfig(config).map(e => e.message);

    const id = generateId();
    const version = createVersion(config, null, 1, authoredBy, 'Campaign created');

    store.set(id, {
      id,
      config,
      versions: [version],
      currentVersion: 1,
      createdAt: version.timestamp,
      updatedAt: version.timestamp,
    });

    return { id, config, errors };
  },

  get(id: string): CampaignEntry | undefined {
    return store.get(id);
  },

  list(): CampaignEntry[] {
    return Array.from(store.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  },

  update(
    id: string,
    input: Partial<CampaignFormInput>,
    authoredBy = 'system',
    commitMessage = 'Campaign updated'
  ): { config: CampaignConfig | null; errors: string[]; plan: ExecutionPlan | null } {
    const entry = store.get(id);
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

    store.set(id, {
      ...entry,
      config: updatedConfig,
      versions: [...entry.versions, version],
      currentVersion: newVersion,
      updatedAt: version.timestamp,
    });

    return { config: updatedConfig, errors: [], plan };
  },

  getVersion(id: string, versionNumber: number): CampaignVersion | undefined {
    const entry = store.get(id);
    return entry?.versions.find(v => v.version === versionNumber);
  },

  getVersionHistory(id: string): CampaignVersion[] {
    return store.get(id)?.versions ?? [];
  },

  rollback(id: string, versionNumber: number, authoredBy = 'system'): { config: CampaignConfig | null; errors: string[] } {
    const entry = store.get(id);
    if (!entry) return { config: null, errors: ['Campaign not found'] };

    const targetVersion = entry.versions.find(v => v.version === versionNumber);
    if (!targetVersion) return { config: null, errors: [`Version ${versionNumber} not found`] };

    if (versionNumber === entry.currentVersion) {
      return { config: entry.config, errors: [] };
    }

    const newVersion = entry.currentVersion + 1;
    const version = createVersion(targetVersion.config, entry.config, newVersion, authoredBy, `Rolled back to v${versionNumber}`);

    store.set(id, {
      ...entry,
      config: targetVersion.config,
      versions: [...entry.versions, version],
      currentVersion: newVersion,
      updatedAt: version.timestamp,
    });

    return { config: targetVersion.config, errors: [] };
  },

  checkDrift(id: string, platformState: Partial<CampaignConfig>): DriftReport | null {
    const entry = store.get(id);
    if (!entry) return null;
    return detectDrift(id, entry.config.name, entry.config, platformState);
  },

  getExecutionPlan(id: string): ExecutionPlan | null {
    const entry = store.get(id);
    if (!entry) return null;

    if (entry.versions.length < 2) {
      return generateExecutionPlan(id, entry.config.name, [], entry.config.platform);
    }

    const current = entry.versions[entry.versions.length - 1];
    return generateExecutionPlan(id, entry.config.name, current.diffs, entry.config.platform);
  },

  delete(id: string): boolean {
    return store.delete(id);
  },
};
