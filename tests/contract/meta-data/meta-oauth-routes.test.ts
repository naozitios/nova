import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

// ---------------------------------------------------------------------------
// Contract tests: Meta OAuth routes
// Behavioral tests for oauth-state, adapter, config, and route handlers.
// ---------------------------------------------------------------------------

const ROOT = resolve(import.meta.dirname, '../../..')
const START_FILE = 'src/app/api/meta/oauth/start/route.ts'
const CALLBACK_FILE = 'src/app/api/meta/oauth/callback/route.ts'
const ADAPTER_FILE = 'src/infrastructure/meta/meta-oauth.adapter.ts'
const CONNECTIONS_FILE = 'src/app/api/meta/connections/route.ts'

// ─── Shared mock references (hoisted to match vi.mock hoisting) ────────────

const {
  mockCreateOAuthState,
  mockConsumeOAuthState,
  mockUpsertConnection,
  mockDisconnectConnection,
  mockEncrypt,
  mockExchangeCode,
  mockFetchMetaUser,
  mockFetchMetaPermissions,
  mockRequireAuthz,
} = vi.hoisted(() => ({
  mockCreateOAuthState: vi.fn(),
  mockConsumeOAuthState: vi.fn(),
  mockUpsertConnection: vi.fn(),
  mockDisconnectConnection: vi.fn(),
  mockEncrypt: vi.fn().mockReturnValue('encrypted-token'),
  mockExchangeCode: vi.fn(),
  mockFetchMetaUser: vi.fn(),
  mockFetchMetaPermissions: vi.fn(),
  mockRequireAuthz: vi.fn(),
}))

// ─── Global module mocks ──────────────────────────────────────────────────

vi.mock('@/infrastructure/config', () => ({
  config: {
    meta: {
      appId: 'test-app-id',
      appSecret: 'test-app-secret',
      apiVersion: 'v22.0',
      redirectUri: 'http://localhost:3000/api/meta/oauth/callback',
      scopes: ['ads_management', 'ads_read', 'business_management'],
    },
  },
}))

vi.mock('@/di/container', () => ({
  Container: {
    getMetaRepository: () => ({
      createOAuthState: mockCreateOAuthState,
      consumeOAuthState: mockConsumeOAuthState,
      upsertConnection: mockUpsertConnection,
      disconnectConnection: mockDisconnectConnection,
    }),
    getMetaConnectionRepository: () => ({
      disconnectConnection: mockDisconnectConnection,
      getActiveConnection: vi.fn(),
    }),
    getMetaTokenVault: () => ({
      encrypt: mockEncrypt,
    }),
    getMetaOAuthAdapter: () => null,
  },
}))

vi.mock('@/infrastructure/meta/meta-oauth.adapter', () => {
  class MockMetaOAuthAdapter {
    getAuthorizationUrl(state: string) {
      return `https://www.facebook.com/v22.0/dialog/oauth?state=${state}`
    }
    exchangeCode(...args: unknown[]) {
      return mockExchangeCode(...(args as [string]))
    }
    fetchMetaUser(...args: unknown[]) {
      return mockFetchMetaUser(...(args as [string]))
    }
    fetchMetaPermissions(...args: unknown[]) {
      return mockFetchMetaPermissions(...(args as [string]))
    }
  }
  return { MetaOAuthAdapter: MockMetaOAuthAdapter }
})

