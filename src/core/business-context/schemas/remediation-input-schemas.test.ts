import { describe, it, expect } from 'vitest'
import {
  createUploadIntentInputSchema,
  idempotencyCheckInputSchema,
  metaOAuthCallbackInputSchema,
} from '../schemas/remediation'

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
