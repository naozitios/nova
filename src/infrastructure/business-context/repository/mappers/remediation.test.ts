import { describe, it, expect } from 'vitest'
import type {
  UploadIntent,
  IdempotencyRecord,
  MetaConnection,
  MetaOAuthState,
  MetaProviderCodeHash,
} from '@/core/business-context/types/remediation-entities'
import {
  mapUploadIntent,
  unmapUploadIntent,
  mapIdempotencyRecord,
  unmapIdempotencyRecord,
  mapMetaConnection,
  unmapMetaConnection,
  mapMetaOAuthState,
  unmapMetaOAuthState,
  mapMetaProviderCodeHash,
} from './remediation'
import type { Row } from './helpers'

describe('mapUploadIntent', () => {
  const sampleRow: Row = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    workspace_id: '550e8400-e29b-41d4-a716-446655440001',
    business_id: '550e8400-e29b-41d4-a716-446655440002',
    source_id: null,
    source_type: 'upload',
    source_name: 'brand-deck.pdf',
    document_class: 'brand_deck',
    classification_source: 'user_declared',
    file_name: 'brand-deck.pdf',
    declared_mime_type: 'application/pdf',
    expected_size_bytes: 2048000,
    storage_path: 'uploads/550e8400/brand-deck.pdf',
    created_by: '550e8400-e29b-41d4-a716-446655440099',
    status: 'pending',
    malware_scan_status: 'pending',
    malware_scan_code: null,
    malware_scanned_at: null,
    expires_at: '2026-08-15T00:00:00Z',
    completed_at: null,
    created_at: '2026-07-15T12:00:00Z',
  }

  it('maps snake_case row to camelCase entity', () => {
    const entity = mapUploadIntent(sampleRow)

    expect(entity.id).toBe(sampleRow.id)
    expect(entity.workspaceId).toBe(sampleRow.workspace_id)
    expect(entity.businessId).toBe(sampleRow.business_id)
    expect(entity.sourceId).toBeNull()
    expect(entity.sourceType).toBe('upload')
    expect(entity.sourceName).toBe('brand-deck.pdf')
    expect(entity.documentClass).toBe('brand_deck')
    expect(entity.classificationSource).toBe('user_declared')
    expect(entity.fileName).toBe('brand-deck.pdf')
    expect(entity.declaredMimeType).toBe('application/pdf')
    expect(entity.expectedSizeBytes).toBe(2048000)
    expect(entity.storagePath).toBe('uploads/550e8400/brand-deck.pdf')
    expect(entity.createdBy).toBe(sampleRow.created_by)
    expect(entity.status).toBe('pending')
    expect(entity.malwareScanStatus).toBe('pending')
    expect(entity.malwareScanCode).toBeNull()
    expect(entity.malwareScannedAt).toBeNull()
    expect(entity.completedAt).toBeNull()
  })

  it('converts date strings to Date objects', () => {
    const entity = mapUploadIntent(sampleRow)

    expect(entity.expiresAt).toBeInstanceOf(Date)
    expect(entity.expiresAt.toISOString()).toBe('2026-08-15T00:00:00.000Z')
    expect(entity.createdAt).toBeInstanceOf(Date)
    expect(entity.createdAt.toISOString()).toBe('2026-07-15T12:00:00.000Z')
  })

  it('handles non-null optional fields', () => {
    const rowWithOptionals: Row = {
      ...sampleRow,
      source_id: '550e8400-e29b-41d4-a716-446655440005',
      malware_scan_code: 0,
      malware_scanned_at: '2026-07-15T12:01:00Z',
      completed_at: '2026-07-15T12:05:00Z',
    }

    const entity = mapUploadIntent(rowWithOptionals)

    expect(entity.sourceId).toBe('550e8400-e29b-41d4-a716-446655440005')
    expect(entity.malwareScanCode).toBe(0)
    expect(entity.malwareScannedAt).toBeInstanceOf(Date)
    expect(entity.completedAt).toBeInstanceOf(Date)
  })
})

