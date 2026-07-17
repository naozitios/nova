import { describe, expect, it, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Contract test: POST /api/businesses/[id]/context/uploads — route wiring
// Asserts viewer 403, missing idempotency key 400, valid editor 201,
// source_type ≠ "upload" → 400, missing UPLOAD_SIGNING_SECRET → 503,
// and Container DI usage.
// ---------------------------------------------------------------------------

// --- mock helpers ---
const mockCreatedResponse = vi.fn(
  (data: unknown) => new Response(JSON.stringify(data), { status: 201 }),
)
const mockErrorResponse = vi.fn(
  (status: number, code: string, message: string) =>
    new Response(JSON.stringify({ error: { code, message } }), { status }),
)
const mockRequireAuthz = vi.fn()
const mockParseJsonBody = vi.fn()
const mockValidateWithSchema = vi.fn()

vi.mock('../../../src/app/api/businesses/_shared', () => ({
  withIdempotency: vi.fn(
    (req: unknown, handler: () => Promise<Response>) => {
      const key = (req as import('next/server').NextRequest).headers.get('idempotency-key')
      if (!key) {
        return Promise.resolve(
          new Response(
            JSON.stringify({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required' } }),
            { status: 400 },
          ),
        )
      }
      return handler()
    },
  ),
  parseJsonBody: mockParseJsonBody,
  validateWithSchema: mockValidateWithSchema,
  requireAuthz: mockRequireAuthz,
  createdResponse: mockCreatedResponse,
  errorResponse: mockErrorResponse,
}))

vi.mock('../../../src/infrastructure/business-context/supabase-client', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { workspace_id: 'ws-1' }, error: null }),
  }
  return {
    getSupabaseServiceClient: vi.fn(() => ({
      from: vi.fn(() => chain),
    })),
  }
})

vi.mock('../../../src/infrastructure/business-context/repository/upload.repository', () => ({
  UploadRepository: vi.fn(),
}))

vi.mock('../../../src/infrastructure/business-context/supabase-upload.storage', () => ({
  SupabaseUploadStorage: vi.fn(),
}))

const mockCreateSignedUploadIntent = vi.fn()
vi.mock('../../../src/core/business-context/service/upload.service', () => ({
  createSignedUploadIntent: mockCreateSignedUploadIntent,
}))

const mockCreateClassificationProposal = vi.fn()
vi.mock('../../../src/core/business-context/upload-classification-proposal', () => ({
  createClassificationProposal: mockCreateClassificationProposal,
}))

const mockGetUploadRepository = vi.fn()
const mockGetUploadStorage = vi.fn()
vi.mock('../../../src/di/container', () => ({
  Container: {
    getUploadRepository: mockGetUploadRepository,
    getUploadStorage: mockGetUploadStorage,
  },
}))

// --- request builder ---
function makePostRequest(
  body: Record<string, unknown>,
  opts?: { userId?: string; idempotencyKey?: string },
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (opts?.userId) headers['x-user-id'] = opts.userId
  if (opts?.idempotencyKey !== undefined) {
    headers['Idempotency-Key'] = opts.idempotencyKey
  }

  return new Request('http://localhost/api/businesses/biz-1/context/uploads', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }) as unknown as import('next/server').NextRequest
}

function validBody() {
  return {
    source_type: 'upload',
    source_name: 'deck.pdf',
    document_class: 'BRAND_DECK',
    file_name: 'deck.pdf',
    mime_type: 'application/pdf',
    size_bytes: 1024,
  }
}

const MOCK_REPO = { createUploadIntent: vi.fn() }
const MOCK_STORAGE = { getSignedUrl: vi.fn() }

