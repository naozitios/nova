import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../../../src/app/api/businesses/[id]/context/uploads/classification-proposals/route'

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockCreateProposal = vi.fn()
const mockEncodeProposalToken = vi.fn()
const mockProposeDocumentClass = vi.fn()
vi.mock('@/core/business-context/upload-classification-proposal', () => ({
  createClassificationProposal: (...args: unknown[]) => mockCreateProposal(...args),
  encodeProposalToken: (...args: unknown[]) => mockEncodeProposalToken(...args),
  proposeDocumentClass: (...args: unknown[]) => mockProposeDocumentClass(...args),
}))

const mockGetSupabaseServiceClient = vi.fn()
vi.mock('@/infrastructure/business-context/supabase-client', () => ({
  getSupabaseServiceClient: () => mockGetSupabaseServiceClient(),
}))

vi.mock('../../../src/app/api/businesses/_shared', () => {
  const errorResponse = (status: number, code: string, message: string) =>
    Response.json({ error: { code, message } }, { status })
  const jsonResponse = (data: unknown, status = 200) =>
    Response.json(data, { status })
  return {
    requireAuthz: vi.fn(),
    jsonResponse,
    errorResponse,
    parseJsonBody: vi.fn(),
    validateWithSchema: vi.fn(),
  }
})

import {
  requireAuthz,
  parseJsonBody,
  validateWithSchema,
} from '../../../src/app/api/businesses/_shared'

// ── Constants ────────────────────────────────────────────────────────────────

const VALID_BODY = { source_name: 'test', file_name: 'doc.pdf', mime_type: 'application/pdf' }

const RAW_PROPOSAL = {
  proposalId: 'prop-1',
  signature: 'sig-abc123',
  documentClass: 'brand_deck' as const,
  expiresAt: 1700000000000,
  workspaceId: 'ws-1',
  businessId: 'biz-1',
  normalizedFilename: 'doc.pdf',
  mimeType: 'application/pdf',
  issuedAt: 1699999700000,
}

const ENCODED_TOKEN = Buffer.from(JSON.stringify(RAW_PROPOSAL)).toString('base64url')

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body?: unknown): NextRequest {
  const init: ConstructorParameters<typeof NextRequest>[1] = { method: 'POST' }
  if (body !== undefined) init.body = JSON.stringify(body)
  return new NextRequest(
    'http://localhost/api/businesses/biz-1/context/uploads/classification-proposals',
    init,
  )
}

function chainableResult(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  }
}

function setupEditorAuth() {
  mockGetSupabaseServiceClient.mockReturnValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'businesses')
        return chainableResult({ data: { workspace_id: 'ws-1' }, error: null })
      return chainableResult({ data: { role: 'editor' }, error: null })
    }),
  })
  vi.mocked(requireAuthz).mockResolvedValue({
    ok: true,
    ctx: { userId: 'user-1', workspaceId: 'ws-1', role: 'editor' },
  })
  vi.mocked(parseJsonBody).mockResolvedValue({ ok: true, data: VALID_BODY })
  vi.mocked(validateWithSchema).mockImplementation(
    (_schema: unknown, data: unknown) => ({
      ok: true as const,
      data: data as Record<string, unknown>,
    }),
  )
  mockCreateProposal.mockReturnValue(RAW_PROPOSAL)
  mockEncodeProposalToken.mockReturnValue(ENCODED_TOKEN)
  mockProposeDocumentClass.mockReturnValue('brand_deck')
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /classification-proposals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv('UPLOAD_SIGNING_SECRET', 'test-secret-key')
  })

  it('returns 403 when viewer attempts to create proposal', async () => {
    setupEditorAuth() // sets up supabase + parseJsonBody + validateWithSchema
    vi.mocked(requireAuthz).mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      ),
    })

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: 'biz-1' }),
    })

    expect(res.status).toBe(403)
    expect(mockCreateProposal).not.toHaveBeenCalled()
  })

  it('returns 200 with only proposal_token, document_class, expires_at', async () => {
    setupEditorAuth()

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: 'biz-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      proposal_token: ENCODED_TOKEN,
      document_class: 'brand_deck',
      expires_at: new Date(1700000000000).toISOString(),
    })
  })

  it('response has no secret/token credentials beyond signed proposal', async () => {
    setupEditorAuth()

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: 'biz-1' }),
    })
    const body = await res.json()

    expect(Object.keys(body).sort()).toEqual(['document_class', 'expires_at', 'proposal_token'])
    expect(body).not.toHaveProperty('signingSecret')
    expect(body).not.toHaveProperty('workspaceId')
    expect(body).not.toHaveProperty('businessId')
    expect(body).not.toHaveProperty('signature')
    expect(body).not.toHaveProperty('proposalId')
  })

  it('returns 503 UPLOAD_SIGNING_NOT_CONFIGURED when UPLOAD_SIGNING_SECRET is empty', async () => {
    setupEditorAuth()
    vi.stubEnv('UPLOAD_SIGNING_SECRET', '')

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: 'biz-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error.code).toBe('UPLOAD_SIGNING_NOT_CONFIGURED')
    expect(mockCreateProposal).not.toHaveBeenCalled()
  })

  it('returns 503 UPLOAD_SIGNING_NOT_CONFIGURED when UPLOAD_SIGNING_SECRET is undefined', async () => {
    setupEditorAuth()
    delete process.env.UPLOAD_SIGNING_SECRET

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: 'biz-1' }),
    })
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error.code).toBe('UPLOAD_SIGNING_NOT_CONFIGURED')
    expect(mockCreateProposal).not.toHaveBeenCalled()
  })

  it('returns 404 when business lookup fails', async () => {
    mockGetSupabaseServiceClient.mockReturnValue({
      from: vi.fn().mockImplementation(() =>
        chainableResult({ data: null, error: { message: 'not found' } }),
      ),
    })

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: 'nonexistent' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 400 when request body is invalid JSON', async () => {
    setupEditorAuth()
    vi.mocked(parseJsonBody).mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: { code: 'INVALID_BODY', message: 'Bad JSON' } },
        { status: 400 },
      ),
    })

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: 'biz-1' }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 400 when validation fails', async () => {
    setupEditorAuth()
    vi.mocked(validateWithSchema).mockReturnValue({
      ok: false,
      response: Response.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid data' } },
        { status: 400 },
      ),
    })

    const res = await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: 'biz-1' }),
    })

    expect(res.status).toBe(400)
  })

  it('passes signingSecret from env to createClassificationProposal', async () => {
    setupEditorAuth()
    vi.stubEnv('UPLOAD_SIGNING_SECRET', 'my-secret-key')

    await POST(makeRequest(VALID_BODY), {
      params: Promise.resolve({ id: 'biz-1' }),
    })

    expect(mockCreateProposal).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        businessId: 'biz-1',
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        documentClass: 'brand_deck',
      }),
      expect.objectContaining({ signingSecret: 'my-secret-key', ttlMs: 300_000 }),
    )
    expect(mockProposeDocumentClass).toHaveBeenCalledWith({
      sourceName: 'test',
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
    })
  })
})
