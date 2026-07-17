import { describe, expect, it, vi } from 'vitest'
import {
  createSignedUploadIntent,
  completeUploadIntent,
  type UploadServiceConfig,
  type CompleteUploadConfig,
  type UploadContentValidator,
} from './upload.service'
import {
  createClassificationProposal,
  type ClassificationProposal,
} from '../upload-classification-proposal'
import {
  DocumentClass,
  UploadIntentStatus,
  MalwareScanStatus,
} from '../types/remediation-entities'
import type { UploadRepositoryPort } from '../repository/upload.port'
import type { UploadStoragePort } from '../upload-storage.port'
import type { UploadIntent } from '../types/remediation-entities'
import type { ContextSource, SourceDocument, ContextJob } from '../types'
import type { MalwareScannerPort } from '../malware-scanner.port'
import type { ServiceError } from '../types/service'
import type { ServiceResult } from '../types/service'

// ── Helpers ────────────────────────────────────────────────────────────────

function getError(result: ServiceResult<unknown>): ServiceError {
  if (result.ok) throw new Error('expected error but got ok')
  return (result as { ok: false; error: ServiceError }).error
}

// ── Mock factories ────────────────────────────────────────────────────────

const SIGNING_SECRET = 'test-secret-123'
const NOW = 1_000_000
const TTL_MS = 300_000

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

function makeProposal(overrides?: { workspaceId?: string; businessId?: string }): ClassificationProposal {
  return createClassificationProposal(
    {
      workspaceId: overrides?.workspaceId ?? 'ws-1',
      businessId: overrides?.businessId ?? 'biz-1',
      filename: 'test.pdf',
      mimeType: 'application/pdf',
      documentClass: DocumentClass.BRAND_DECK,
    },
    { signingSecret: SIGNING_SECRET, ttlMs: TTL_MS, nowFn: () => NOW },
  )
}