describe('unmapUploadIntent', () => {
  const sampleEntity: UploadIntent = {
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

  it('maps camelCase entity to snake_case row', () => {
    const row = unmapUploadIntent(sampleEntity)

    expect(row.id).toBe(sampleEntity.id)
    expect(row.workspace_id).toBe(sampleEntity.workspaceId)
    expect(row.business_id).toBe(sampleEntity.businessId)
    expect(row.source_id).toBeNull()
    expect(row.source_type).toBe('upload')
    expect(row.source_name).toBe('brand-deck.pdf')
    expect(row.document_class).toBe('brand_deck')
    expect(row.classification_source).toBe('user_declared')
    expect(row.file_name).toBe('brand-deck.pdf')
    expect(row.declared_mime_type).toBe('application/pdf')
    expect(row.expected_size_bytes).toBe(2048000)
    expect(row.storage_path).toBe('uploads/550e8400/brand-deck.pdf')
    expect(row.created_by).toBe(sampleEntity.createdBy)
    expect(row.status).toBe('pending')
    expect(row.malware_scan_status).toBe('pending')
    expect(row.malware_scan_code).toBeNull()
    expect(row.malware_scanned_at).toBeNull()
    expect(row.completed_at).toBeNull()
  })

  it('converts Date objects to ISO strings', () => {
    const row = unmapUploadIntent(sampleEntity)

    expect(typeof row.expires_at).toBe('string')
    expect(row.expires_at).toBe('2026-08-15T00:00:00.000Z')
    expect(typeof row.created_at).toBe('string')
    expect(row.created_at).toBe('2026-07-15T12:00:00.000Z')
  })
})

describe('UploadIntent round-trip', () => {
  it('preserves data through map → unmap', () => {
    const original: UploadIntent = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      businessId: '550e8400-e29b-41d4-a716-446655440002',
      sourceId: '550e8400-e29b-41d4-a716-446655440005',
      sourceType: 'upload',
      sourceName: 'report.pdf',
      documentClass: 'research_document',
      classificationSource: 'auto_detected',
      fileName: 'report.pdf',
      declaredMimeType: 'application/pdf',
      expectedSizeBytes: 1024,
      storagePath: 'uploads/report.pdf',
      createdBy: '550e8400-e29b-41d4-a716-446655440099',
      status: 'completed',
      malwareScanStatus: 'clean',
      malwareScanCode: 0,
      malwareScannedAt: new Date('2026-07-15T12:01:00Z'),
      expiresAt: new Date('2026-08-15T00:00:00Z'),
      completedAt: new Date('2026-07-15T12:05:00Z'),
      createdAt: new Date('2026-07-15T12:00:00Z'),
    }

    const row = unmapUploadIntent(original)
    const restored = mapUploadIntent(row)

    expect(restored.id).toBe(original.id)
    expect(restored.workspaceId).toBe(original.workspaceId)
    expect(restored.businessId).toBe(original.businessId)
    expect(restored.sourceId).toBe(original.sourceId)
    expect(restored.sourceType).toBe(original.sourceType)
    expect(restored.sourceName).toBe(original.sourceName)
    expect(restored.documentClass).toBe(original.documentClass)
    expect(restored.classificationSource).toBe(original.classificationSource)
    expect(restored.fileName).toBe(original.fileName)
    expect(restored.declaredMimeType).toBe(original.declaredMimeType)
    expect(restored.expectedSizeBytes).toBe(original.expectedSizeBytes)
    expect(restored.storagePath).toBe(original.storagePath)
    expect(restored.createdBy).toBe(original.createdBy)
    expect(restored.status).toBe(original.status)
    expect(restored.malwareScanStatus).toBe(original.malwareScanStatus)
    expect(restored.malwareScanCode).toBe(original.malwareScanCode)
    expect(restored.malwareScannedAt?.toISOString()).toBe(original.malwareScannedAt?.toISOString())
    expect(restored.expiresAt.toISOString()).toBe(original.expiresAt.toISOString())
    expect(restored.completedAt?.toISOString()).toBe(original.completedAt?.toISOString())
    expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString())
  })
})