vi.mock('@/app/api/businesses/_shared', () => ({
  requireAuthz: mockRequireAuthz,
  errorResponse: vi.fn(
    (status: number, code: string, message: string) =>
      new Response(JSON.stringify({ error: { code, message } }), { status }),
  ),
  createdResponse: vi.fn(
    (data: unknown) => new Response(JSON.stringify(data), { status: 201 }),
  ),
  jsonResponse: vi.fn(
    (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
  ),
  withIdempotency: vi.fn((_req: unknown, handler: () => Promise<Response>) => handler()),
}))

// ─── Route file existence ─────────────────────────────────────────────────

describe('Meta OAuth routes — file existence', () => {
  it('start route file exists', () => {
    expect(existsSync(resolve(ROOT, START_FILE))).toBe(true)
  })

  it('callback route file exists', () => {
    expect(existsSync(resolve(ROOT, CALLBACK_FILE))).toBe(true)
  })

  it('adapter file exists', () => {
    expect(existsSync(resolve(ROOT, ADAPTER_FILE))).toBe(true)
  })

  it('connections route file exists', () => {
    expect(existsSync(resolve(ROOT, CONNECTIONS_FILE))).toBe(true)
  })
})

// ─── OAuth state — encode / decode round-trip ─────────────────────────────

describe('OAuth state signing', () => {
  let encodeMetaOAuthState: typeof import('@/core/meta-data/oauth-state').encodeMetaOAuthState
  let decodeMetaOAuthState: typeof import('@/core/meta-data/oauth-state').decodeMetaOAuthState
  let hashMetaOAuthNonce: typeof import('@/core/meta-data/oauth-state').hashMetaOAuthNonce
  let verifyOAuthSignature: typeof import('@/core/meta-data/oauth-state').verifyOAuthSignature

  beforeEach(async () => {
    const mod = await import('@/core/meta-data/oauth-state')
    encodeMetaOAuthState = mod.encodeMetaOAuthState
    decodeMetaOAuthState = mod.decodeMetaOAuthState
    hashMetaOAuthNonce = mod.hashMetaOAuthNonce
    verifyOAuthSignature = mod.verifyOAuthSignature
  })

  it('encodes and decodes a valid state payload (round-trip)', () => {
    const payload = {
      stateId: 'state-abc-123',
      workspaceId: 'ws-001',
      userId: 'user-42',
      nonce: 'random-nonce-hex',
      returnPath: '/dashboard',
    }

    const encoded = encodeMetaOAuthState(payload)
    const decoded = decodeMetaOAuthState(encoded)

    expect(decoded).not.toBeNull()
    expect(decoded).toEqual(payload)
  })

  it('signed state contains a dot-separated signature', () => {
    const encoded = encodeMetaOAuthState({
      stateId: 's1',
      workspaceId: 'w1',
      userId: 'u1',
      nonce: 'n1',
      returnPath: '/r',
    })

    const dotCount = encoded.split('.').length - 1
    expect(dotCount).toBe(1)

    const [, signature] = encoded.split('.')
    expect(signature.length).toBeGreaterThan(0)
  })

  it('decodeMetaOAuthState returns null for tampered payload', () => {
    const encoded = encodeMetaOAuthState({
      stateId: 's1',
      workspaceId: 'w1',
      userId: 'u1',
      nonce: 'n1',
      returnPath: '/ok',
    })

    const [payloadB64] = encoded.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ stateId: 'HACKED', workspaceId: 'w1', userId: 'u1', nonce: 'n1', returnPath: '/ok' }),
    ).toString('base64url')
    const tampered = `${tamperedPayload}.${encoded.split('.')[1]}`

    const decoded = decodeMetaOAuthState(tampered)
    expect(decoded).toBeNull()
  })

  it('decodeMetaOAuthState returns null for completely invalid input', () => {
    expect(decodeMetaOAuthState('not-a-valid-state')).toBeNull()
    expect(decodeMetaOAuthState('')).toBeNull()
    expect(decodeMetaOAuthState('aGVsbG8')).toBeNull()
  })

  it('decodeMetaOAuthState returns null when required fields are missing', async () => {
    const { createHmac } = await import('node:crypto')
    const incomplete = { stateId: 's1', workspaceId: 'w1' }
    const json = JSON.stringify(incomplete)
    const b64 = Buffer.from(json).toString('base64url')

    // We need to sign it to pass signature check, but payload will fail schema
    const HMAC_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production'
    const sig = createHmac('sha256', HMAC_SECRET).update(b64).digest('base64url')
    const signed = `${b64}.${sig}`

    const decoded = decodeMetaOAuthState(signed)
    expect(decoded).toBeNull()
  })

  it('verifyOAuthSignature returns { valid: true } for valid signed payload', () => {
    const encoded = encodeMetaOAuthState({
      stateId: 's1',
      workspaceId: 'w1',
      userId: 'u1',
      nonce: 'n1',
      returnPath: '/ok',
    })

    const result = verifyOAuthSignature(encoded)
    expect(result).not.toBeNull()
    expect(result!.valid).toBe(true)
  })

  it('verifyOAuthSignature returns { valid: false } for tampered payload', () => {
    const encoded = encodeMetaOAuthState({
      stateId: 's1',
      workspaceId: 'w1',
      userId: 'u1',
      nonce: 'n1',
      returnPath: '/ok',
    })

    const [payloadB64, sig] = encoded.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ stateId: 'HACKED', workspaceId: 'w1', userId: 'u1', nonce: 'n1', returnPath: '/ok' }),
    ).toString('base64url')

    const result = verifyOAuthSignature(`${tamperedPayload}.${sig}`)
    expect(result).not.toBeNull()
    expect(result!.valid).toBe(false)
  })

  it('hashMetaOAuthNonce returns a consistent SHA-256 hex string', () => {
    const hash1 = hashMetaOAuthNonce('test-nonce')
    const hash2 = hashMetaOAuthNonce('test-nonce')

    expect(hash1).toBe(hash2)
    expect(hash1).toMatch(/^[0-9a-f]{64}$/)
  })

  it('hashMetaOAuthNonce produces different hashes for different inputs', () => {
    const h1 = hashMetaOAuthNonce('nonce-a')
    const h2 = hashMetaOAuthNonce('nonce-b')

    expect(h1).not.toBe(h2)
  })
})

