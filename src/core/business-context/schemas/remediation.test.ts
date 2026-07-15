import { describe, it, expect } from 'vitest'
import {
  uploadIntentSchema,
  idempotencyRecordSchema,
  metaConnectionSchema,
  metaOAuthStateSchema,
  metaProviderCodeHashSchema,
  createUploadIntentInputSchema,
  idempotencyCheckInputSchema,
  metaOAuthCallbackInputSchema,
} from '../schemas/remediation'

describe('uploadIntentSchema', () => {
  const validUploadIntent = {
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
    expiresAt: '2026-08-15T00:00:00Z',
    completedAt: null,
    createdAt: '2026-07-15T12:00:00Z',
  }

  it('parses a valid UploadIntent', () => {
    const result = uploadIntentSchema.safeParse(validUploadIntent)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const incomplete = { id: '550e8400-e29b-41d4-a716-446655440000' }
    const result = uploadIntentSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects invalid UUID for id', () => {
    const result = uploadIntentSchema.safeParse({
      ...validUploadIntent,
      id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty sourceName', () => {
    const result = uploadIntentSchema.safeParse({
      ...validUploadIntent,
      sourceName: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid sourceType enum', () => {
    const result = uploadIntentSchema.safeParse({
      ...validUploadIntent,
      sourceType: 'invalid_type',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid documentClass enum', () => {
    const result = uploadIntentSchema.safeParse({
      ...validUploadIntent,
      documentClass: 'invalid_class',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative expectedSizeBytes', () => {
    const result = uploadIntentSchema.safeParse({
      ...validUploadIntent,
      expectedSizeBytes: -1,
    })
    expect(result.success).toBe(false)
  })

  it('accepts null for optional sourceId', () => {
    const result = uploadIntentSchema.safeParse({
      ...validUploadIntent,
      sourceId: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid sourceId UUID', () => {
    const result = uploadIntentSchema.safeParse({
      ...validUploadIntent,
      sourceId: '550e8400-e29b-41d4-a716-446655440005',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null for optional date fields', () => {
    const result = uploadIntentSchema.safeParse({
      ...validUploadIntent,
      completedAt: null,
      malwareScannedAt: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status enum', () => {
    const result = uploadIntentSchema.safeParse({
      ...validUploadIntent,
      status: 'invalid_status',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid malwareScanStatus enum', () => {
    const result = uploadIntentSchema.safeParse({
      ...validUploadIntent,
      malwareScanStatus: 'invalid_scan',
    })
    expect(result.success).toBe(false)
  })
})

describe('idempotencyRecordSchema', () => {
  const validRecord = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    workspaceId: '550e8400-e29b-41d4-a716-446655440001',
    operation: 'create_upload_intent',
    idempotencyKey: 'abc123-key',
    requestFingerprint: 'sha256-hash-of-body',
    state: 'completed',
    resourceType: 'upload_intent',
    resourceId: '550e8400-e29b-41d4-a716-446655440002',
    responseStatus: 201,
    responseBody: { id: '550e8400-e29b-41d4-a716-446655440002' },
    expiresAt: '2026-07-22T12:00:00Z',
    createdAt: '2026-07-15T12:00:00Z',
    completedAt: '2026-07-15T12:00:01Z',
  }

  it('parses a valid IdempotencyRecord', () => {
    const result = idempotencyRecordSchema.safeParse(validRecord)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const incomplete = { id: '550e8400-e29b-41d4-a716-446655440000' }
    const result = idempotencyRecordSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects empty idempotencyKey', () => {
    const result = idempotencyRecordSchema.safeParse({
      ...validRecord,
      idempotencyKey: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid operation enum', () => {
    const result = idempotencyRecordSchema.safeParse({
      ...validRecord,
      operation: 'invalid_op',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid state enum', () => {
    const result = idempotencyRecordSchema.safeParse({
      ...validRecord,
      state: 'invalid_state',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null for optional fields', () => {
    const result = idempotencyRecordSchema.safeParse({
      ...validRecord,
      resourceType: null,
      resourceId: null,
      responseStatus: null,
      responseBody: null,
      completedAt: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-integer responseStatus', () => {
    const result = idempotencyRecordSchema.safeParse({
      ...validRecord,
      responseStatus: 201.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('metaConnectionSchema', () => {
  const validConnection = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    workspaceId: '550e8400-e29b-41d4-a716-446655440001',
    connectedBy: '550e8400-e29b-41d4-a716-446655440099',
    metaUserId: 'meta-user-123',
    encryptedAccessToken: 'enc:v1:base64ciphertext',
    tokenExpiresAt: '2026-07-16T12:00:00Z',
    selectedAdAccountId: 'act_123456789',
    accountMetadata: { name: 'My Ad Account' },
    status: 'active',
    createdAt: '2026-07-15T12:00:00Z',
    updatedAt: '2026-07-15T12:00:00Z',
  }

  it('parses a valid MetaConnection', () => {
    const result = metaConnectionSchema.safeParse(validConnection)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const incomplete = { id: '550e8400-e29b-41d4-a716-446655440000' }
    const result = metaConnectionSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects empty encryptedAccessToken', () => {
    const result = metaConnectionSchema.safeParse({
      ...validConnection,
      encryptedAccessToken: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status enum', () => {
    const result = metaConnectionSchema.safeParse({
      ...validConnection,
      status: 'invalid_status',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null for optional token fields', () => {
    const result = metaConnectionSchema.safeParse({
      ...validConnection,
      tokenExpiresAt: null,
      selectedAdAccountId: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty accountMetadata', () => {
    const result = metaConnectionSchema.safeParse({
      ...validConnection,
      accountMetadata: {},
    })
    expect(result.success).toBe(true)
  })
})

describe('metaOAuthStateSchema', () => {
  const validState = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    workspaceId: '550e8400-e29b-41d4-a716-446655440001',
    createdBy: '550e8400-e29b-41d4-a716-446655440099',
    stateNonceHash: 'sha256-of-nonce',
    returnPath: '/settings/meta',
    expiresAt: '2026-07-15T13:00:00Z',
    consumedAt: null,
    providerCodeHash: null,
    createdAt: '2026-07-15T12:00:00Z',
  }

  it('parses a valid MetaOAuthState', () => {
    const result = metaOAuthStateSchema.safeParse(validState)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const incomplete = { id: '550e8400-e29b-41d4-a716-446655440000' }
    const result = metaOAuthStateSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects empty stateNonceHash', () => {
    const result = metaOAuthStateSchema.safeParse({
      ...validState,
      stateNonceHash: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty returnPath', () => {
    const result = metaOAuthStateSchema.safeParse({
      ...validState,
      returnPath: '',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null for optional consumed fields', () => {
    const result = metaOAuthStateSchema.safeParse({
      ...validState,
      consumedAt: null,
      providerCodeHash: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid consumed state', () => {
    const result = metaOAuthStateSchema.safeParse({
      ...validState,
      consumedAt: '2026-07-15T12:05:00Z',
      providerCodeHash: 'sha256-of-code',
    })
    expect(result.success).toBe(true)
  })
})

describe('metaProviderCodeHashSchema', () => {
  const validHash = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    oauthStateId: '550e8400-e29b-41d4-a716-446655440001',
    providerCodeHash: 'sha256-of-provider-code',
    createdAt: '2026-07-15T12:05:00Z',
  }

  it('parses a valid MetaProviderCodeHash', () => {
    const result = metaProviderCodeHashSchema.safeParse(validHash)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const incomplete = { id: '550e8400-e29b-41d4-a716-446655440000' }
    const result = metaProviderCodeHashSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects empty providerCodeHash', () => {
    const result = metaProviderCodeHashSchema.safeParse({
      ...validHash,
      providerCodeHash: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('createUploadIntentInputSchema', () => {
  const validInput = {
    workspaceId: '550e8400-e29b-41d4-a716-446655440001',
    businessId: '550e8400-e29b-41d4-a716-446655440002',
    sourceName: 'brand-deck.pdf',
    documentClass: 'brand_deck',
    declaredMimeType: 'application/pdf',
    expectedSizeBytes: 2048000,
    fileName: 'brand-deck.pdf',
  }

  it('parses a valid input', () => {
    const result = createUploadIntentInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const incomplete = { sourceName: 'file.pdf' }
    const result = createUploadIntentInputSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects empty sourceName', () => {
    const result = createUploadIntentInputSchema.safeParse({
      ...validInput,
      sourceName: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid documentClass enum', () => {
    const result = createUploadIntentInputSchema.safeParse({
      ...validInput,
      documentClass: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative expectedSizeBytes', () => {
    const result = createUploadIntentInputSchema.safeParse({
      ...validInput,
      expectedSizeBytes: -1,
    })
    expect(result.success).toBe(false)
  })
})

describe('idempotencyCheckInputSchema', () => {
  const validInput = {
    workspaceId: '550e8400-e29b-41d4-a716-446655440001',
    operation: 'create_upload_intent',
    idempotencyKey: 'abc123-key',
    requestFingerprint: 'sha256-hash',
  }

  it('parses a valid input', () => {
    const result = idempotencyCheckInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const incomplete = { idempotencyKey: 'key' }
    const result = idempotencyCheckInputSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects empty idempotencyKey', () => {
    const result = idempotencyCheckInputSchema.safeParse({
      ...validInput,
      idempotencyKey: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid operation enum', () => {
    const result = idempotencyCheckInputSchema.safeParse({
      ...validInput,
      operation: 'invalid',
    })
    expect(result.success).toBe(false)
  })
})

describe('metaOAuthCallbackInputSchema', () => {
  const validInput = {
    workspaceId: '550e8400-e29b-41d4-a716-446655440001',
    state: 'some-state-nonce',
    code: 'auth-code-from-meta',
  }

  it('parses a valid input', () => {
    const result = metaOAuthCallbackInputSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const incomplete = { state: 'nonce' }
    const result = metaOAuthCallbackInputSchema.safeParse(incomplete)
    expect(result.success).toBe(false)
  })

  it('rejects empty state', () => {
    const result = metaOAuthCallbackInputSchema.safeParse({
      ...validInput,
      state: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty code', () => {
    const result = metaOAuthCallbackInputSchema.safeParse({
      ...validInput,
      code: '',
    })
    expect(result.success).toBe(false)
  })
})
