import type { RepositoryPort } from './repository.port'
import type { BusinessProfileVersion, JsonValue, ServiceResult } from './types'
import { ProfileVersionStatus } from './types'

// ─── Atomic approval ────────────────────────────────────────────────────────

export async function approveBusinessProfile(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  profile: Record<string, JsonValue>,
  approvedBy: string,
): Promise<ServiceResult<BusinessProfileVersion>> {
  const currentResult = await repo.getCurrentProfileVersion(workspaceId, businessId)
  if (!currentResult.ok) return currentResult

  if (currentResult.data) {
    const supersedeResult = await repo.supersedeProfileVersions(workspaceId, businessId)
    if (!supersedeResult.ok) return supersedeResult
  }

  const nextVersion = currentResult.data ? currentResult.data.version + 1 : 1

  const createResult = await repo.createProfileVersion({
    workspaceId,
    businessId,
    version: nextVersion,
    profile,
    profileMarkdown: null,
    status: 'current',
    changeSummary: 'Initial approved profile',
    createdBy: approvedBy,
    approvedBy,
    approvedAt: new Date(),
  })

  if (!createResult.ok) return createResult

  await repo.createAuditLog({
    workspaceId,
    businessId,
    actorId: approvedBy,
    actorType: 'user',
    eventType: 'profile.approved',
    entityType: 'business_profile_version',
    entityId: createResult.data.id,
    before: currentResult.data
      ? { version: currentResult.data.version, status: currentResult.data.status }
      : null,
    after: { version: createResult.data.version, status: 'current' },
  })

  return createResult
}

// ─── Next version number ────────────────────────────────────────────────────

/**
 * Calculate the next version number for a business.
 * Returns current version + 1, or 1 if no versions exist.
 */
export async function nextVersion(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<ServiceResult<number>> {
  const currentResult = await repo.getCurrentProfileVersion(workspaceId, businessId)
  if (!currentResult.ok) return currentResult

  return {
    ok: true,
    data: currentResult.data ? currentResult.data.version + 1 : 1,
  }
}

// ─── Field-level diffs ──────────────────────────────────────────────────────

export interface FieldDiff {
  before: JsonValue | null
  after: JsonValue | null
}

export type FieldDiffMap = Record<string, FieldDiff>

/**
 * Compute field-level diffs between two profile snapshots.
 * Returns a map of section keys that differ, with before/after values.
 */
export function computeFieldDiffs(
  current: Record<string, JsonValue>,
  draft: Record<string, JsonValue>,
): FieldDiffMap {
  const diff: FieldDiffMap = {}
  const allKeys = new Set([...Object.keys(current), ...Object.keys(draft)])

  for (const key of allKeys) {
    const cur = current[key]
    const dra = draft[key]
    if (JSON.stringify(cur) !== JSON.stringify(dra)) {
      diff[key] = { before: cur ?? null, after: dra ?? null }
    }
  }

  return diff
}

// ─── Approve version (supersede + create) ───────────────────────────────────

export interface ApproveVersionInput {
  businessId: string
  workspaceId: string
  profile: Record<string, JsonValue>
  approvedBy: string
  changeSummary?: string
}

/**
 * Approve a new profile version: supersede current, create new as current.
 * This is a higher-level wrapper around approveBusinessProfile.
 */
export async function approveVersion(
  repo: RepositoryPort,
  input: ApproveVersionInput,
): Promise<ServiceResult<BusinessProfileVersion>> {
  return approveBusinessProfile(
    repo,
    input.businessId,
    input.workspaceId,
    input.profile,
    input.approvedBy,
  )
}

// ─── Restore version ────────────────────────────────────────────────────────

export interface RestoreVersionInput {
  businessId: string
  workspaceId: string
  versionId: string
  restoredBy: string
  note?: string
}

/**
 * Restore a previous version as a new current version.
 * Creates a new version with the restored profile snapshot.
 */
export async function restoreVersion(
  repo: RepositoryPort,
  input: RestoreVersionInput,
): Promise<ServiceResult<BusinessProfileVersion>> {
  // Fetch the target version to get its profile snapshot
  const targetResult = await repo.getProfileVersion(
    input.workspaceId,
    input.versionId,
  )
  if (!targetResult.ok) return targetResult
  if (!targetResult.data) {
    return {
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Version not found' },
    }
  }

  const target = targetResult.data

  // Supersede current version
  const currentResult = await repo.getCurrentProfileVersion(
    input.workspaceId,
    input.businessId,
  )
  if (!currentResult.ok) return currentResult

  if (currentResult.data) {
    const supersedeResult = await repo.supersedeProfileVersions(
      input.workspaceId,
      input.businessId,
    )
    if (!supersedeResult.ok) return supersedeResult
  }

  // Calculate next version number
  const maxVersion = currentResult.data
    ? currentResult.data.version
    : 0

  // Create new version with restored profile
  const createResult = await repo.createProfileVersion({
    workspaceId: input.workspaceId,
    businessId: input.businessId,
    version: maxVersion + 1,
    profile: target.profile,
    profileMarkdown: target.profileMarkdown,
    status: ProfileVersionStatus.CURRENT,
    changeSummary: input.note ?? `Restored from version ${target.version}`,
    createdBy: input.restoredBy,
    approvedBy: input.restoredBy,
    approvedAt: new Date(),
  })

  if (!createResult.ok) return createResult

  // Audit the restore
  await repo.createAuditLog({
    workspaceId: input.workspaceId,
    businessId: input.businessId,
    actorId: input.restoredBy,
    actorType: 'user',
    eventType: 'version.restored',
    entityType: 'business_profile_version',
    entityId: createResult.data.id,
    before: currentResult.data
      ? { version: currentResult.data.version, status: currentResult.data.status }
      : null,
    after: {
      version: createResult.data.version,
      status: ProfileVersionStatus.CURRENT,
      restoredFrom: target.id,
      restoredFromVersion: target.version,
    },
  })

  return createResult
}
