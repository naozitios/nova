import { CampaignConfig, ConfigDiff, CampaignVersion } from '@/core/campaign/types';
import { CampaignRepositoryPort, CampaignEntry } from '@/core/campaign/repository.port';

const store = new Map<string, CampaignEntry>();

export class InMemoryCampaignRepository implements CampaignRepositoryPort {
  save(config: CampaignConfig, version: CampaignVersion): CampaignEntry {
    const id = `cmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry: CampaignEntry = {
      id,
      config,
      versions: [version],
      currentVersion: 1,
      createdAt: version.timestamp,
      updatedAt: version.timestamp,
    };
    store.set(id, entry);
    return entry;
  }

  get(id: string): CampaignEntry | undefined {
    return store.get(id);
  }

  list(): CampaignEntry[] {
    return Array.from(store.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  update(id: string, config: CampaignConfig, diffs: ConfigDiff[], version: CampaignVersion): CampaignEntry | null {
    const entry = store.get(id);
    if (!entry) return null;

    const updated: CampaignEntry = {
      ...entry,
      config,
      versions: [...entry.versions, version],
      currentVersion: version.version,
      updatedAt: version.timestamp,
    };
    store.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return store.delete(id);
  }

  clear(): void {
    store.clear();
  }

  count(): number {
    return store.size;
  }
}