function makeConfig(overrides?: Partial<UploadServiceConfig>): UploadServiceConfig {
  return {
    signingSecret: SIGNING_SECRET,
    ttlMs: TTL_MS,
    nowFn: () => NOW,
    storageBucket: 'uploads',
    ...overrides,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('createSignedUploadIntent', () => {
  it('creates pending intent with signed URL for valid proposal', async () => {
    const repo = createMockRepo()
    const storage = createMockStorage()
    const proposal = makeProposal()

    const result = await createSignedUploadIntent(repo, storage, {
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      proposal,
      expectedSizeBytes: 1024,
      sourceType: 'upload',
      sourceName: 'test.pdf',
      createdBy: 'user-1',
    }, makeConfig())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.intent.status).toBe(UploadIntentStatus.PENDING)
      expect(result.data.intent.malwareScanStatus).toBe(MalwareScanStatus.PENDING)
      expect(result.data.intent.documentClass).toBe(DocumentClass.BRAND_DECK)
      expect(result.data.intent.classificationSource).toBe('system_proposed')
      expect(result.data.intent.workspaceId).toBe('ws-1')
      expect(result.data.intent.businessId).toBe('biz-1')
      expect(result.data.intent.sourceType).toBe('upload')
      expect(result.data.intent.sourceName).toBe('test.pdf')
      expect(result.data.intent.fileName).toBe('test.pdf')
      expect(result.data.intent.declaredMimeType).toBe('application/pdf')
      expect(result.data.intent.expectedSizeBytes).toBe(1024)
      expect(result.data.intent.createdBy).toBe('user-1')
      expect(result.data.intent.sourceId).toBeNull()
      expect(result.data.intent.completedAt).toBeNull()
      expect(result.data.signedUrl).toBe('https://signed.example.com/upload')
      expect(repo.createUploadIntent).toHaveBeenCalledOnce()
      expect(storage.getSignedUrl).toHaveBeenCalledOnce()
      expect(storage.getSignedUrl).toHaveBeenCalledWith({
        bucket: 'uploads',
        path: 'ws-1/biz-1/1000000-test.pdf',
        expiresIn: 3600,
      })
    }
  })

  it('persists user-selected provenance when supplied by the server route', async () => {
    const repo = createMockRepo()
    const storage = createMockStorage()

    await createSignedUploadIntent(repo, storage, {
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      proposal: makeProposal(),
      expectedSizeBytes: 1024,
      sourceType: 'upload',
      sourceName: 'test.pdf',
      createdBy: 'user-1',
      classificationSource: 'user_selected',
    }, makeConfig())

    expect(repo.createUploadIntent).toHaveBeenCalledWith(
      expect.objectContaining({ classificationSource: 'user_selected' }),
    )
  })

  it('rejects forged proposal', async () => {
    const repo = createMockRepo()
    const storage = createMockStorage()
    const proposal = makeProposal()
    const forged: ClassificationProposal = { ...proposal, signature: 'ff'.repeat(32) }

    const result = await createSignedUploadIntent(repo, storage, {
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      proposal: forged,
      expectedSizeBytes: 1024,
      sourceType: 'upload',
      sourceName: 'test.pdf',
      createdBy: 'user-1',
    }, makeConfig())

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('PROPOSAL_FORGED')
    expect(repo.createUploadIntent).not.toHaveBeenCalled()
    expect(storage.getSignedUrl).not.toHaveBeenCalled()
  })

  it('rejects expired proposal', async () => {
    const repo = createMockRepo()
    const storage = createMockStorage()
    const proposal = makeProposal()

    const result = await createSignedUploadIntent(repo, storage, {
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      proposal,
      expectedSizeBytes: 1024,
      sourceType: 'upload',
      sourceName: 'test.pdf',
      createdBy: 'user-1',
    }, makeConfig({ nowFn: () => NOW + TTL_MS + 1 }))

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('PROPOSAL_EXPIRED')
    expect(repo.createUploadIntent).not.toHaveBeenCalled()
  })

  it('rejects cross-workspace proposal', async () => {
    const repo = createMockRepo()
    const storage = createMockStorage()
    const proposal = makeProposal({ workspaceId: 'ws-other' })

    const result = await createSignedUploadIntent(repo, storage, {
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      proposal,
      expectedSizeBytes: 1024,
      sourceType: 'upload',
      sourceName: 'test.pdf',
      createdBy: 'user-1',
    }, makeConfig())

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('PROPOSAL_CROSS_WORKSPACE')
    expect(repo.createUploadIntent).not.toHaveBeenCalled()
  })

  it('rejects cross-business proposal', async () => {
    const repo = createMockRepo()
    const storage = createMockStorage()
    const proposal = makeProposal({ businessId: 'biz-other' })

    const result = await createSignedUploadIntent(repo, storage, {
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      proposal,
      expectedSizeBytes: 1024,
      sourceType: 'upload',
      sourceName: 'test.pdf',
      createdBy: 'user-1',
    }, makeConfig())

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('PROPOSAL_CROSS_BUSINESS')
    expect(repo.createUploadIntent).not.toHaveBeenCalled()
  })

  it('derives server-owned storage path from workspace/business/now', async () => {
    const repo = createMockRepo()
    const storage = createMockStorage()
    const proposal = makeProposal()

    const result = await createSignedUploadIntent(repo, storage, {
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      proposal,
      expectedSizeBytes: 1024,
      sourceType: 'upload',
      sourceName: 'test.pdf',
      createdBy: 'user-1',
    }, makeConfig())

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.intent.storagePath).toBe('ws-1/biz-1/1000000-test.pdf')
    }
  })

  it('propagates repo failure', async () => {
    const repo = createMockRepo()
    repo.createUploadIntent = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'DB_ERROR', message: 'connection refused' },
    })
    const storage = createMockStorage()
    const proposal = makeProposal()

    const result = await createSignedUploadIntent(repo, storage, {
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      proposal,
      expectedSizeBytes: 1024,
      sourceType: 'upload',
      sourceName: 'test.pdf',
      createdBy: 'user-1',
    }, makeConfig())

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('DB_ERROR')
    expect(storage.getSignedUrl).not.toHaveBeenCalled()
  })

  it('propagates storage signed-url failure', async () => {
    const repo = createMockRepo()
    const storage = createMockStorage()
    storage.getSignedUrl = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'STORAGE_ERROR', message: 'bucket not found' },
    })
    const proposal = makeProposal()

    const result = await createSignedUploadIntent(repo, storage, {
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      proposal,
      expectedSizeBytes: 1024,
      sourceType: 'upload',
      sourceName: 'test.pdf',
      createdBy: 'user-1',
    }, makeConfig())

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('STORAGE_ERROR')
    expect(repo.createUploadIntent).toHaveBeenCalled()
    expect(repo.deleteUploadIntent).toHaveBeenCalledWith('ws-1', 'intent-1')
  })

  it('forwards custom intentTtlMs as expiresIn to signed URL', async () => {
    const repo = createMockRepo()
    const storage = createMockStorage()
    const proposal = makeProposal()
    const customTtlMs = 600_000

    const result = await createSignedUploadIntent(repo, storage, {
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      proposal,
      expectedSizeBytes: 1024,
      sourceType: 'upload',
      sourceName: 'test.pdf',
      createdBy: 'user-1',
    }, makeConfig({ intentTtlMs: customTtlMs }))

    expect(result.ok).toBe(true)
    expect(storage.getSignedUrl).toHaveBeenCalledWith({
      bucket: 'uploads',
      path: 'ws-1/biz-1/1000000-test.pdf',
      expiresIn: 600,
    })
  })
})

