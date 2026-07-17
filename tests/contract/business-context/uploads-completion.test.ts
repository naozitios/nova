import { describe, expect, it, vi } from 'vitest'
import {
  completeUploadIntent,
  type CompleteUploadConfig,
  type UploadContentValidator,
} from '../../../src/core/business-context/service/upload.service'
import {
  DocumentClass,
  UploadIntentStatus,
  MalwareScanStatus,
} from '../../../src/core/business-context/types/remediation-entities'
import type { UploadRepositoryPort } from '../../../src/core/business-context/repository/upload.port'
import type { UploadStoragePort } from '../../../src/core/business-context/upload-storage.port'
import type { UploadIntent } from '../../../src/core/business-context/types/remediation-entities'
import type { ContextSource, SourceDocument, ContextJob } from '../../../src/core/business-context/types'
import type { MalwareScannerPort } from '../../../src/core/business-context/malware-scanner.port'
import type { ServiceError } from '../../../src/core/business-context/types/service'
import type { ServiceResult } from '../../../src/core/business-context/types/service'

// ---------------------------------------------------------------------------
// T066 — Contract test: Upload completion (scanner order, fail-closed, dedup)
// ---------------------------------------------------------------------------

function getError(result: ServiceResult<unknown>): ServiceError {
  if (result.ok) throw new Error('expected error but got ok')
  return (result as { ok: false; error: ServiceError }).error
}

const NOW = 1_000_000
const CONTENT_HASH = 'sha256-abc123def456'
const DETECTED_MIME = 'application/pdf'
const CONTENT_BUFFER = Buffer.alloc(1024)

function makeIntent(overrides?: Partial<UploadIntent>): UploadIntent {
  return {
    id: 'intent-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sourceId: null,
    sourceType: 'upload',
    sourceName: 'test.pdf',
    documentClass: DocumentClass.BRAND_DECK,
    classificationSource: 'system_proposed',
    fileName: 'test.pdf',
    declaredMimeType: 'application/pdf',
    expectedSizeBytes: 1024,
    storagePath: 'ws-1/biz-1/1000000-test.pdf',
    createdBy: 'user-1',
    status: UploadIntentStatus.PENDING,
    malwareScanStatus: MalwareScanStatus.PENDING,
    malwareScanCode: null,
    malwareScannedAt: null,
    expiresAt: new Date(NOW + 3_600_000),
    completedAt: null,
    createdAt: new Date(NOW),
    ...overrides,
  }
}

function createMockRepo(): UploadRepositoryPort {
  return {
    createUploadIntent: vi.fn().mockResolvedValue({ ok: true, data: makeIntent() }),
    getUploadIntent: vi.fn().mockResolvedValue({ ok: true, data: null }),
    getUploadIntentByStoragePath: vi.fn().mockResolvedValue({ ok: true, data: null }),
    listUploadIntents: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    updateUploadIntentStatus: vi.fn().mockImplementation((_ws, _id, status, extra) =>
      Promise.resolve({ ok: true, data: makeIntent({ status, ...extra }) }),
    ),
    deleteUploadIntent: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    expireStaleIntents: vi.fn().mockResolvedValue({ ok: true, data: 0 }),
  }
}

function createMockStorage(): UploadStoragePort {
  return {
    upload: vi.fn().mockResolvedValue({ ok: true, data: { storagePath: 'x' } }),
    download: vi.fn().mockResolvedValue({ ok: true, data: Buffer.alloc(0) }),
    delete: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    getSignedUrl: vi.fn().mockResolvedValue({ ok: true, data: 'https://signed.example.com/upload' }),
  }
}

function makeContextSource(overrides?: Partial<ContextSource>): ContextSource {
  return {
    id: 'src-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sourceType: 'brand_deck' as ContextSource['sourceType'],
    sourceName: 'test.pdf',
    externalReference: null,
    status: 'registered',
    currentStage: 'queued',
    terminalOutcome: null,
    metadata: {},
    collectedAt: new Date(NOW),
    ...overrides,
  }
}

