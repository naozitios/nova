import type { RepositoryPort } from './repository.port'
import type { BusinessProfileVersion, JsonValue, ServiceResult } from './types'

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