describe('mapIdempotencyRecord', () => {
  const sampleRow: Row = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    workspace_id: '550e8400-e29b-41d4-a716-446655440001',
    operation: 'create_upload_intent',
    idempotency_key: 'abc123-key',
    request_fingerprint: 'sha256-hash',
    state: 'completed',
    resource_type: 'upload_intent',
    resource_id: '550e8400-e29b-41d4-a716-446655440002',
    response_status: 201,
    response_body: { id: '550e8400-e29b-41d4-a716-446655440002' },
    expires_at: '2026-07-22T12:00:00Z',
    created_at: '2026-07-15T12:00:00Z',
    completed_at: '2026-07-15T12:00:01Z',
  }

  it('maps snake_case row to camelCase entity', () => {
    const entity = mapIdempotencyRecord(sampleRow)

    expect(entity.id).toBe(sampleRow.id)
    expect(entity.workspaceId).toBe(sampleRow.workspace_id)
    expect(entity.operation).toBe('create_upload_intent')
    expect(entity.idempotencyKey).toBe('abc123-key')
    expect(entity.requestFingerprint).toBe('sha256-hash')
    expect(entity.state).toBe('completed')
    expect(entity.resourceType).toBe('upload_intent')
    expect(entity.resourceId).toBe('550e8400-e29b-41d4-a716-446655440002')
    expect(entity.responseStatus).toBe(201)
    expect(entity.responseBody).toEqual({ id: '550e8400-e29b-41d4-a716-446655440002' })
  })

  it('converts date strings to Date objects', () => {
    const entity = mapIdempotencyRecord(sampleRow)

    expect(entity.expiresAt).toBeInstanceOf(Date)
    expect(entity.createdAt).toBeInstanceOf(Date)
    expect(entity.completedAt).toBeInstanceOf(Date)
  })

  it('handles null optional fields', () => {
    const rowWithNulls: Row = {
      ...sampleRow,
      resource_type: null,
      resource_id: null,
      response_status: null,
      response_body: null,
      completed_at: null,
    }

    const entity = mapIdempotencyRecord(rowWithNulls)

    expect(entity.resourceType).toBeNull()
    expect(entity.resourceId).toBeNull()
    expect(entity.responseStatus).toBeNull()
    expect(entity.responseBody).toBeNull()
    expect(entity.completedAt).toBeNull()
  })
})

describe('unmapIdempotencyRecord', () => {
  const sampleEntity: IdempotencyRecord = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    workspaceId: '550e8400-e29b-41d4-a716-446655440001',
    operation: 'create_upload_intent',
    idempotencyKey: 'abc123-key',
    requestFingerprint: 'sha256-hash',
    state: 'completed',
    resourceType: 'upload_intent',
    resourceId: '550e8400-e29b-41d4-a716-446655440002',
    responseStatus: 201,
    responseBody: { id: '550e8400-e29b-41d4-a716-446655440002' },
    expiresAt: new Date('2026-07-22T12:00:00Z'),
    createdAt: new Date('2026-07-15T12:00:00Z'),
    completedAt: new Date('2026-07-15T12:00:01Z'),
  }

  it('maps camelCase entity to snake_case row', () => {
    const row = unmapIdempotencyRecord(sampleEntity)

    expect(row.id).toBe(sampleEntity.id)
    expect(row.workspace_id).toBe(sampleEntity.workspaceId)
    expect(row.operation).toBe('create_upload_intent')
    expect(row.idempotency_key).toBe('abc123-key')
    expect(row.request_fingerprint).toBe('sha256-hash')
    expect(row.state).toBe('completed')
    expect(row.resource_type).toBe('upload_intent')
    expect(row.resource_id).toBe('550e8400-e29b-41d4-a716-446655440002')
    expect(row.response_status).toBe(201)
    expect(row.response_body).toEqual({ id: '550e8400-e29b-41d4-a716-446655440002' })
  })

  it('converts Date objects to ISO strings', () => {
    const row = unmapIdempotencyRecord(sampleEntity)

    expect(typeof row.expires_at).toBe('string')
    expect(typeof row.created_at).toBe('string')
    expect(typeof row.completed_at).toBe('string')
  })
})

