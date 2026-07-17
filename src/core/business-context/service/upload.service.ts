import type { ClassificationProposal, ClassificationProposalConfig } from '../upload-classification-proposal'
import { acceptClassificationProposal } from '../upload-classification-proposal'
import type { UploadRepositoryPort } from '../repository/upload.port'
import type { RepositoryPort } from '../repository/repository.port'
import type { UploadStoragePort } from '../upload-storage.port'
import type { MalwareScannerPort } from '../malware-scanner.port'
import type { UploadIntent, SourceType } from '../types/remediation-entities'
import { UploadIntentStatus, MalwareScanStatus, DocumentClass } from '../types/remediation-entities'
import type { ContextSource, SourceDocument, ContextJob } from '../types'
import { SourceProcessingStage, JobStatus, SourceType as ContextSourceType } from '../types/enums'
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
  classificationSource?: 'user_selected' | 'system_proposed'
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
    classificationSource: params.classificationSource ?? verification.data.classificationSource,
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

// ── Completion Types ───────────────────────────────────────────────────────

export interface UploadContentValidatorResult {
  contentHash: string
  detectedMimeType: string
}

export type UploadContentValidator = (
  buffer: Buffer,
  declaredMimeType: string,
  fileName: string,
) => Promise<ServiceResult<UploadContentValidatorResult>>

export type UploadCompletionRepository = Pick<
  RepositoryPort,
  | 'getSourceDocumentByHash'
  | 'getContextSource'
  | 'createContextSource'
  | 'createSourceDocument'
  | 'createContextJob'
  | 'archiveSource'
  | 'getContextJobByIdempotencyKey'
  | 'updateContextSource'
>

export interface CompleteUploadIntentParams {
  workspaceId: string
  businessId: string
  intentId: string
  storagePath: string
  checksumSha256?: string | null
}

export interface CompleteUploadConfig {
  storageBucket: string
  sourceProcessingStageTimeoutSeconds?: number
  nowFn?: () => number
}

export interface UploadCompletionResult {
  intent: UploadIntent
  source: ContextSource
  document: SourceDocument
  job: ContextJob | null
}

// ── Helpers ────────────────────────────────────────────────────────────────

const DOC_CLASS_TO_SOURCE_TYPE: Record<DocumentClass, ContextSourceType> = {
  [DocumentClass.BRAND_DECK]: ContextSourceType.BRAND_DECK,
  [DocumentClass.PRODUCT_DOCUMENT]: ContextSourceType.PRODUCT_DOCUMENT,
  [DocumentClass.RESEARCH_DOCUMENT]: ContextSourceType.RESEARCH_DOCUMENT,
  [DocumentClass.CAMPAIGN_BRIEF]: ContextSourceType.CAMPAIGN_BRIEF,
  [DocumentClass.WEBSITE_CONTENT]: ContextSourceType.WEBSITE,
  [DocumentClass.OTHER]: ContextSourceType.SYSTEM_INFERENCE,
}

// ── Completion API ─────────────────────────────────────────────────────────