// ─── MetaOAuthAdapter — behavioral tests ──────────────────────────────────

describe('MetaOAuthAdapter', () => {
  let realAdapter: InstanceType<typeof import('@/infrastructure/meta/meta-oauth.adapter').MetaOAuthAdapter>

  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn())
    const mod = await vi.importActual<typeof import('@/infrastructure/meta/meta-oauth.adapter')>('@/infrastructure/meta/meta-oauth.adapter')
    const RealAdapter = mod.MetaOAuthAdapter
    realAdapter = new RealAdapter()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthorizationUrl includes all required OAuth params', () => {
    const url = realAdapter.getAuthorizationUrl('test-state-payload')

    expect(url).toContain('facebook.com')
    expect(url).toContain('v22.0')
    expect(url).toContain('dialog/oauth')
    expect(url).toContain('client_id=test-app-id')
    expect(url).toContain('state=test-state-payload')
    expect(url).toContain('response_type=code')
    expect(url).toContain('scope=')
    expect(url).toContain('redirect_uri=')
  })

  it('getAuthorizationUrl uses configured redirect_uri', () => {
    const url = realAdapter.getAuthorizationUrl('s')
    expect(url).toContain(
      'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fmeta%2Foauth%2Fcallback',
    )
  })

  it('exchangeCode parses granted_scopes from token response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'mock-token',
        expires_in: 5184000,
        token_type: 'bearer',
        granted_scopes: 'ads_management,ads_read,business_management',
      }),
    } as Response)

    const result = await realAdapter.exchangeCode('auth-code-123')

    expect(result.accessToken).toBe('mock-token')
    expect(result.expiresIn).toBe(5184000)
    expect(result.tokenType).toBe('bearer')
    expect(result.grantedScopes).toEqual(['ads_management', 'ads_read', 'business_management'])

    // Verify it called the correct URL
    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('graph.facebook.com')
    expect(calledUrl).toContain('oauth/access_token')
    expect(calledUrl).toContain('code=auth-code-123')
    expect(calledUrl).toContain('client_id=test-app-id')
    expect(calledUrl).toContain('client_secret=test-app-secret')
  })

  it('exchangeCode returns undefined grantedScopes when response omits them', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'tok', expires_in: 3600 }),
    } as Response)

    const result = await realAdapter.exchangeCode('code')

    expect(result.grantedScopes).toBeUndefined()
  })

  it('exchangeCode throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Invalid code' } }),
      statusText: 'Bad Request',
    } as Response)

    await expect(realAdapter.exchangeCode('bad-code')).rejects.toThrow('Meta OAuth error: Invalid code')
  })

  it('fetchMetaUser calls correct URL and returns id + name', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: '123456789', name: 'Test User' }),
    } as Response)

    const result = await realAdapter.fetchMetaUser('my-token')

    expect(result.id).toBe('123456789')
    expect(result.name).toBe('Test User')

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('graph.facebook.com')
    expect(calledUrl).toContain('/me?fields=id,name')
    expect(calledUrl).toContain('access_token=my-token')
  })

  it('fetchMetaPermissions returns permissions array', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { permission: 'ads_management', status: 'granted' },
          { permission: 'ads_read', status: 'granted' },
        ],
      }),
    } as Response)

    const result = await realAdapter.fetchMetaPermissions('tok')

    expect(result).toHaveLength(2)
    expect(result[0].permission).toBe('ads_management')
    expect(result[0].status).toBe('granted')
  })

  it('refreshToken calls exchange endpoint with correct params', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-token' }),
    } as Response)

    const result = await realAdapter.refreshToken('old-token')

    expect(result).toBe('new-token')

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string
    expect(calledUrl).toContain('grant_type=fb_exchange_token')
    expect(calledUrl).toContain('fb_exchange_token=old-token')
  })
})