// ── completeUploadIntent ───────────────────────────────────────────────────

const CONTENT_HASH = 'sha256-abc123def456'
const DETECTED_MIME = 'application/pdf'
const CONTENT_BUFFER = Buffer.alloc(1024)

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
    archiveSource: vi.fn().mockResolvedValue({ ok: true, data: makeContextSource({ status: 'archived' }) }),
    getContextJobByIdempotencyKey: vi.fn().mockResolvedValue({ ok: true, data: null }),
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

describe('completeUploadIntent', () => {
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
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
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
      expect(result.data.job?.stageTimeoutSeconds).toBe(30)
      expect(result.data.job?.status).toBe('queued')
    }
    expect(bcRepo.createContextSource).toHaveBeenCalledOnce()
    expect(bcRepo.createSourceDocument).toHaveBeenCalledOnce()
    expect(bcRepo.createContextJob).toHaveBeenCalledOnce()
    expect(repo.updateUploadIntentStatus).toHaveBeenCalledWith(
      'ws-1', 'intent-1', UploadIntentStatus.COMPLETED,
      expect.objectContaining({ malwareScanStatus: MalwareScanStatus.CLEAN, malwareScanCode: 0 }),
    )
  })

  it('maps documentClass to correct sourceType', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({
      ok: true,
      data: makePendingIntent({ documentClass: DocumentClass.PRODUCT_DOCUMENT }),
    })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner = createMockScanner()
    const validator = createValidator()

    await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(bcRepo.createContextSource).toHaveBeenCalledWith(
      expect.objectContaining({ sourceType: 'product_document' }),
    )
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
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-missing', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
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
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
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
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
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
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
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
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('SIZE_MISMATCH')
    expect(scanner.scan).not.toHaveBeenCalled()
  })

  it('propagates validator error and marks intent failed/skipped', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner = createMockScanner()
    const validator: UploadContentValidator = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'CONTENT_VALIDATION_FAILED', message: 'Invalid signature' },
    })

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('CONTENT_VALIDATION_FAILED')
    expect(repo.updateUploadIntentStatus).toHaveBeenCalledWith(
      'ws-1', 'intent-1', UploadIntentStatus.FAILED,
      expect.objectContaining({ malwareScanStatus: MalwareScanStatus.CLEAN, malwareScanCode: 0 }),
    )
    expect(scanner.scan).toHaveBeenCalled()
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
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
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
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('MALWARE_DETECTED')
    expect(repo.updateUploadIntentStatus).toHaveBeenCalledWith(
      'ws-1', 'intent-1', UploadIntentStatus.FAILED,
      expect.objectContaining({ malwareScanStatus: MalwareScanStatus.INFECTED, malwareScanCode: 1 }),
    )
    expect(bcRepo.createContextSource).not.toHaveBeenCalled()
    expect(bcRepo.createSourceDocument).not.toHaveBeenCalled()
    expect(bcRepo.createContextJob).not.toHaveBeenCalled()
  })

  it('returns existing source/doc and creates deterministic job for duplicate hash', async () => {
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
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.source.id).toBe('src-existing')
      expect(result.data.document.id).toBe('doc-existing')
      expect(result.data.job).toBeDefined()
      expect(result.data.intent.status).toBe(UploadIntentStatus.COMPLETED)
    }
    expect(bcRepo.createContextSource).not.toHaveBeenCalled()
    expect(bcRepo.createSourceDocument).not.toHaveBeenCalled()
    expect(bcRepo.getContextJobByIdempotencyKey).toHaveBeenCalledWith(`upload-intent-1-${CONTENT_HASH}`)
    expect(bcRepo.createContextJob).toHaveBeenCalledOnce()
    expect(bcRepo.createContextJob).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: `upload-intent-1-${CONTENT_HASH}` }),
    )
  })

  it('preserves storage path and contentHash in created document', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner = createMockScanner()
    const validator = createValidator()

    await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(bcRepo.createSourceDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: 'ws-1/biz-1/1000000-test.pdf',
        contentHash: CONTENT_HASH,
        mimeType: DETECTED_MIME,
      }),
    )
  })

  it('uses custom stageTimeoutSeconds from config', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner = createMockScanner()
    const validator = createValidator()

    await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig({ sourceProcessingStageTimeoutSeconds: 60 }),
    )

    expect(bcRepo.createContextJob).toHaveBeenCalledWith(
      expect.objectContaining({ stageTimeoutSeconds: 60 }),
    )
  })

  it('does not persist raw scanner details', async () => {
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

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    // Scan code is the safe numeric code, not raw engine/details strings
    expect(repo.updateUploadIntentStatus).toHaveBeenCalledWith(
      'ws-1', 'intent-1', UploadIntentStatus.FAILED,
      expect.objectContaining({
        malwareScanCode: 1,
        malwareScanStatus: MalwareScanStatus.INFECTED,
      }),
    )
    // Verify no scanner metadata leaked into any call
    const updateCall = (repo.updateUploadIntentStatus as ReturnType<typeof vi.fn>).mock.calls[0]
    const additionalFields = updateCall[3]
    expect(additionalFields).not.toHaveProperty('engine')
    expect(additionalFields).not.toHaveProperty('details')
  })

  // ── Recovery tests ──────────────────────────────────────────────────────

  it('archives newly created source when createSourceDocument fails, leaves intent pending', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const createdSource = makeContextSource({ id: 'src-new' })
    bcRepo.createContextSource = vi.fn().mockResolvedValue({ ok: true, data: createdSource })
    bcRepo.createSourceDocument = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: 'CREATE_FAILED', message: 'db write error' },
    })
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner = createMockScanner()
    const validator = createValidator()

    const result = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(result.ok).toBe(false)
    expect(getError(result).code).toBe('CREATE_FAILED')
    expect(bcRepo.archiveSource).toHaveBeenCalledWith('ws-1', 'src-new')
    // Intent stays pending — not completed, not failed
    expect(repo.updateUploadIntentStatus).not.toHaveBeenCalledWith(
      'ws-1', 'intent-1', UploadIntentStatus.COMPLETED,
      expect.anything(),
    )
  })

  it('retries duplicate hash: finds existing job or creates one, completes intent without second source/doc', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const existingSource = makeContextSource({ id: 'src-existing' })
    const existingDoc = makeSourceDocument({ id: 'doc-existing', sourceId: 'src-existing' })
    bcRepo.getSourceDocumentByHash = vi.fn().mockResolvedValue({ ok: true, data: existingDoc })
    bcRepo.getContextSource = vi.fn().mockResolvedValue({ ok: true, data: existingSource })

    // First attempt: createContextJob fails
    bcRepo.createContextJob = vi.fn().mockResolvedValueOnce({
      ok: false,
      error: { code: 'CREATE_FAILED', message: 'db write error' },
    })

    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner = createMockScanner()
    const validator = createValidator()

    // First call: job creation fails
    const result1 = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(result1.ok).toBe(false)
    expect(getError(result1).code).toBe('CREATE_FAILED')
    // Source/doc were NOT created (we hit duplicate path)
    expect(bcRepo.createContextSource).not.toHaveBeenCalled()
    expect(bcRepo.createSourceDocument).not.toHaveBeenCalled()

    // Second call: duplicate hash → getContextJobByIdempotencyKey finds existing job
    const idempotencyKey = `upload-intent-1-${CONTENT_HASH}`
    const existingJob = makeContextJob({ id: 'job-existing', idempotencyKey })
    bcRepo.getContextJobByIdempotencyKey = vi.fn().mockResolvedValue({ ok: true, data: existingJob })

    // Reset intent back to pending for retry
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })

    const result2 = await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(result2.ok).toBe(true)
    if (result2.ok) {
      expect(result2.data.source.id).toBe('src-existing')
      expect(result2.data.document.id).toBe('doc-existing')
      expect(result2.data.job?.id).toBe('job-existing')
      expect(result2.data.intent.status).toBe(UploadIntentStatus.COMPLETED)
    }
    // No new source/doc created on retry
    expect(bcRepo.createContextSource).not.toHaveBeenCalled()
    expect(bcRepo.createSourceDocument).not.toHaveBeenCalled()
    // Job lookup used deterministic key
    expect(bcRepo.getContextJobByIdempotencyKey).toHaveBeenCalledWith(idempotencyKey)
  })

  it('source status after creation is queued with currentStage QUEUED', async () => {
    const repo = createMockRepo()
    repo.getUploadIntent = vi.fn().mockResolvedValue({ ok: true, data: makePendingIntent() })
    const bcRepo = createMockBcRepo()
    const storage = createMockStorage()
    storage.download = vi.fn().mockResolvedValue({ ok: true, data: CONTENT_BUFFER })
    const scanner = createMockScanner()
    const validator = createValidator()

    await completeUploadIntent(
      repo, bcRepo, storage, scanner, validator,
      { workspaceId: 'ws-1', businessId: 'biz-1', intentId: 'intent-1', storagePath: 'ws-1/biz-1/1000000-test.pdf' },
      makeCompletionConfig(),
    )

    expect(bcRepo.createContextSource).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'queued',
        currentStage: 'queued',
      }),
    )
  })
})
