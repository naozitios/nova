import { describe, it, expect } from 'vitest'
import {
  UploadIntentStatus,
  SourceType,
  DocumentClass,
  MalwareScanStatus,
  IdempotencyOperation,
  IdempotencyState,
  MetaConnectionStatus,
} from './remediation-entities'
import type {
  UploadIntent,
  IdempotencyRecord,
  MetaConnection,
  MetaOAuthState,
  MetaProviderCodeHash,
} from './remediation-entities'

describe('UploadIntentStatus enum', () => {
  it('has expected values', () => {
    expect(UploadIntentStatus.PENDING).toBe('pending')
    expect(UploadIntentStatus.SCANNING).toBe('scanning')
    expect(UploadIntentStatus.STORING).toBe('storing')
    expect(UploadIntentStatus.PROCESSING).toBe('processing')
    expect(UploadIntentStatus.COMPLETED).toBe('completed')
    expect(UploadIntentStatus.FAILED).toBe('failed')
    expect(UploadIntentStatus.EXPIRED).toBe('expired')
  })

  it('has 7 members', () => {
    expect(Object.keys(UploadIntentStatus)).toHaveLength(7)
  })
})

describe('SourceType remediation values', () => {
  it('includes upload, meta, manual, paste', () => {
    expect(SourceType.UPLOAD).toBe('upload')
    expect(SourceType.META).toBe('meta')
    expect(SourceType.MANUAL).toBe('manual')
    expect(SourceType.PASTE).toBe('paste')
  })
})

describe('DocumentClass enum', () => {
  it('has expected values', () => {
    expect(DocumentClass.BRAND_DECK).toBe('brand_deck')
    expect(DocumentClass.PRODUCT_DOCUMENT).toBe('product_document')
    expect(DocumentClass.RESEARCH_DOCUMENT).toBe('research_document')
    expect(DocumentClass.CAMPAIGN_BRIEF).toBe('campaign_brief')
    expect(DocumentClass.WEBSITE_CONTENT).toBe('website_content')
    expect(DocumentClass.OTHER).toBe('other')
  })
})

describe('MalwareScanStatus enum', () => {
  it('has expected values', () => {
    expect(MalwareScanStatus.PENDING).toBe('pending')
    expect(MalwareScanStatus.CLEAN).toBe('clean')
    expect(MalwareScanStatus.INFECTED).toBe('infected')
    expect(MalwareScanStatus.ERROR).toBe('error')
    expect(MalwareScanStatus.SKIPPED).toBe('skipped')
  })
})

describe('IdempotencyOperation enum', () => {
  it('has expected values', () => {
    expect(IdempotencyOperation.CREATE_UPLOAD_INTENT).toBe('create_upload_intent')
    expect(IdempotencyOperation.CHECK_IDEMPOTENCY).toBe('check_idempotency')
    expect(IdempotencyOperation.META_OAUTH_CALLBACK).toBe('meta_oauth_callback')
    expect(IdempotencyOperation.META_ACCOUNT_SELECT).toBe('meta_account_select')
  })
})

describe('IdempotencyState enum', () => {
  it('has expected values', () => {
    expect(IdempotencyState.PENDING).toBe('pending')
    expect(IdempotencyState.IN_PROGRESS).toBe('in_progress')
    expect(IdempotencyState.COMPLETED).toBe('completed')
    expect(IdempotencyState.FAILED).toBe('failed')
  })
})

describe('MetaConnectionStatus enum', () => {
  it('has expected values', () => {
    expect(MetaConnectionStatus.ACTIVE).toBe('active')
    expect(MetaConnectionStatus.EXPIRED).toBe('expired')
    expect(MetaConnectionStatus.REVOKED).toBe('revoked')
    expect(MetaConnectionStatus.PENDING_REAUTHORIZATION).toBe('pending_reauthorization')
  })
})