describe('IdempotencyRecord round-trip', () => {
  it('preserves data through map → unmap', () => {
    const original: IdempotencyRecord = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      operation: 'meta_oauth_callback',
      idempotencyKey: 'xyz789',
      requestFingerprint: 'sha256-body',
      state: 'in_progress',
      resourceType: null,
      resourceId: null,
      responseStatus: null,
      responseBody: null,
      expiresAt: new Date('2026-07-22T12:00:00Z'),
      createdAt: new Date('2026-07-15T12:00:00Z'),
      completedAt: null,
    }

    const row = unmapIdempotencyRecord(original)
    const restored = mapIdempotencyRecord(row)

    expect(restored.id).toBe(original.id)
    expect(restored.workspaceId).toBe(original.workspaceId)
    expect(restored.operation).toBe(original.operation)
    expect(restored.idempotencyKey).toBe(original.idempotencyKey)
    expect(restored.requestFingerprint).toBe(original.requestFingerprint)
    expect(restored.state).toBe(original.state)
    expect(restored.resourceType).toBeNull()
    expect(restored.resourceId).toBeNull()
    expect(restored.responseStatus).toBeNull()
    expect(restored.responseBody).toBeNull()
    expect(restored.expiresAt.toISOString()).toBe(original.expiresAt.toISOString())
    expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString())
    expect(restored.completedAt).toBeNull()
  })
})

describe('mapMetaConnection', () => {
  const sampleRow: Row = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    workspace_id: '550e8400-e29b-41d4-a716-446655440001',
    connected_by: '550e8400-e29b-41d4-a716-446655440099',
    meta_user_id: 'meta-user-123',
    encrypted_access_token: 'enc:v1:ciphertext',
    token_expires_at: '2026-07-16T12:00:00Z',
    selected_ad_account_id: 'act_123456789',
    account_metadata: { name: 'My Account' },
    status: 'active',
    created_at: '2026-07-15T12:00:00Z',
    updated_at: '2026-07-15T12:00:00Z',
  }

  it('maps snake_case row to camelCase entity', () => {
    const entity = mapMetaConnection(sampleRow)

    expect(entity.id).toBe(sampleRow.id)
    expect(entity.workspaceId).toBe(sampleRow.workspace_id)
    expect(entity.connectedBy).toBe(sampleRow.connected_by)
    expect(entity.metaUserId).toBe('meta-user-123')
    expect(entity.encryptedAccessToken).toBe('enc:v1:ciphertext')
    expect(entity.selectedAdAccountId).toBe('act_123456789')
    expect(entity.accountMetadata).toEqual({ name: 'My Account' })
    expect(entity.status).toBe('active')
  })

  it('converts date strings to Date objects', () => {
    const entity = mapMetaConnection(sampleRow)

    expect(entity.tokenExpiresAt).toBeInstanceOf(Date)
    expect(entity.createdAt).toBeInstanceOf(Date)
    expect(entity.updatedAt).toBeInstanceOf(Date)
  })

  it('handles null optional fields', () => {
    const rowWithNulls: Row = {
      ...sampleRow,
      token_expires_at: null,
      selected_ad_account_id: null,
    }

    const entity = mapMetaConnection(rowWithNulls)

    expect(entity.tokenExpiresAt).toBeNull()
    expect(entity.selectedAdAccountId).toBeNull()
  })
})