describe('POST /api/businesses/[id]/context/uploads — route wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.UPLOAD_SIGNING_SECRET = 'test-signing-secret'
    mockGetUploadRepository.mockReturnValue(MOCK_REPO)
    mockGetUploadStorage.mockReturnValue(MOCK_STORAGE)
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      ctx: { userId: 'user-1', role: 'editor' },
    })
    mockParseJsonBody.mockImplementation(async (req: Request) => {
      try {
        const data = await req.json()
        return { ok: true as const, data }
      } catch {
        return {
          ok: false as const,
          response: new Response(
            JSON.stringify({ error: { code: 'INVALID_BODY', message: 'Invalid JSON' } }),
            { status: 400 },
          ),
        }
      }
    })
    mockValidateWithSchema.mockImplementation((_schema: unknown, data: unknown) => ({
      ok: true as const,
      data,
    }))
    mockCreateClassificationProposal.mockReturnValue({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      normalizedFilename: 'deck.pdf',
      mimeType: 'application/pdf',
      documentClass: 'BRAND_DECK',
      issuedAt: 1_000_000,
      expiresAt: 1_300_000,
      signature: 'aa'.repeat(32),
    })
    mockCreateSignedUploadIntent.mockResolvedValue({
      ok: true,
      data: {
        intent: {
          id: 'intent-1',
          documentClass: 'BRAND_DECK',
          classificationSource: 'system_proposed',
          expiresAt: new Date(1_300_000),
          status: 'pending',
          malwareScanStatus: 'pending',
          malwareScanCode: null,
        },
        signedUrl: 'https://signed.example.com/upload',
      },
    })
  })

  it('returns 403 when viewer role', async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }),
        { status: 403 },
      ),
    })

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/route'
    )
    const req = makePostRequest(validBody(), { userId: 'user-1', idempotencyKey: 'idem-1' })
    const res = await POST(req, { params: Promise.resolve({ id: 'biz-1' }) })

    expect(res.status).toBe(403)
    expect(mockCreateSignedUploadIntent).not.toHaveBeenCalled()
  })

  it('returns 400 when missing Idempotency-Key header', async () => {
    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/route'
    )
    // idempotencyKey: undefined → header not set
    const req = makePostRequest(validBody(), { userId: 'user-1' })
    const res = await POST(req, { params: Promise.resolve({ id: 'biz-1' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
    expect(mockCreateSignedUploadIntent).not.toHaveBeenCalled()
  })

  it('returns 201 with signed URL DTO for valid editor request', async () => {
    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/route'
    )
    const req = makePostRequest(validBody(), { userId: 'user-1', idempotencyKey: 'idem-1' })
    const res = await POST(req, { params: Promise.resolve({ id: 'biz-1' }) })

    expect(res.status).toBe(201)
    expect(mockCreatedResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'intent-1',
        document_class: 'BRAND_DECK',
        upload_url: 'https://signed.example.com/upload',
        status: 'pending',
        malware_scan_status: 'pending',
      }),
    )
  })

  it('returns 400 when source_type is not literal "upload"', async () => {
    mockValidateWithSchema.mockImplementation((_schema: unknown, data: Record<string, unknown>) => {
      if (data.source_type !== 'upload') {
        return {
          ok: false as const,
          response: new Response(
            JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: 'Invalid request data' } }),
            { status: 400 },
          ),
        }
      }
      return { ok: true as const, data }
    })

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/route'
    )
    const req = makePostRequest(
      { ...validBody(), source_type: 'web_crawl' },
      { userId: 'user-1', idempotencyKey: 'idem-1' },
    )
    const res = await POST(req, { params: Promise.resolve({ id: 'biz-1' }) })

    expect(res.status).toBe(400)
    expect(mockCreateSignedUploadIntent).not.toHaveBeenCalled()
  })

  it('returns 503 UPLOAD_SIGNING_NOT_CONFIGURED when UPLOAD_SIGNING_SECRET is missing', async () => {
    const orig = process.env.UPLOAD_SIGNING_SECRET
    delete process.env.UPLOAD_SIGNING_SECRET

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/route'
    )
    const req = makePostRequest(validBody(), { userId: 'user-1', idempotencyKey: 'idem-1' })
    const res = await POST(req, { params: Promise.resolve({ id: 'biz-1' }) })

    expect(res.status).toBe(503)
    expect(mockErrorResponse).toHaveBeenCalledWith(
      503,
      'UPLOAD_SIGNING_NOT_CONFIGURED',
      'Upload signing is not configured',
    )
    expect(mockCreateSignedUploadIntent).not.toHaveBeenCalled()

    if (orig !== undefined) process.env.UPLOAD_SIGNING_SECRET = orig
  })

  it('uses Container.getUploadRepository() and Container.getUploadStorage()', async () => {
    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/route'
    )
    const req = makePostRequest(validBody(), { userId: 'user-1', idempotencyKey: 'idem-1' })
    await POST(req, { params: Promise.resolve({ id: 'biz-1' }) })

    expect(mockGetUploadRepository).toHaveBeenCalled()
    expect(mockGetUploadStorage).toHaveBeenCalled()
    expect(mockCreateSignedUploadIntent).toHaveBeenCalledWith(
      MOCK_REPO,
      MOCK_STORAGE,
      expect.anything(),
      expect.anything(),
    )
  })
})