// ─── API version config ───────────────────────────────────────────────────

describe('Meta OAuth adapter — API version config', () => {
  it('apiVersion from config matches expected format (v{major}.{minor})', async () => {
    const { config } = await import('@/infrastructure/config')
    expect(config.meta.apiVersion).toMatch(/^v\d+\.\d+$/)
  })

  it('getAuthorizationUrl uses configured apiVersion in URL', async () => {
    const mod = await vi.importActual<typeof import('@/infrastructure/meta/meta-oauth.adapter')>('@/infrastructure/meta/meta-oauth.adapter')
    const adapter = new mod.MetaOAuthAdapter()
    const url = adapter.getAuthorizationUrl('s')

    const { config } = await import('@/infrastructure/config')
    expect(url).toContain(config.meta.apiVersion)
  })
})

// ─── Return path validation (callback route) ──────────────────────────────

describe('Return path validation in callback', () => {
  // Reimplements the validation logic from the callback route for isolated testing.
  // The route defines validateReturnPath internally; we test the same rules.
  const validate = (p: string): boolean => {
    if (!p || p.startsWith('//')) return false
    if (p.startsWith('http://') || p.startsWith('https://')) return false
    if (!p.startsWith('/')) return false
    return true
  }

  it('rejects protocol-relative URLs', () => {
    expect(validate('//evil.com')).toBe(false)
    expect(validate('//attacker.com/phish')).toBe(false)
  })

  it('rejects absolute URLs', () => {
    expect(validate('http://evil.com')).toBe(false)
    expect(validate('https://evil.com')).toBe(false)
  })

  it('rejects empty and relative paths', () => {
    expect(validate('')).toBe(false)
    expect(validate('relative/path')).toBe(false)
  })

  it('accepts valid relative paths', () => {
    expect(validate('/dashboard')).toBe(true)
    expect(validate('/settings')).toBe(true)
    expect(validate('/settings?tab=billing')).toBe(true)
    expect(validate('/')).toBe(true)
  })
})

// ─── POST /api/meta/oauth/start — route handler behavioral test ────────────