describe('unmapMetaConnection', () => {
  const sampleEntity: MetaConnection = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    workspaceId: '550e8400-e29b-41d4-a716-446655440001',
    connectedBy: '550e8400-e29b-41d4-a716-446655440099',
    metaUserId: 'meta-user-123',
    encryptedAccessToken: 'enc:v1:ciphertext',
    tokenExpiresAt: new Date('2026-07-16T12:00:00Z'),
    selectedAdAccountId: 'act_123456789',
    accountMetadata: { name: 'My Account' },
    status: 'active',
    createdAt: new Date('2026-07-15T12:00:00Z'),
    updatedAt: new Date('2026-07-15T12:00:00Z'),
  }

  it('maps camelCase entity to snake_case row', () => {
    const row = unmapMetaConnection(sampleEntity)

    expect(row.id).toBe(sampleEntity.id)
    expect(row.workspace_id).toBe(sampleEntity.workspaceId)
    expect(row.connected_by).toBe(sampleEntity.connectedBy)
    expect(row.meta_user_id).toBe('meta-user-123')
    expect(row.encrypted_access_token).toBe('enc:v1:ciphertext')
    expect(row.selected_ad_account_id).toBe('act_123456789')
    expect(row.account_metadata).toEqual({ name: 'My Account' })
    expect(row.status).toBe('active')
  })

  it('converts Date objects to ISO strings', () => {
    const row = unmapMetaConnection(sampleEntity)

    expect(typeof row.token_expires_at).toBe('string')
    expect(typeof row.created_at).toBe('string')
    expect(typeof row.updated_at).toBe('string')
  })
})

describe('MetaConnection round-trip', () => {
  it('preserves data through map → unmap', () => {
    const original: MetaConnection = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      connectedBy: '550e8400-e29b-41d4-a716-446655440099',
      metaUserId: 'meta-user-123',
      encryptedAccessToken: 'enc:v1:ciphertext',
      tokenExpiresAt: new Date('2026-07-16T12:00:00Z'),
      selectedAdAccountId: 'act_123456789',
      accountMetadata: { name: 'My Account', id: '123' },
      status: 'active',
      createdAt: new Date('2026-07-15T12:00:00Z'),
      updatedAt: new Date('2026-07-15T12:00:00Z'),
    }

    const row = unmapMetaConnection(original)
    const restored = mapMetaConnection(row)

    expect(restored.id).toBe(original.id)
    expect(restored.workspaceId).toBe(original.workspaceId)
    expect(restored.connectedBy).toBe(original.connectedBy)
    expect(restored.metaUserId).toBe(original.metaUserId)
    expect(restored.encryptedAccessToken).toBe(original.encryptedAccessToken)
    expect(restored.tokenExpiresAt?.toISOString()).toBe(original.tokenExpiresAt?.toISOString())
    expect(restored.selectedAdAccountId).toBe(original.selectedAdAccountId)
    expect(restored.accountMetadata).toEqual(original.accountMetadata)
    expect(restored.status).toBe(original.status)
    expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString())
    expect(restored.updatedAt.toISOString()).toBe(original.updatedAt.toISOString())
  })
})

describe('mapMetaOAuthState', () => {
  const sampleRow: Row = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    workspace_id: '550e8400-e29b-41d4-a716-446655440001',
    created_by: '550e8400-e29b-41d4-a716-446655440099',
    state_nonce_hash: 'sha256-nonce',
    return_path: '/settings/meta',
    expires_at: '2026-07-15T13:00:00Z',
    consumed_at: null,
    provider_code_hash: null,
    created_at: '2026-07-15T12:00:00Z',
  }

  it('maps snake_case row to camelCase entity', () => {
    const entity = mapMetaOAuthState(sampleRow)

    expect(entity.id).toBe(sampleRow.id)
    expect(entity.workspaceId).toBe(sampleRow.workspace_id)
    expect(entity.createdBy).toBe(sampleRow.created_by)
    expect(entity.stateNonceHash).toBe('sha256-nonce')
    expect(entity.returnPath).toBe('/settings/meta')
    expect(entity.consumedAt).toBeNull()
    expect(entity.providerCodeHash).toBeNull()
  })

  it('converts date strings to Date objects', () => {
    const entity = mapMetaOAuthState(sampleRow)

    expect(entity.expiresAt).toBeInstanceOf(Date)
    expect(entity.createdAt).toBeInstanceOf(Date)
  })

  it('handles consumed state', () => {
    const consumedRow: Row = {
      ...sampleRow,
      consumed_at: '2026-07-15T12:05:00Z',
      provider_code_hash: 'sha256-code',
    }

    const entity = mapMetaOAuthState(consumedRow)

    expect(entity.consumedAt).toBeInstanceOf(Date)
    expect(entity.providerCodeHash).toBe('sha256-code')
  })
})