describe('UploadIntent type shape', () => {
  it('can be assigned a matching object', () => {
    const intent: UploadIntent = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      businessId: '550e8400-e29b-41d4-a716-446655440002',
      sourceId: null,
      sourceType: 'upload',
      sourceName: 'brand-deck.pdf',
      documentClass: 'brand_deck',
      classificationSource: 'user_declared',
      fileName: 'brand-deck.pdf',
      declaredMimeType: 'application/pdf',
      expectedSizeBytes: 2048000,
      storagePath: 'uploads/550e8400/brand-deck.pdf',
      createdBy: '550e8400-e29b-41d4-a716-446655440099',
      status: 'pending',
      malwareScanStatus: 'pending',
      malwareScanCode: null,
      malwareScannedAt: null,
      expiresAt: new Date('2026-08-15T00:00:00Z'),
      completedAt: null,
      createdAt: new Date('2026-07-15T12:00:00Z'),
    }

    expect(intent.id).toBeTruthy()
    expect(typeof intent.workspaceId).toBe('string')
    expect(typeof intent.expectedSizeBytes).toBe('number')
    expect(intent.expiresAt).toBeInstanceOf(Date)
  })
})

describe('IdempotencyRecord type shape', () => {
  it('can be assigned a matching object', () => {
    const record: IdempotencyRecord = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      operation: 'create_upload_intent',
      idempotencyKey: 'abc123',
      requestFingerprint: 'sha256-hash',
      state: 'completed',
      resourceType: 'upload_intent',
      resourceId: '550e8400-e29b-41d4-a716-446655440002',
      responseStatus: 201,
      responseBody: { ok: true },
      expiresAt: new Date('2026-07-22T12:00:00Z'),
      createdAt: new Date('2026-07-15T12:00:00Z'),
      completedAt: new Date('2026-07-15T12:00:01Z'),
    }

    expect(record.id).toBeTruthy()
    expect(typeof record.responseStatus).toBe('number')
    expect(record.responseBody).toEqual({ ok: true })
  })
})

describe('MetaConnection type shape', () => {
  it('can be assigned a matching object', () => {
    const conn: MetaConnection = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      connectedBy: '550e8400-e29b-41d4-a716-446655440099',
      metaUserId: 'meta-user-123',
      encryptedAccessToken: 'enc:v1:ciphertext',
      tokenExpiresAt: new Date('2026-07-16T12:00:00Z'),
      selectedAdAccountId: 'act_123456789',
      accountMetadata: { name: 'Account' },
      status: 'active',
      createdAt: new Date('2026-07-15T12:00:00Z'),
      updatedAt: new Date('2026-07-15T12:00:00Z'),
    }

    expect(conn.encryptedAccessToken).toBeTruthy()
    expect(conn.accountMetadata).toEqual({ name: 'Account' })
  })
})

describe('MetaOAuthState type shape', () => {
  it('can be assigned a matching object', () => {
    const state: MetaOAuthState = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      createdBy: '550e8400-e29b-41d4-a716-446655440099',
      stateNonceHash: 'sha256-nonce',
      returnPath: '/settings/meta',
      expiresAt: new Date('2026-07-15T13:00:00Z'),
      consumedAt: null,
      providerCodeHash: null,
      createdAt: new Date('2026-07-15T12:00:00Z'),
    }

    expect(state.stateNonceHash).toBeTruthy()
    expect(state.returnPath).toBe('/settings/meta')
  })
})

describe('MetaProviderCodeHash type shape', () => {
  it('can be assigned a matching object', () => {
    const hash: MetaProviderCodeHash = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      oauthStateId: '550e8400-e29b-41d4-a716-446655440001',
      providerCodeHash: 'sha256-code',
      createdAt: new Date('2026-07-15T12:05:00Z'),
    }

    expect(hash.oauthStateId).toBeTruthy()
    expect(hash.createdAt).toBeInstanceOf(Date)
  })
})