function makeSourceDocument(overrides?: Partial<SourceDocument>): SourceDocument {
  return {
    id: 'doc-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sourceId: 'src-1',
    url: null,
    title: null,
    documentType: null,
    mimeType: DETECTED_MIME,
    fileName: 'test.pdf',
    fileSizeBytes: 1024,
    contentText: null,
    storagePath: 'ws-1/biz-1/1000000-test.pdf',
    contentHash: CONTENT_HASH,
    httpStatus: null,
    pageOrSlideCount: null,
    parserName: null,
    parserVersion: null,
    effectiveAt: null,
    supersedesDocumentId: null,
    metadata: {},
    retrievedAt: new Date(NOW),
    ...overrides,
  }
}

function makeContextJob(overrides?: Partial<ContextJob>): ContextJob {
  return {
    id: 'job-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sessionId: null,
    jobType: 'source_processing',
    status: 'queued',
    attemptCount: 0,
    maxAttempts: 3,
    idempotencyKey: 'idem-1',
    stage: 'queued',
    input: {},
    output: null,
    error: null,
    errorClass: null,
    retryPolicy: {},
    nextRunAt: null,
    lockedBy: null,
    lockedAt: null,
    heartbeatAt: null,
    stageTimeoutSeconds: 30,
    createdAt: new Date(NOW),
    startedAt: null,
    completedAt: null,
    ...overrides,
  }
}

function createMockBcRepo() {
  return {
    getSourceDocumentByHash: vi.fn().mockResolvedValue({ ok: true, data: null }),
    getContextSource: vi.fn().mockResolvedValue({ ok: true, data: null }),
    createContextSource: vi.fn().mockResolvedValue({ ok: true, data: makeContextSource() }),
    createSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeSourceDocument() }),
    createContextJob: vi.fn().mockResolvedValue({ ok: true, data: makeContextJob() }),
    getContextJobByIdempotencyKey: vi.fn().mockResolvedValue({ ok: true, data: null }),
    archiveSource: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    updateContextSource: vi.fn().mockResolvedValue({ ok: true, data: makeContextSource() }),
  }
}

function createMockScanner(): MalwareScannerPort {
  return {
    scan: vi.fn().mockResolvedValue({ ok: true, data: { clean: true, engine: 'test-engine', details: 'none' } }),
  }
}

function createValidator(): UploadContentValidator {
  return vi.fn().mockResolvedValue({
    ok: true,
    data: { contentHash: CONTENT_HASH, detectedMimeType: DETECTED_MIME },
  })
}

function makeCompletionConfig(overrides?: Partial<CompleteUploadConfig>): CompleteUploadConfig {
  return {
    storageBucket: 'uploads',
    nowFn: () => NOW,
    ...overrides,
  }
}

function makePendingIntent(overrides?: Partial<UploadIntent>): UploadIntent {
  return makeIntent({
    status: UploadIntentStatus.PENDING,
    malwareScanStatus: MalwareScanStatus.PENDING,
    malwareScanCode: null,
    malwareScannedAt: null,
    completedAt: null,
    expiresAt: new Date(NOW + 3_600_000),
    ...overrides,
  })
}

