import { describe, it, expect } from 'vitest'
import {
  metaConnectionSchema,
  metaOAuthStateSchema,
  metaProviderCodeHashSchema,
} from '../schemas/remediation'

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