describe('POST /api/meta/oauth/start — handler behavior', () => {
  beforeEach(() => {
    mockRequireAuthz.mockReset()
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      ctx: { userId: 'user-42', role: 'editor' },
    })
    mockCreateOAuthState.mockReset()
  })

  it('returns 401 when requireAuthz fails', async () => {
    mockRequireAuthz.mockResolvedValueOnce({
      ok: false,
      response: new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }),
        { status: 403 },
      ),
    })

    const { POST } = await import('@/app/api/meta/oauth/start/route')
    const req = new Request('http://localhost:3000/api/meta/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: 'ws-1' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(403)
  })

  it('returns 400 when workspace_id is missing', async () => {
    const { POST } = await import('@/app/api/meta/oauth/start/route')
    const req = new Request('http://localhost:3000/api/meta/oauth/start', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 400 when body is invalid JSON', async () => {
    const { POST } = await import('@/app/api/meta/oauth/start/route')
    const req = new Request('http://localhost:3000/api/meta/oauth/start', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('creates OAuth state and returns authorization_url, state_id, expires_at', async () => {
    mockCreateOAuthState.mockResolvedValueOnce({
      ok: true,
      data: { id: 'state-123' },
    })

    const { POST } = await import('@/app/api/meta/oauth/start/route')
    const req = new Request('http://localhost:3000/api/meta/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: 'ws-1', return_path: '/dashboard' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(201)

    const body = await res.json()
    expect(body.authorization_url).toBeDefined()
    expect(body.authorization_url).toContain('facebook.com')
    expect(body.state_id).toBe('state-123')
    expect(body.expires_at).toBeDefined()

    // Verify state was created with correct params
    expect(mockCreateOAuthState).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        createdBy: 'user-42',
        returnPath: '/dashboard',
      }),
    )
  })

  it('encoded state in authorization_url is decodable', async () => {
    mockCreateOAuthState.mockResolvedValueOnce({
      ok: true,
      data: { id: 'state-xyz' },
    })

    const { POST } = await import('@/app/api/meta/oauth/start/route')
    const req = new Request('http://localhost:3000/api/meta/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: 'ws-1', return_path: '/settings' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req as any)
    const body = await res.json()

    // Extract the state param from the authorization URL
    const url = new URL(body.authorization_url)
    const stateParam = url.searchParams.get('state')
    expect(stateParam).toBeTruthy()

    // Decode it
    const { decodeMetaOAuthState } = await import('@/core/meta-data/oauth-state')
    const decoded = decodeMetaOAuthState(stateParam!)
    expect(decoded).not.toBeNull()
    expect(decoded!.workspaceId).toBe('ws-1')
    expect(decoded!.userId).toBe('user-42')
    expect(decoded!.returnPath).toBe('/settings')
  })

  it('returns 500 when state creation fails', async () => {
    mockCreateOAuthState.mockResolvedValueOnce({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Insert failed' },
    })

    const { POST } = await import('@/app/api/meta/oauth/start/route')
    const req = new Request('http://localhost:3000/api/meta/oauth/start', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: 'ws-1' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req as any)
    expect(res.status).toBe(500)
  })
})

// ─── GET /api/meta/oauth/callback — route handler behavioral test ──────────

describe('GET /api/meta/oauth/callback — handler behavior', () => {
  beforeEach(() => {
    mockConsumeOAuthState.mockReset()
    mockUpsertConnection.mockReset()
    mockEncrypt.mockReset()
    mockEncrypt.mockReturnValue('encrypted-token')
    mockExchangeCode.mockReset()
    mockExchangeCode.mockResolvedValue({
      accessToken: 'meta-access-token-abc',
      expiresIn: 5184000,
      grantedScopes: ['ads_management', 'ads_read'],
    })
    mockFetchMetaUser.mockReset()
    mockFetchMetaUser.mockResolvedValue({ id: 'meta-user-999', name: 'FB User' })
    mockFetchMetaPermissions.mockReset()
    mockFetchMetaPermissions.mockResolvedValue([])
  })

  it('redirects to error page when code or state are missing', async () => {
    const { GET } = await import('@/app/api/meta/oauth/callback/route')
    const req = new Request('http://localhost:3000/api/meta/oauth/callback', { method: 'GET' })

    const res = await GET(req as any)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=missing_params')
  })

  it('redirects to error when code is missing but state present', async () => {
    const { GET } = await import('@/app/api/meta/oauth/callback/route')
    const req = new Request(
      'http://localhost:3000/api/meta/oauth/callback?state=abc',
      { method: 'GET' },
    )

    const res = await GET(req as any)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=missing_params')
  })

  it('redirects to error when state is invalid/tampered', async () => {
    const { GET } = await import('@/app/api/meta/oauth/callback/route')
    const req = new Request(
      'http://localhost:3000/api/meta/oauth/callback?code=abc&state=tampered-state',
      { method: 'GET' },
    )

    const res = await GET(req as any)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=invalid_state')
  })

  it('redirects to safe return_path on success', async () => {
    const { encodeMetaOAuthState } = await import('@/core/meta-data/oauth-state')

    const statePayload = {
      stateId: 'state-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      nonce: 'nonce-abc',
      returnPath: '/dashboard',
    }
    const encodedState = encodeMetaOAuthState(statePayload)

    mockConsumeOAuthState.mockResolvedValueOnce({
      ok: true,
      data: { workspaceId: 'ws-1', createdBy: 'user-1' },
    })
    mockUpsertConnection.mockResolvedValueOnce({ ok: true, data: {} })

    const { GET } = await import('@/app/api/meta/oauth/callback/route')
    const req = new Request(
      `http://localhost:3000/api/meta/oauth/callback?code=auth-code&state=${encodeURIComponent(encodedState)}`,
      { method: 'GET' },
    )

    const res = await GET(req as any)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/dashboard')
  })

  it('callback stores metaUserId from /me endpoint (not NOVA userId)', async () => {
    const { encodeMetaOAuthState } = await import('@/core/meta-data/oauth-state')

    const statePayload = {
      stateId: 'state-2',
      workspaceId: 'ws-2',
      userId: 'nova-user-123',
      nonce: 'nonce-xyz',
      returnPath: '/settings',
    }
    const encodedState = encodeMetaOAuthState(statePayload)

    mockConsumeOAuthState.mockResolvedValueOnce({
      ok: true,
      data: { workspaceId: 'ws-2', createdBy: 'nova-user-123' },
    })
    mockUpsertConnection.mockResolvedValueOnce({ ok: true, data: {} })

    const { GET } = await import('@/app/api/meta/oauth/callback/route')
    const req = new Request(
      `http://localhost:3000/api/meta/oauth/callback?code=test-code&state=${encodeURIComponent(encodedState)}`,
      { method: 'GET' },
    )

    await GET(req as any)

    // upsertConnection should use metaUserId from /me (meta-user-999), not nova-user-123
    expect(mockUpsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        metaUserId: 'meta-user-999',
        connectedBy: 'nova-user-123',
      }),
    )
  })

  it('callback stores grantedScopes from token response', async () => {
    const { encodeMetaOAuthState } = await import('@/core/meta-data/oauth-state')

    const statePayload = {
      stateId: 'state-3',
      workspaceId: 'ws-3',
      userId: 'user-3',
      nonce: 'nonce-123',
      returnPath: '/settings',
    }
    const encodedState = encodeMetaOAuthState(statePayload)

    mockConsumeOAuthState.mockResolvedValueOnce({
      ok: true,
      data: { workspaceId: 'ws-3', createdBy: 'user-3' },
    })
    mockUpsertConnection.mockResolvedValueOnce({ ok: true, data: {} })

    const { GET } = await import('@/app/api/meta/oauth/callback/route')
    const req = new Request(
      `http://localhost:3000/api/meta/oauth/callback?code=code-456&state=${encodeURIComponent(encodedState)}`,
      { method: 'GET' },
    )

    await GET(req as any)

    expect(mockUpsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        grantedScopes: ['ads_management', 'ads_read'],
      }),
    )
  })

  it('callback stores encrypted token from token vault', async () => {
    const { encodeMetaOAuthState } = await import('@/core/meta-data/oauth-state')

    const statePayload = {
      stateId: 'state-3b',
      workspaceId: 'ws-3b',
      userId: 'user-3b',
      nonce: 'nonce-3b',
      returnPath: '/settings',
    }
    const encodedState = encodeMetaOAuthState(statePayload)

    mockConsumeOAuthState.mockResolvedValueOnce({
      ok: true,
      data: { workspaceId: 'ws-3b', createdBy: 'user-3b' },
    })
    mockUpsertConnection.mockResolvedValueOnce({ ok: true, data: {} })

    const { GET } = await import('@/app/api/meta/oauth/callback/route')
    const req = new Request(
      `http://localhost:3000/api/meta/oauth/callback?code=code-enc&state=${encodeURIComponent(encodedState)}`,
      { method: 'GET' },
    )

    await GET(req as any)

    // Token vault should have been called to encrypt the raw token
    expect(mockEncrypt).toHaveBeenCalledWith('meta-access-token-abc')

    // And the encrypted value should be stored
    expect(mockUpsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        encryptedAccessToken: 'encrypted-token',
      }),
    )
  })

  it('does NOT set meta_access_token or access_token cookies', async () => {
    const { encodeMetaOAuthState } = await import('@/core/meta-data/oauth-state')

    const statePayload = {
      stateId: 'state-4',
      workspaceId: 'ws-4',
      userId: 'user-4',
      nonce: 'nonce-456',
      returnPath: '/settings',
    }
    const encodedState = encodeMetaOAuthState(statePayload)

    mockConsumeOAuthState.mockResolvedValueOnce({
      ok: true,
      data: { workspaceId: 'ws-4', createdBy: 'user-4' },
    })
    mockUpsertConnection.mockResolvedValueOnce({ ok: true, data: {} })

    const { GET } = await import('@/app/api/meta/oauth/callback/route')
    const req = new Request(
      `http://localhost:3000/api/meta/oauth/callback?code=code-789&state=${encodeURIComponent(encodedState)}`,
      { method: 'GET' },
    )

    const res = await GET(req as any)
    const setCookieHeader = res.headers.get('set-cookie')

    // No cookies should be set at all for access tokens
    expect(setCookieHeader).toBeNull()
  })

  it('redirects to error when token exchange fails', async () => {
    const { encodeMetaOAuthState } = await import('@/core/meta-data/oauth-state')

    const statePayload = {
      stateId: 'state-5',
      workspaceId: 'ws-5',
      userId: 'user-5',
      nonce: 'nonce-789',
      returnPath: '/settings',
    }
    const encodedState = encodeMetaOAuthState(statePayload)

    mockConsumeOAuthState.mockResolvedValueOnce({
      ok: true,
      data: { workspaceId: 'ws-5', createdBy: 'user-5' },
    })

    // Override adapter to throw on exchangeCode
    mockExchangeCode.mockRejectedValueOnce(new Error('Token exchange failed'))

    const { GET } = await import('@/app/api/meta/oauth/callback/route')
    const req = new Request(
      `http://localhost:3000/api/meta/oauth/callback?code=bad-code&state=${encodeURIComponent(encodedState)}`,
      { method: 'GET' },
    )

    const res = await GET(req as any)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=token_exchange_failed')
  })

  it('redirects to error when /me fetch fails', async () => {
    const { encodeMetaOAuthState } = await import('@/core/meta-data/oauth-state')

    const statePayload = {
      stateId: 'state-6',
      workspaceId: 'ws-6',
      userId: 'user-6',
      nonce: 'nonce-000',
      returnPath: '/settings',
    }
    const encodedState = encodeMetaOAuthState(statePayload)

    mockConsumeOAuthState.mockResolvedValueOnce({
      ok: true,
      data: { workspaceId: 'ws-6', createdBy: 'user-6' },
    })
    mockFetchMetaUser.mockRejectedValueOnce(new Error('Meta user fetch error'))

    const { GET } = await import('@/app/api/meta/oauth/callback/route')
    const req = new Request(
      `http://localhost:3000/api/meta/oauth/callback?code=code-me&state=${encodeURIComponent(encodedState)}`,
      { method: 'GET' },
    )

    const res = await GET(req as any)
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('error=meta_user_fetch_failed')
  })
})

