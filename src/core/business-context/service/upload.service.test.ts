import { describe, expect, it, vi } from 'vitest'
import { createSignedUploadIntent, type UploadServiceConfig } from './upload.service'
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
    updateUploadIntentStatus: vi.fn().mockImplementation((_ws, _id, _status, _extra) =>
      Promise.resolve({ ok: true, data: makeIntent() }),
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