describe('unmapMetaOAuthState', () => {
  const sampleEntity: MetaOAuthState = {
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

  it('maps camelCase entity to snake_case row', () => {
    const row = unmapMetaOAuthState(sampleEntity)

    expect(row.id).toBe(sampleEntity.id)
    expect(row.workspace_id).toBe(sampleEntity.workspaceId)
    expect(row.created_by).toBe(sampleEntity.createdBy)
    expect(row.state_nonce_hash).toBe('sha256-nonce')
    expect(row.return_path).toBe('/settings/meta')
    expect(row.consumed_at).toBeNull()
    expect(row.provider_code_hash).toBeNull()
  })

  it('converts Date objects to ISO strings', () => {
    const row = unmapMetaOAuthState(sampleEntity)

    expect(typeof row.expires_at).toBe('string')
    expect(typeof row.created_at).toBe('string')
  })
})

describe('MetaOAuthState round-trip', () => {
  it('preserves data through map → unmap', () => {
    const original: MetaOAuthState = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      workspaceId: '550e8400-e29b-41d4-a716-446655440001',
      createdBy: '550e8400-e29b-41d4-a716-446655440099',
      stateNonceHash: 'sha256-nonce',
      returnPath: '/settings/meta',
      expiresAt: new Date('2026-07-15T13:00:00Z'),
      consumedAt: new Date('2026-07-15T12:05:00Z'),
      providerCodeHash: 'sha256-code',
      createdAt: new Date('2026-07-15T12:00:00Z'),
    }

    const row = unmapMetaOAuthState(original)
    const restored = mapMetaOAuthState(row)

    expect(restored.id).toBe(original.id)
    expect(restored.workspaceId).toBe(original.workspaceId)
    expect(restored.createdBy).toBe(original.createdBy)
    expect(restored.stateNonceHash).toBe(original.stateNonceHash)
    expect(restored.returnPath).toBe(original.returnPath)
    expect(restored.expiresAt.toISOString()).toBe(original.expiresAt.toISOString())
    expect(restored.consumedAt?.toISOString()).toBe(original.consumedAt?.toISOString())
    expect(restored.providerCodeHash).toBe(original.providerCodeHash)
    expect(restored.createdAt.toISOString()).toBe(original.createdAt.toISOString())
  })
})

describe('mapMetaProviderCodeHash', () => {
  const sampleRow: Row = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    oauth_state_id: '550e8400-e29b-41d4-a716-446655440001',
    provider_code_hash: 'sha256-code',
    created_at: '2026-07-15T12:05:00Z',
  }

  it('maps snake_case row to camelCase entity', () => {
    const entity = mapMetaProviderCodeHash(sampleRow)

    expect(entity.id).toBe(sampleRow.id)
    expect(entity.oauthStateId).toBe('550e8400-e29b-41d4-a716-446655440001')
    expect(entity.providerCodeHash).toBe('sha256-code')
  })

  it('converts date strings to Date objects', () => {
    const entity = mapMetaProviderCodeHash(sampleRow)

    expect(entity.createdAt).toBeInstanceOf(Date)
    expect(entity.createdAt.toISOString()).toBe('2026-07-15T12:05:00.000Z')
  })
})
