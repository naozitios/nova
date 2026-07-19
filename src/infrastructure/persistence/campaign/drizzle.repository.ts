import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { campaigns, campaignVersions } from './schema';
import type { CampaignRepositoryPort, CampaignEntry } from '@/core/campaign/repository.port';
import type { CampaignConfig, ConfigDiff, CampaignVersion } from '@/core/campaign/types';
import { config } from '@/infrastructure/config';
import { eq } from 'drizzle-orm';

export class DrizzleCampaignRepository implements CampaignRepositoryPort {
  private db: ReturnType<typeof drizzle>;

  constructor() {
    const client = createClient({ url: config.database.url });
    this.db = drizzle(client);
  }

  async save(campaignConfig: CampaignConfig, version: CampaignVersion): Promise<CampaignEntry> {
    const id = `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    await this.db.insert(campaigns).values({
      id,
      name: campaignConfig.name,
      config: campaignConfig as unknown as string,
      platform: campaignConfig.platform as unknown as string,
      objective: campaignConfig.objective,
      totalBudget: campaignConfig.totalBudget,
      startDate: campaignConfig.startDate,
      endDate: campaignConfig.endDate,
      currentVersion: 1,
      createdAt: version.timestamp,
      updatedAt: version.timestamp,
    });

    await this.db.insert(campaignVersions).values({
      id: `v-${id}-1`,
      campaignId: id,
      version: 1,
      config: campaignConfig as unknown as string,
      diffs: version.diffs as unknown as string,
      timestamp: version.timestamp,
      authoredBy: version.authoredBy,
      commitMessage: version.commitMessage,
    });

    return {
      id,
      config: campaignConfig,
      versions: [version],
      currentVersion: 1,
      createdAt: version.timestamp,
      updatedAt: version.timestamp,
    };
  }

  async get(id: string): Promise<CampaignEntry | undefined> {
    const rows = await this.db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (rows.length === 0) return undefined;

    const row = rows[0];
    const versions = await this.db.select().from(campaignVersions).where(eq(campaignVersions.campaignId, id)).orderBy(campaignVersions.version);

    return {
      id: row.id,
      config: row.config as unknown as CampaignConfig,
      versions: versions.map(v => ({
        version: v.version,
        config: v.config as unknown as CampaignConfig,
        diffs: (v.diffs as unknown as ConfigDiff[]) || [],
        timestamp: v.timestamp,
        authoredBy: v.authoredBy,
        commitMessage: v.commitMessage,
      })),
      currentVersion: row.currentVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async list(): Promise<CampaignEntry[]> {
    const rows = await this.db.select().from(campaigns).orderBy(campaigns.updatedAt);
    const entries: CampaignEntry[] = [];

    for (const row of rows) {
      const versions = await this.db.select().from(campaignVersions).where(eq(campaignVersions.campaignId, row.id)).orderBy(campaignVersions.version);
      entries.push({
        id: row.id,
        config: row.config as unknown as CampaignConfig,
        versions: versions.map(v => ({
          version: v.version,
          config: v.config as unknown as CampaignConfig,
          diffs: (v.diffs as unknown as ConfigDiff[]) || [],
          timestamp: v.timestamp,
          authoredBy: v.authoredBy,
          commitMessage: v.commitMessage,
        })),
        currentVersion: row.currentVersion,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
    }

    return entries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async update(id: string, campaignConfig: CampaignConfig, diffs: ConfigDiff[], version: CampaignVersion): Promise<CampaignEntry | null> {
    const existing = await this.get(id);
    if (!existing) return null;

    await this.db.update(campaigns).set({
      name: campaignConfig.name,
      config: campaignConfig as unknown as string,
      platform: campaignConfig.platform as unknown as string,
      objective: campaignConfig.objective,
      totalBudget: campaignConfig.totalBudget,
      startDate: campaignConfig.startDate,
      endDate: campaignConfig.endDate,
      currentVersion: version.version,
      updatedAt: version.timestamp,
    }).where(eq(campaigns.id, id));

    await this.db.insert(campaignVersions).values({
      id: `v-${id}-${version.version}`,
      campaignId: id,
      version: version.version,
      config: campaignConfig as unknown as string,
      diffs: diffs as unknown as string,
      timestamp: version.timestamp,
      authoredBy: version.authoredBy,
      commitMessage: version.commitMessage,
    });

    return {
      id,
      config: campaignConfig,
      versions: [...existing.versions, version],
      currentVersion: version.version,
      createdAt: existing.createdAt,
      updatedAt: version.timestamp,
    };
  }

  async delete(id: string): Promise<boolean> {
    await this.db.delete(campaignVersions).where(eq(campaignVersions.campaignId, id));
    const result = await this.db.delete(campaigns).where(eq(campaigns.id, id));
    return ((result as unknown as { changes?: number })?.changes ?? 0) > 0;
  }
}
