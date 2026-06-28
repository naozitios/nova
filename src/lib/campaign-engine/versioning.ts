import { CampaignConfig, CampaignVersion, ConfigDiff, ChangeType } from './types';

function getKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      keys.push(...getKeys(obj[key] as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getValueAtPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}


function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) return false;
  }
  return true;
}

export function computeDiff(before: CampaignConfig, after: CampaignConfig): ConfigDiff[] {
  const diffs: ConfigDiff[] = [];
  const beforeRecord = before as unknown as Record<string, unknown>;
  const afterRecord = after as unknown as Record<string, unknown>;
  const allKeys = new Set([...getKeys(beforeRecord), ...getKeys(afterRecord)]);

  for (const key of allKeys) {
    const beforeVal = getValueAtPath(beforeRecord, key);
    const afterVal = getValueAtPath(afterRecord, key);

    if (beforeVal === undefined && afterVal !== undefined) {
      diffs.push({ path: key, changeType: 'added', before: null, after: afterVal });
    } else if (beforeVal !== undefined && afterVal === undefined) {
      diffs.push({ path: key, changeType: 'removed', before: beforeVal, after: null });
    } else if (Array.isArray(beforeVal) && Array.isArray(afterVal)) {
      if (!arraysEqual(beforeVal, afterVal)) {
        diffs.push({ path: key, changeType: 'modified', before: beforeVal, after: afterVal });
      }
    } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      diffs.push({ path: key, changeType: 'modified', before: beforeVal, after: afterVal });
    }
  }

  return diffs;
}

export function createVersion(
  config: CampaignConfig,
  previousConfig: CampaignConfig | null,
  version: number,
  authoredBy: string,
  commitMessage: string
): CampaignVersion {
  const diffs = previousConfig ? computeDiff(previousConfig, config) : [
    { path: '(root)', changeType: 'added' as ChangeType, before: null, after: config },
  ];

  return {
    version,
    config,
    diffs,
    timestamp: new Date().toISOString(),
    authoredBy,
    commitMessage,
  };
}
