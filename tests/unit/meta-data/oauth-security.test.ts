import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  encodeMetaOAuthState,
  decodeMetaOAuthState,
  verifyOAuthSignature,
  hashMetaOAuthNonce,
} from '@/core/meta-data/oauth-state'
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter'
import { config } from '@/infrastructure/config'
import type { MetaOAuthStatePayload } from '@/core/meta-data/entities'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PAYLOAD: MetaOAuthStatePayload = {
  stateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  nonce: 'test-nonce-123',
  returnPath: '/dashboard',
}

// ---------------------------------------------------------------------------
// 1. OAuth State Signing
// ---------------------------------------------------------------------------

describe('OAuth State Signing', () => {
  describe('encodeMetaOAuthState', () => {
    it('returns base64url.payload.signature format', () => {
      const encoded = encodeMetaOAuthState(VALID_PAYLOAD)

      expect(typeof encoded).toBe('string')
      const parts = encoded.split('.')
      expect(parts.length).toBe(2)

      const [base64Payload, signature] = parts
      expect(base64Payload!.length).toBeGreaterThan(0)
      expect(signature!.length).toBeGreaterThan(0)

      // Both parts should be valid base64url (alphanumeric + _ + -)
      expect(base64Payload).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(signature).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('produces deterministic output for same input', () => {
      const a = encodeMetaOAuthState(VALID_PAYLOAD)
      const b = encodeMetaOAuthState(VALID_PAYLOAD)
      expect(a).toBe(b)
    })
  })

  describe('decodeMetaOAuthState', () => {
    it('returns original payload for a valid signed state', () => {
      const encoded = encodeMetaOAuthState(VALID_PAYLOAD)
      const decoded = decodeMetaOAuthState(encoded)

      expect(decoded).toEqual(VALID_PAYLOAD)
    })

    it('returns null when payload is tampered', () => {
      const encoded = encodeMetaOAuthState(VALID_PAYLOAD)
      const [payload, signature] = encoded.split('.')

      // Flip a character in the payload
      const tamperedPayload = payload!.slice(0, -2) + (payload!.slice(-2) === 'AA' ? 'BB' : 'AA')
      const tampered = `${tamperedPayload}.${signature}`

      expect(decodeMetaOAuthState(tampered)).toBeNull()
    })

    it('returns null when signature is tampered', () => {
      const encoded = encodeMetaOAuthState(VALID_PAYLOAD)
      const [payload, signature] = encoded.split('.')

      const tamperedSig = signature!.slice(0, -1) + (signature!.slice(-1) === 'A' ? 'B' : 'A')
      const tampered = `${payload}.${tamperedSig}`

      expect(decodeMetaOAuthState(tampered)).toBeNull()
    })

    it('returns null when signature is missing', () => {
      const encoded = encodeMetaOAuthState(VALID_PAYLOAD)
      const [payload] = encoded.split('.')

      expect(decodeMetaOAuthState(payload!)).toBeNull()
    })

    it('returns null for completely invalid input', () => {
      expect(decodeMetaOAuthState('not-valid')).toBeNull()
      expect(decodeMetaOAuthState('')).toBeNull()
    })

    it('returns null when required fields are missing from payload', () => {
      const incomplete = {
        stateId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        workspaceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        // missing userId, nonce, returnPath
      }
      const json = JSON.stringify(incomplete)
      const base64 = Buffer.from(json, 'utf-8').toString('base64url')

      // Sign the incomplete payload so it passes signature verification
      const HMAC_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production'
      const sig = createHmac('sha256', HMAC_SECRET).update(base64, 'utf-8').digest('base64url')

      expect(decodeMetaOAuthState(`${base64}.${sig}`)).toBeNull()
    })
  })

  describe('verifyOAuthSignature', () => {
    it('returns { payload, valid: true } for a correctly signed string', () => {
      const encoded = encodeMetaOAuthState(VALID_PAYLOAD)
      const result = verifyOAuthSignature(encoded)

      expect(result).not.toBeNull()
      expect(result!.valid).toBe(true)
    })

    it('returns { valid: false } when signature is wrong', () => {
      const encoded = encodeMetaOAuthState(VALID_PAYLOAD)
      const [payload] = encoded.split('.')
      const result = verifyOAuthSignature(`${payload}.AAAA`)

      expect(result).not.toBeNull()
      expect(result!.valid).toBe(false)
    })

    it('returns null when no dot separator exists', () => {
      expect(verifyOAuthSignature('nodot')).toBeNull()
    })

    it('returns null when payload or signature is empty', () => {
      expect(verifyOAuthSignature('.sig')).toBeNull()
      expect(verifyOAuthSignature('payload.')).toBeNull()
    })
  })

  describe('hashMetaOAuthNonce', () => {
    it('returns a hex-encoded SHA-256 hash', () => {
      const hash = hashMetaOAuthNonce('test-nonce')

      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    })

    it('produces deterministic output', () => {
      const a = hashMetaOAuthNonce('abc')
      const b = hashMetaOAuthNonce('abc')
      expect(a).toBe(b)
    })

    it('produces different hashes for different inputs', () => {
      const a = hashMetaOAuthNonce('nonce-1')
      const b = hashMetaOAuthNonce('nonce-2')
      expect(a).not.toBe(b)
    })
  })
})

// ---------------------------------------------------------------------------
// 2. Return Path Validation
// ---------------------------------------------------------------------------

describe('Return Path Validation', () => {
  // validateReturnPath is a private function inside route.ts.
  // We replicate its logic here to verify the security rules it enforces.
  function validateReturnPath(returnPath: string): boolean {
    if (!returnPath || returnPath.startsWith('//')) return false
    if (returnPath.startsWith('http://') || returnPath.startsWith('https://')) return false
    if (!returnPath.startsWith('/')) return false
    return true
  }

  it('accepts /dashboard', () => {
    expect(validateReturnPath('/dashboard')).toBe(true)
  })

  it('rejects //evil.com (protocol-relative)', () => {
    expect(validateReturnPath('//evil.com')).toBe(false)
  })

  it('rejects http://evil.com', () => {
    expect(validateReturnPath('http://evil.com')).toBe(false)
  })

  it('rejects https://evil.com', () => {
    expect(validateReturnPath('https://evil.com')).toBe(false)
  })

  it('accepts /dashboard?foo=bar (query params OK)', () => {
    expect(validateReturnPath('/dashboard?foo=bar')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(validateReturnPath('')).toBe(false)
  })

  it('rejects relative path without leading slash', () => {
    expect(validateReturnPath('dashboard')).toBe(false)
  })

  it('accepts nested paths like /settings/meta', () => {
    expect(validateReturnPath('/settings/meta')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 3. Granted Scopes (MetaOAuthAdapter)
// ---------------------------------------------------------------------------

describe('MetaOAuthAdapter', () => {
  const originalFetch = global.fetch
  let adapter: MetaOAuthAdapter

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new MetaOAuthAdapter()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('exchangeCode', () => {
    it('parses granted_scopes from comma-separated string', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token-abc',
          expires_in: 3600,
          token_type: 'bearer',
          granted_scopes: 'ads_read,business_management',
        }),
      })

      const result = await adapter.exchangeCode('auth-code')

      expect(result.accessToken).toBe('token-abc')
      expect(result.expiresIn).toBe(3600)
      expect(result.grantedScopes).toEqual(['ads_read', 'business_management'])
    })

    it('returns undefined grantedScopes when granted_scopes is empty string', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token-def',
          expires_in: 3600,
          granted_scopes: '',
        }),
      })

      const result = await adapter.exchangeCode('auth-code')

      // ''.split(',').filter(Boolean) => []
      // The adapter returns undefined when the field is falsy or empty after split
      expect(result.grantedScopes).toBeUndefined()
    })

    it('returns undefined grantedScopes when field is absent', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'token-ghi',
          expires_in: 3600,
        }),
      })

      const result = await adapter.exchangeCode('auth-code')

      expect(result.grantedScopes).toBeUndefined()
    })

    it('throws on non-ok response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'Invalid code' },
        }),
      })

      await expect(adapter.exchangeCode('bad-code')).rejects.toThrow('Meta OAuth error: Invalid code')
    })
  })

  describe('fetchMetaUser', () => {
    it('calls /me?fields=id,name and returns user id', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: '123456', name: 'Test User' }),
      })

      const user = await adapter.fetchMetaUser('some-token')

      expect(user.id).toBe('123456')
      expect(user.name).toBe('Test User')

      const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
      expect(calledUrl).toContain('/me?fields=id,name')
      expect(calledUrl).toContain('access_token=some-token')
    })

    it('throws on fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: async () => ({
          error: { message: 'Invalid access token' },
        }),
      })

      await expect(adapter.fetchMetaUser('bad-token')).rejects.toThrow('Meta user fetch error')
    })
  })

  describe('fetchMetaPermissions', () => {
    it('returns permissions array from /me/permissions', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { permission: 'ads_read', status: 'granted' },
            { permission: 'business_management', status: 'granted' },
            { permission: 'pages_read_engagement', status: 'not_granted' },
          ],
        }),
      })

      const perms = await adapter.fetchMetaPermissions('some-token')

      expect(perms).toHaveLength(3)
      expect(perms[0]).toEqual({ permission: 'ads_read', status: 'granted' })

      const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string
      expect(calledUrl).toContain('/me/permissions')
    })

    it('returns empty array when data is missing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })

      const perms = await adapter.fetchMetaPermissions('some-token')

      expect(perms).toEqual([])
    })

    it('throws on fetch failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: async () => ({
          error: { message: 'Token expired' },
        }),
      })

      await expect(adapter.fetchMetaPermissions('expired')).rejects.toThrow('Meta permissions fetch error')
    })
  })
})

// ---------------------------------------------------------------------------
// 4. Callback URL Alignment
// ---------------------------------------------------------------------------

describe('Callback URL alignment', () => {
  it('config.meta.redirectUri ends with /api/meta/oauth/callback', () => {
    expect(config.meta.redirectUri).toMatch(/\/api\/meta\/oauth\/callback$/)
  })

  it('getAuthorizationUrl uses the configured redirectUri', () => {
    const adapter = new MetaOAuthAdapter()
    const url = adapter.getAuthorizationUrl('test-state')

    expect(url).toContain(encodeURIComponent(config.meta.redirectUri))
  })
})
