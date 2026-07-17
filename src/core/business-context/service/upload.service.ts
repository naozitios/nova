import type { ClassificationProposal, ClassificationProposalConfig } from '../upload-classification-proposal'
import { acceptClassificationProposal } from '../upload-classification-proposal'
import type { UploadRepositoryPort } from '../repository/upload.port'
import type { UploadStoragePort } from '../upload-storage.port'
import type { UploadIntent, SourceType } from '../types/remediation-entities'
import { UploadIntentStatus, MalwareScanStatus } from '../types/remediation-entities'
import type { ServiceResult, ServiceError } from '../types/service'

// ── Types ──────────────────────────────────────────────────────────────────

export interface CreateSignedUploadIntentParams {
  workspaceId: string
  businessId: string
  proposal: ClassificationProposal
  expectedSizeBytes: number
  sourceType: SourceType
  sourceName: string
  sourceId?: string | null
  createdBy: string
}

export interface UploadIntentWithSignedUrl {
  intent: UploadIntent
  signedUrl: string
}

export interface UploadServiceConfig extends ClassificationProposalConfig {
  storageBucket: string
  intentTtlMs?: number
}

// ── Helpers ────────────────────────────────────────────────────────────────

function deriveStoragePath(
  workspaceId: string,
  businessId: string,
  normalizedFilename: string,
  now: number,
): string {
  return `${workspaceId}/${businessId}/${now}-${normalizedFilename}`
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function createSignedUploadIntent(
  repo: UploadRepositoryPort,
  storage: UploadStoragePort,
  params: CreateSignedUploadIntentParams,
  config: UploadServiceConfig,
): Promise<ServiceResult<UploadIntentWithSignedUrl>> {
  const now = (config.nowFn ?? Date.now)()

  const verification = acceptClassificationProposal(
    params.proposal,
    config,
    { workspaceId: params.workspaceId, businessId: params.businessId },
  )
  if (!verification.ok) {
    return { ok: false, error: (verification as { ok: false; error: ServiceError }).error }
  }

  const storagePath = deriveStoragePath(
    params.workspaceId,
    params.businessId,
    params.proposal.normalizedFilename,
    now,
  )

  const intentTtlMs = config.intentTtlMs ?? 3_600_000
  const intentResult = await repo.createUploadIntent({
    workspaceId: params.workspaceId,
    businessId: params.businessId,
    sourceId: params.sourceId ?? null,
    sourceType: params.sourceType,
    sourceName: params.sourceName,
    documentClass: params.proposal.documentClass,
    classificationSource: 'system_proposed',
    fileName: params.proposal.normalizedFilename,
    declaredMimeType: params.proposal.mimeType,
    expectedSizeBytes: params.expectedSizeBytes,
    storagePath,
    createdBy: params.createdBy,
    status: UploadIntentStatus.PENDING,
    malwareScanStatus: MalwareScanStatus.PENDING,
    malwareScanCode: null,
    malwareScannedAt: null,
    expiresAt: new Date(now + intentTtlMs),
    completedAt: null,
  })
  if (!intentResult.ok) {
    return { ok: false, error: (intentResult as { ok: false; error: ServiceError }).error }
  }

  const intentId = intentResult.data.id
  const expiresIn = Math.floor(intentTtlMs / 1000)
  const signedUrlResult = await storage.getSignedUrl({
    bucket: config.storageBucket,
    path: storagePath,
    expiresIn,
  })
  if (!signedUrlResult.ok) {
    await repo.deleteUploadIntent(params.workspaceId, intentId)
    return { ok: false, error: (signedUrlResult as { ok: false; error: ServiceError }).error }
  }

  return {
    ok: true,
    data: {
      intent: intentResult.data,
      signedUrl: signedUrlResult.data,
    },
  }
}
