import { CampaignConfig, ConfigDiff, ExecutionPlan, PlatformAction, DriftReport, CampaignVersion } from './types';

function classifyAction(diff: ConfigDiff): { action: PlatformAction['action']; resource: PlatformAction['resource']; resourceName: string } | null {
  const path = diff.path;

  if (path === '(root)' || path === 'name') return null;

  if (path.startsWith('adSets[')) {
    const match = path.match(/adSets\[(\d+)\]\.(.+)/);
    if (match) {
      const afterRecord = diff.after && typeof diff.after === 'object'
        ? (diff.after as Record<string, unknown>)
        : null;
      const resourceName: string = afterRecord
        ? (typeof afterRecord.name === 'string' ? afterRecord.name : `Ad Set ${match[1]}`)
        : `Ad Set ${match[1]}`;

      if (diff.changeType === 'added') return { action: 'create', resource: 'ad_set', resourceName };
      if (diff.changeType === 'removed') return { action: 'delete', resource: 'ad_set', resourceName };

      const subPath = match[2];
      if (subPath.startsWith('creatives[')) {
        return { action: 'update', resource: 'creative', resourceName: `${resourceName} creative` };
      }
      return { action: 'update', resource: 'ad_set', resourceName };
    }
  }

  if (['name', 'objective', 'totalBudget', 'startDate', 'endDate'].some(k => path === k || path.endsWith(`.${k}`))) {
    return { action: 'update', resource: 'campaign', resourceName: path };
  }

  return null;
}

function mapChangeToDetail(diff: ConfigDiff): string {
  switch (diff.changeType) {
    case 'added':
      return `Add ${diff.path}`;
    case 'removed':
      return `Remove ${diff.path}`;
    case 'modified':
      return `Change ${diff.path}: ${JSON.stringify(diff.before)} → ${JSON.stringify(diff.after)}`;
  }
}

export function generateExecutionPlan(
  campaignId: string,
  campaignName: string,
  diffs: ConfigDiff[],
  platforms: string[]
): ExecutionPlan {
  const platformActions: PlatformAction[] = [];

  for (const diff of diffs) {
    const classified = classifyAction(diff);
    if (!classified) continue;

    for (const plat of platforms) {
      platformActions.push({
        platform: plat as PlatformAction['platform'],
        ...classified,
        details: mapChangeToDetail(diff),
      });
    }
  }

  const summary = {
    additions: diffs.filter(d => d.changeType === 'added').length,
    modifications: diffs.filter(d => d.changeType === 'modified').length,
    removals: diffs.filter(d => d.changeType === 'removed').length,
  };

  return {
    campaignId,
    campaignName,
    generatedAt: new Date().toISOString(),
    changes: diffs,
    platformActions,
    summary,
  };
}

export function detectDrift(
  campaignId: string,
  campaignName: string,
  internalConfig: CampaignConfig,
  platformState: Partial<CampaignConfig>
): DriftReport {
  const drifts: ConfigDiff[] = [];
  const keys = ['name', 'totalBudget', 'startDate', 'endDate', 'objective'] as const;

  for (const key of keys) {
    const internal = internalConfig[key];
    const external = platformState[key];
    if (external !== undefined && JSON.stringify(internal) !== JSON.stringify(external)) {
      drifts.push({
        path: key,
        changeType: 'modified',
        before: internal,
        after: external,
      });
    }
  }

  return {
    campaignId,
    campaignName,
    checkedAt: new Date().toISOString(),
    hasDrift: drifts.length > 0,
    drifts,
    platformState,
    internalState: internalConfig,
  };
}

export function summarizeVersionHistory(versions: CampaignVersion[]): string {
  if (versions.length === 0) return 'No versions yet';

  return versions
    .map(v => `v${v.version} — ${v.commitMessage} (${new Date(v.timestamp).toLocaleDateString()})`)
    .join('\n');
}