export async function completeUploadIntent(
  uploadRepo: UploadRepositoryPort,
  bcRepo: UploadCompletionRepository,
  storage: UploadStoragePort,
  scanner: MalwareScannerPort,
  validator: UploadContentValidator,
  params: CompleteUploadIntentParams,
  config: CompleteUploadConfig,
): Promise<ServiceResult<UploadCompletionResult>> {
  const now = (config.nowFn ?? Date.now)()

  // 1. Load intent scoped to workspace
  const intentResult = await uploadRepo.getUploadIntent(params.workspaceId, params.intentId)
  if (!intentResult.ok) {
    return intentResult as ServiceResult<never>
  }
  const intent = intentResult.data
  if (!intent) {
    return { ok: false, error: { code: 'INTENT_NOT_FOUND', message: 'Upload intent not found' } }
  }

  // 2. Verify business binding, status pending, not expired
  if (intent.businessId !== params.businessId) {
    return { ok: false, error: { code: 'INTENT_CROSS_BUSINESS', message: 'Intent belongs to different business' } }
  }
  if (intent.status !== UploadIntentStatus.PENDING) {
    return { ok: false, error: { code: 'INTENT_NOT_PENDING', message: 'Intent is not in pending status' } }
  }
  if (intent.expiresAt.getTime() < now) {
    await uploadRepo.updateUploadIntentStatus(params.workspaceId, params.intentId, UploadIntentStatus.EXPIRED)
    return { ok: false, error: { code: 'INTENT_EXPIRED', message: 'Upload intent has expired' } }
  }

  // 2b. Verify caller-supplied storage path matches intent
  if (params.storagePath !== intent.storagePath) {
    return { ok: false, error: { code: 'STORAGE_PATH_MISMATCH', message: 'Caller storage path does not match intent' } }
  }

  // 3. Download private object
  const downloadResult = await storage.download({
    bucket: config.storageBucket,
    path: intent.storagePath,
  })
  if (!downloadResult.ok) {
    return downloadResult as ServiceResult<never>
  }
  const buffer = downloadResult.data

  // 4. Exact size check
  if (buffer.length !== intent.expectedSizeBytes) {
    return {
      ok: false,
      error: {
        code: 'SIZE_MISMATCH',
        message: `Expected ${intent.expectedSizeBytes} bytes, got ${buffer.length}`,
      },
    }
  }

  // 5. Scanner scan — fail-closed (must run before content validation)
  const scanResult = await scanner.scan({ buffer, fileName: intent.fileName })
  let scanStatus: MalwareScanStatus
  let scanCode: number

  if (!scanResult.ok) {
    // Scanner unavailable → fail-closed → treated as infected
    scanStatus = MalwareScanStatus.ERROR
    scanCode = 2
  } else if (!scanResult.data.clean) {
    scanStatus = MalwareScanStatus.INFECTED
    scanCode = 1
  } else {
    scanStatus = MalwareScanStatus.CLEAN
    scanCode = 0
  }

  // 6. Infected/error → zero source/doc/job, persist safe scan code
  if (scanStatus !== MalwareScanStatus.CLEAN) {
    await uploadRepo.updateUploadIntentStatus(params.workspaceId, params.intentId, UploadIntentStatus.FAILED, {
      malwareScanStatus: scanStatus,
      malwareScanCode: scanCode,
      malwareScannedAt: new Date(now),
    })
    return {
      ok: false,
      error: {
        code: scanStatus === MalwareScanStatus.INFECTED ? 'MALWARE_DETECTED' : 'SCAN_FAILED',
        message: 'Content failed security scan',
      },
    }
  }

  // 7. Validator verifies signature/MIME → contentHash + detectedMimeType
  const validationResult = await validator(buffer, intent.declaredMimeType, intent.fileName)
  if (!validationResult.ok) {
    await uploadRepo.updateUploadIntentStatus(params.workspaceId, params.intentId, UploadIntentStatus.FAILED, {
      malwareScanStatus: MalwareScanStatus.CLEAN,
      malwareScanCode: 0,
      malwareScannedAt: new Date(now),
    })
    return validationResult as ServiceResult<never>
  }
  const { contentHash, detectedMimeType } = validationResult.data

  // 7b. Verify caller-supplied checksum matches computed hash
  if (params.checksumSha256 != null && params.checksumSha256 !== contentHash) {
    await uploadRepo.updateUploadIntentStatus(params.workspaceId, params.intentId, UploadIntentStatus.FAILED, {
      malwareScanStatus: MalwareScanStatus.CLEAN,
      malwareScanCode: 0,
      malwareScannedAt: new Date(now),
    })
    return { ok: false, error: { code: 'CHECKSUM_MISMATCH', message: 'Caller checksum does not match computed content hash' } }
  }

  // 8. Check duplicate hash
  const existingDocResult = await bcRepo.getSourceDocumentByHash(params.businessId, contentHash)
  if (!existingDocResult.ok) {
    return existingDocResult as ServiceResult<never>
  }

  if (existingDocResult.data) {
    // Duplicate → return existing source/doc, ensure job exists via deterministic key
    const existingSourceResult = await bcRepo.getContextSource(params.workspaceId, existingDocResult.data.sourceId)
    if (!existingSourceResult.ok) {
      return existingSourceResult as ServiceResult<never>
    }
    if (!existingSourceResult.data) {
      return { ok: false, error: { code: 'SOURCE_NOT_FOUND', message: 'Existing source not found for duplicate document' } }
    }

    const idempotencyKey = `upload-${intent.id}-${contentHash}`
    let jobResult = await bcRepo.getContextJobByIdempotencyKey(idempotencyKey)
    if (!jobResult.ok) {
      return jobResult as ServiceResult<never>
    }

    if (!jobResult.data) {
      jobResult = await bcRepo.createContextJob({
        workspaceId: params.workspaceId,
        businessId: params.businessId,
        sessionId: null,
        jobType: 'source_processing',
        status: JobStatus.QUEUED,
        attemptCount: 0,
        maxAttempts: 3,
        idempotencyKey,
        stage: SourceProcessingStage.QUEUED,
        input: { sourceId: existingDocResult.data.sourceId, documentId: existingDocResult.data.id },
        output: null,
        error: null,
        errorClass: null,
        retryPolicy: {},
        nextRunAt: null,
        lockedBy: null,
        lockedAt: null,
        heartbeatAt: null,
        stageTimeoutSeconds: config.sourceProcessingStageTimeoutSeconds ?? 30,
        startedAt: null,
        completedAt: null,
      })
      if (!jobResult.ok) {
        return jobResult as ServiceResult<never>
      }
    }

    const completedIntent = await uploadRepo.updateUploadIntentStatus(params.workspaceId, params.intentId, UploadIntentStatus.COMPLETED, {
      malwareScanStatus: MalwareScanStatus.CLEAN,
      malwareScanCode: 0,
      malwareScannedAt: new Date(now),
      completedAt: new Date(now),
    })
    if (!completedIntent.ok) {
      return completedIntent as ServiceResult<never>
    }

    return {
      ok: true,
      data: {
        intent: completedIntent.data,
        source: existingSourceResult.data,
        document: existingDocResult.data,
        job: jobResult.data,
      },
    }
  }

  // 9. Success → create source, document, job
  const sourceType = DOC_CLASS_TO_SOURCE_TYPE[intent.documentClass]
  const sourceResult = await bcRepo.createContextSource({
    workspaceId: params.workspaceId,
    businessId: params.businessId,
    sourceType,
    sourceName: intent.sourceName,
    externalReference: null,
    status: 'queued',
    currentStage: SourceProcessingStage.QUEUED,
    terminalOutcome: null,
    metadata: {},
    collectedAt: new Date(now),
  })
  if (!sourceResult.ok) {
    return sourceResult as ServiceResult<never>
  }

  const docResult = await bcRepo.createSourceDocument({
    workspaceId: params.workspaceId,
    businessId: params.businessId,
    sourceId: sourceResult.data.id,
    url: null,
    title: null,
    documentType: intent.documentClass,
    mimeType: detectedMimeType,
    fileName: intent.fileName,
    fileSizeBytes: intent.expectedSizeBytes,
    contentText: null,
    storagePath: intent.storagePath,
    contentHash,
    httpStatus: null,
    pageOrSlideCount: null,
    parserName: null,
    parserVersion: null,
    effectiveAt: null,
    supersedesDocumentId: null,
    metadata: {},
    retrievedAt: new Date(now),
  })
  if (!docResult.ok) {
    // Archive orphaned source, leave intent pending for retry
    await bcRepo.archiveSource(params.workspaceId, sourceResult.data.id)
    return docResult as ServiceResult<never>
  }

  const jobResult = await bcRepo.createContextJob({
    workspaceId: params.workspaceId,
    businessId: params.businessId,
    sessionId: null,
    jobType: 'source_processing',
    status: JobStatus.QUEUED,
    attemptCount: 0,
    maxAttempts: 3,
    idempotencyKey: `upload-${intent.id}-${contentHash}`,
    stage: SourceProcessingStage.QUEUED,
    input: { sourceId: sourceResult.data.id, documentId: docResult.data.id },
    output: null,
    error: null,
    errorClass: null,
    retryPolicy: {},
    nextRunAt: null,
    lockedBy: null,
    lockedAt: null,
    heartbeatAt: null,
    stageTimeoutSeconds: config.sourceProcessingStageTimeoutSeconds ?? 30,
    startedAt: null,
    completedAt: null,
  })
  if (!jobResult.ok) {
    return jobResult as ServiceResult<never>
  }

  // 10. Mark intent completed/clean
  const completedIntent = await uploadRepo.updateUploadIntentStatus(params.workspaceId, params.intentId, UploadIntentStatus.COMPLETED, {
    malwareScanStatus: MalwareScanStatus.CLEAN,
    malwareScanCode: 0,
    malwareScannedAt: new Date(now),
    completedAt: new Date(now),
  })
  if (!completedIntent.ok) {
    return completedIntent as ServiceResult<never>
  }

  return {
    ok: true,
    data: {
      intent: completedIntent.data,
      source: sourceResult.data,
      document: docResult.data,
      job: jobResult.data,
    },
  }
}