describe('completeUploadIntent — contract', () => {
  it('creates source, document, and job for valid upload', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner = createMockScanner()
    const validator = createValidator()

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.intent.status).toBe(UploadIntentStatus.COMPLETED)
      expect(result.data.intent.malwareScanStatus).toBe(MalwareScanStatus.CLEAN)
      expect(result.data.intent.malwareScanCode).toBe(0)
      expect(result.data.source).toBeDefined()
      expect(result.data.document).toBeDefined()
      expect(result.data.job).toBeDefined()
      expect(result.data.job?.jobType).toBe('source_processing')
    }
    expect(bcRepo.createContextSource).toHaveBeenCalledOnce()
    expect(bcRepo.createSourceDocument).toHaveBeenCalledOnce()
    expect(bcRepo.createContextJob).toHaveBeenCalledOnce()
  })

  it('returns INTENT_NOT_FOUND when intent missing', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: null })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    const scanner = createMockScanner()
    const validator = createValidator()

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-missing' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('INTENT_NOT_FOUND')
    expect(bcRepo.createContextSource).not.toHaveBeenCalled()
  })

  it('returns INTENT_CROSS_BUSINESS when businessId mismatches', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent({ businessId: 'biz-other' }) })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    const scanner = createMockScanner()
    const validator = createValidator()

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('INTENT_CROSS_BUSINESS')
  })

  it('returns INTENT_EXPIRED and marks intent expired', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({
      ok: true,
      data: makePendingIntent({ expiresAt: new Date(NOW - 1) }),
    })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    const scanner = createMockScanner()
    const validator = createValidator()

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('INTENT_EXPIRED')
    expect(repo.updateUploadIntentStatus).toHaveBeenCalledWith(
      'ws-1', 'intent-1', UploadIntentStatus.EXPIRED,
    )
  })

  it('returns INTENT_NOT_PENDING when intent already completed', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({
      ok: true,
      data: makePendingIntent({ status: UploadIntentStatus.COMPLETED }),
    })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    const scanner = createMockScanner()
    const validator = createValidator()

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('INTENT_NOT_PENDING')
  })

  it('returns SIZE_MISMATCH when buffer size differs', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: Buffer.alloc(512) })
    const scanner = createMockScanner()
    const validator = createValidator()

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('SIZE_MISMATCH')
    expect(scanner.scan).not.toHaveBeenCalled()
  })

  it('treats scanner error as infected (fail-closed)', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner: MalwareScannerPort = {
      scan: vi.fn().mockResolvedValue({ ok: false, error: { code: 'SCANNER_UNAVAILABLE', message: 'down' } }),
    }
    const validator = createValidator()

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('SCAN_FAILED')
    expect(repo.updateUploadIntentStatus).toHaveBeenCalledWith(
      'ws-1', 'intent-1', UploadIntentStatus.FAILED,
      expect.objectContaining({ malwareScanStatus: MalwareScanStatus.ERROR, malwareScanCode: 2 }),
    )
    expect(bcRepo.createContextSource).not.toHaveBeenCalled()
  })

  it('marks intent failed/infected when scanner finds malware', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner: MalwareScannerPort = {
      scan: vi.fn().mockResolvedValue({ ok: true, data: { clean: false, engine: 'clamav', details: 'Trojan found' } }),
    }
    const validator = createValidator()

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('MALWARE_DETECTED')
    expect(repo.updateUploadIntentStatus).toHaveBeenCalledWith(
      'ws-1', 'intent-1', UploadIntentStatus.FAILED,
      expect.objectContaining({ malwareScanStatus: MalwareScanStatus.INFECTED, malwareScanCode: 1 }),
    )
    expect(bcRepo.createContextSource).not.toHaveBeenCalled()
  })

  it('returns existing source/doc for duplicate hash', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const existingSource = makeContextSource({ id: 'src-existing' })
    const existingDoc = makeSourceDocument({ id: 'doc-existing', sourceId: 'src-existing' })
    const bcRepo = createMockBcRepo()
    bcRepo.getSourceDocumentByHash = vi.fn().mockResolvedValue({ ok: true, data: existingDoc })
    bcRepo.getContextSource = vi.fn().mockResolvedValue({ ok: true, data: existingSource })
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner = createMockScanner()
    const validator = createValidator()

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.source.id).toBe('src-existing')
      expect(result.data.document.id).toBe('doc-existing')
      expect(result.data.job).toBeDefined()
    }
    expect(bcRepo.createContextSource).not.toHaveBeenCalled()
  })

  it('scanner runs before content validation (security-first order)', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })

    const callOrder: string[] = []
    const scanner: MalwareScannerPort = {
      scan: vi.fn().mockImplementation(async () => {
        callOrder.push('scanner')
        return { ok: true, data: { clean: true, engine: 'test', details: '' } }
      }),
    }
    const validator: UploadContentValidator = vi.fn().mockImplementation(async () => {
      callOrder.push('validator')
      return { ok: true, data: { contentHash: CONTENT_HASH, detectedMimeType: DETECTED_MIME } }
    })

    await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1' },
      makeCompletionConfig(),
    )

    expect(callOrder).toEqual(['scanner', 'validator'])
  })

  it('does not persist raw scanner details into intent update', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner: MalwareScannerPort = {
      scan: vi.fn().mockResolvedValue({
        ok: true,
        data: { clean: false, engine: 'clamav-0.103', details: 'Win.Trojan.Agent-12345' },
      }),
    }
    const validator = createValidator()

    await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1' },
      makeCompletionConfig(),
    )

    const updateCall = (repo.updateUploadIntentStatus as ReturnType<typeof vi.fn>).mock.calls[0]
    const additionalFields = updateCall[3]
    expect(additionalFields).not.toHaveProperty('engine')
    expect(additionalFields).not.toHaveProperty('details')
  })
})
