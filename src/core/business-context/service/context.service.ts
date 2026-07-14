// US4: Post-onboarding context management — corrections, draft, diff, approve, versions, restore.

import type { RepositoryPort } from '../repository.port'
import type {
  BusinessProfileVersion,
  ContextFact,
  JsonValue,
} from '../types'
import type { VerificationStatus } from '../types'
import { compileDraftFromFacts, projectToMarkdown } from '../compiler'
import {
  approveBusinessProfile,
  computeFieldDiffs,
  restoreVersion,
  type FieldDiffMap,
} from '../versioning'

export interface AddCorrectionInput {
  businessId: string
  workspaceId: string
  userId: string
  factKey: string
  value: JsonValue
  supersedesFactId?: string
}

/**
 * Add a user-verified correction fact.
 * Creates a new fact with user_verified status, optionally superseding an earlier fact.
 */
export async function addCorrection(
  repo: RepositoryPort,
  input: AddCorrectionInput,
): Promise<{ ok: true; data: ContextFact } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const business = await repo.getBusiness(input.workspaceId, input.businessId)
  if (!business.ok) return business
  if (!business.data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Business not found' } }
  }

  const factResult = await repo.createContextFact({
    workspaceId: input.workspaceId,
    businessId: input.businessId,
    factKey: input.factKey,
    value: input.value,
    sourceId: 'src-manual',
    sourceDocumentId: null,
    sourceExcerpt: null,
    evidenceLocator: null,
    confidence: 1.0,
    verificationStatus: 'user_verified' as VerificationStatus,
    supersedesFactId: input.supersedesFactId ?? null,
    validFrom: new Date(),
    validTo: null,
    createdBy: input.userId,
  })

  if (!factResult.ok) return factResult

  await repo.createAuditLog({
    workspaceId: input.workspaceId,
    businessId: input.businessId,
    actorId: input.userId,
    actorType: 'user',
    eventType: 'fact.corrected',
    entityType: 'context_fact',
    entityId: factResult.data.id,
    before: input.supersedesFactId
      ? { supersedesFactId: input.supersedesFactId }
      : null,
    after: {
      factKey: input.factKey,
      value: input.value,
      verificationStatus: 'user_verified',
    },
  })

  return factResult
}

export interface CompiledDraftResult {
  profile: Record<string, JsonValue>
  unresolvedFields: string[]
  warnings: string[]
  markdown: string
}

/**
 * Compile a draft profile from active facts for a business.
 */
export async function compileDraft(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<{ ok: true; data: CompiledDraftResult } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const business = await repo.getBusiness(workspaceId, businessId)
  if (!business.ok) return business
  if (!business.data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Business not found' } }
  }

  const draftResult = await compileDraftFromFacts(repo, businessId, workspaceId)
  if (!draftResult.ok) return draftResult

  const markdown = projectToMarkdown(draftResult.data.profile)

  return {
    ok: true,
    data: {
      ...draftResult.data,
      markdown,
    },
  }
}

export interface DiffResult {
  currentVersion: number | null
  draftVersion: number | null
  diffs: FieldDiffMap
}

/**
 * Compute field-level diff between current profile version and a draft profile.
 */
export async function computeDiff(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  draft: Record<string, JsonValue>,
): Promise<{ ok: true; data: DiffResult } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const currentResult = await repo.getCurrentProfileVersion(workspaceId, businessId)
  if (!currentResult.ok) return currentResult

  const currentProfile = currentResult.data?.profile ?? {}
  const diffs = computeFieldDiffs(currentProfile, draft)

  return {
    ok: true,
    data: {
      currentVersion: currentResult.data?.version ?? null,
      draftVersion: null,
      diffs,
    },
  }
}

export interface ApproveContextInput {
  businessId: string
  workspaceId: string
  profile: Record<string, JsonValue>
  approvedBy: string
  changeSummary?: string
}

/**
 * Approve a new profile version from a compiled draft.
 */
export async function approveContext(
  repo: RepositoryPort,
  input: ApproveContextInput,
): Promise<{ ok: true; data: BusinessProfileVersion } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const business = await repo.getBusiness(input.workspaceId, input.businessId)
  if (!business.ok) return business
  if (!business.data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Business not found' } }
  }

  return approveBusinessProfile(
    repo,
    input.businessId,
    input.workspaceId,
    input.profile,
    input.approvedBy,
  )
}

/**
 * List all profile versions for a business, ordered by version descending.
 */
export async function listVersions(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<{ ok: true; data: { items: BusinessProfileVersion[]; total: number } } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  return repo.listProfileVersions({
    workspaceId,
    businessId,
  })
}

export interface RestoreContextInput {
  businessId: string
  workspaceId: string
  versionId: string
  restoredBy: string
  note?: string
}

/**
 * Restore a previous profile version as a new current version.
 */
export async function restoreContextVersion(
  repo: RepositoryPort,
  input: RestoreContextInput,
): Promise<{ ok: true; data: BusinessProfileVersion } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const business = await repo.getBusiness(input.workspaceId, input.businessId)
  if (!business.ok) return business
  if (!business.data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Business not found' } }
  }

  return restoreVersion(repo, input)
}