// ─── DELETE /api/meta/connections — route handler behavioral test ───────────

describe('DELETE /api/meta/connections — handler behavior', () => {
  beforeEach(() => {
    mockRequireAuthz.mockReset()
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      ctx: { userId: 'user-42', role: 'editor' },
    })
    mockDisconnectConnection.mockReset()
  })

  it('returns 400 when workspace_id query param is missing', async () => {
    const { DELETE } = await import('@/app/api/meta/connections/route')
    const req = new Request('http://localhost:3000/api/meta/connections', { method: 'DELETE' })
    const res = await DELETE(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 404 when no active connection exists', async () => {
    mockDisconnectConnection.mockResolvedValueOnce({ ok: true, data: null })

    const { DELETE } = await import('@/app/api/meta/connections/route')
    const req = new Request(
      'http://localhost:3000/api/meta/connections?workspace_id=ws-1',
      { method: 'DELETE' },
    )
    const res = await DELETE(req as any)
    expect(res.status).toBe(404)
  })

  it('returns disconnected connection data on success', async () => {
    const mockConn = {
      id: 'conn-1',
      workspaceId: 'ws-1',
      connectedBy: 'user-1',
      metaUserId: 'meta-1',
      tokenExpiresAt: new Date('2026-01-01'),
      selectedAdAccountId: 'act-123',
      status: 'disconnected',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-07-18'),
    }
    mockDisconnectConnection.mockResolvedValueOnce({ ok: true, data: mockConn })

    const { DELETE } = await import('@/app/api/meta/connections/route')
    const req = new Request(
      'http://localhost:3000/api/meta/connections?workspace_id=ws-1',
      { method: 'DELETE' },
    )
    const res = await DELETE(req as any)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.connected).toBe(false)
    expect(body.connection.meta_user_id).toBe('meta-1')
  })

  it('does NOT return encrypted_access_token in response', async () => {
    const mockConn = {
      id: 'conn-2',
      workspaceId: 'ws-2',
      connectedBy: 'user-2',
      metaUserId: 'meta-2',
      tokenExpiresAt: null,
      selectedAdAccountId: null,
      status: 'disconnected',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    mockDisconnectConnection.mockResolvedValueOnce({ ok: true, data: mockConn })

    const { DELETE } = await import('@/app/api/meta/connections/route')
    const req = new Request(
      'http://localhost:3000/api/meta/connections?workspace_id=ws-2',
      { method: 'DELETE' },
    )
    const res = await DELETE(req as any)
    const body = await res.json()

    expect(body.connection).not.toHaveProperty('encrypted_access_token')
  })

  it('returns 500 when disconnect fails', async () => {
    mockDisconnectConnection.mockResolvedValueOnce({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Delete failed' },
    })

    const { DELETE } = await import('@/app/api/meta/connections/route')
    const req = new Request(
      'http://localhost:3000/api/meta/connections?workspace_id=ws-3',
      { method: 'DELETE' },
    )
    const res = await DELETE(req as any)
    expect(res.status).toBe(500)
  })
})
