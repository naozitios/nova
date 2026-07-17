import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Route handler tests: POST /api/businesses/[id]/context/uploads/[uploadId]/complete
// RED phase: must fail before production edit.
// ---------------------------------------------------------------------------

// ── mocks ──────────────────────────────────────────────────────────────────

const mockJsonResponse = vi.fn(
  (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status }),
)
const mockErrorResponse = vi.fn(
  (status: number, code: string, message: string) =>
    new Response(JSON.stringify({ error: { code, message } }), { status }),
)
const mockRequireAuthz = vi.fn()
const mockParseJsonBody = vi.fn()
const mockValidateWithSchema = vi.fn()

vi.mock(
  '../../../src/app/api/businesses/_shared',
  () => ({
    withIdempotency: vi.fn(
      (_req: unknown, handler: () => Promise<Response>) => handler(),
    ),
    requireAuthz: mockRequireAuthz,
    jsonResponse: mockJsonResponse,
    errorResponse: mockErrorResponse,
    parseJsonBody: mockParseJsonBody,
    validateWithSchema: mockValidateWithSchema,
  }),
)

const mockGetSupabaseServiceClient = vi.fn()
vi.mock(
  '../../../src/infrastructure/business-context/supabase-client',
  () => ({ getSupabaseServiceClient: mockGetSupabaseServiceClient }),
)

const mockCompleteUploadIntent = vi.fn()
vi.mock(
  '../../../src/core/business-context/service/upload.service',
  () => ({ completeUploadIntent: mockCompleteUploadIntent }),
)

// ── Container mocks ────────────────────────────────────────────────────────

const mockUploadRepo = { getUploadIntent: vi.fn() }
const mockBcRepo = { getContextSource: vi.fn() }
const mockStorage = { download: vi.fn() }
const mockScanner = { scan: vi.fn() }

vi.mock('../../../src/di/container', () => ({
  Container: {
    getUploadRepository: vi.fn(() => mockUploadRepo),
    getBusinessContextRepository: vi.fn(() => mockBcRepo),
    getUploadStorage: vi.fn(() => mockStorage),
    getMalwareScanner: vi.fn(() => mockScanner),
  },
}))

// ── helpers ────────────────────────────────────────────────────────────────

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/businesses/biz-1/context/uploads/intent-1/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

function makeParams(bizId = 'biz-1', uploadId = 'intent-1') {
  return { params: Promise.resolve({ id: bizId, uploadId }) }
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('POST /complete — route handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: resolveWorkspaceFromBusiness succeeds
    mockGetSupabaseServiceClient.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { workspace_id: 'ws-1' }, error: null }),
    })
  })

  it('returns 403 when viewer role (not editor)', async () => {
    mockRequireAuthz.mockResolvedValue({
      ok: false,
      response: mockErrorResponse(403, 'FORBIDDEN', 'editor role required'),
    })

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route'
    )
    const res = await POST(makeRequest({ storage_path: 'uploads/test.pdf' }), makeParams())

    expect(res.status).toBe(403)
    expect(mockRequireAuthz).toHaveBeenCalledWith(
      expect.any(NextRequest),
      'ws-1',
      'editor',
    )
  })

  it('returns 400 when storage_path is missing (schema validation)', async () => {
    mockRequireAuthz.mockResolvedValue({ ok: true })
    mockParseJsonBody.mockResolvedValue({ ok: true, data: {} })
    mockValidateWithSchema.mockReturnValue({
      ok: false,
      response: mockErrorResponse(400, 'VALIDATION_ERROR', 'storage_path required'),
    })

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route'
    )
    const res = await POST(makeRequest({}), makeParams())

    expect(res.status).toBe(400)
    expect(mockCompleteUploadIntent).not.toHaveBeenCalled()
  })

  it('returns 202 with valid editor and passes storage_path + checksum_sha256', async () => {
    mockRequireAuthz.mockResolvedValue({ ok: true })
    mockParseJsonBody.mockResolvedValue({
      ok: true,
      data: { storage_path: 'uploads/ws-1/biz-1/test.pdf', checksum_sha256: 'sha256-abc' },
    })
    mockValidateWithSchema.mockReturnValue({
      ok: true,
      data: { storage_path: 'uploads/ws-1/biz-1/test.pdf', checksum_sha256: 'sha256-abc' },
    })
    mockCompleteUploadIntent.mockResolvedValue({
      ok: true,
      data: {
        intent: {
          id: 'intent-1',
          documentClass: 'brand_deck',
          classificationSource: 'system_proposed',
          status: 'completed',
          malwareScanStatus: 'clean',
          malwareScanCode: 0,
          expiresAt: new Date('2026-01-01'),
        },
        source: {
          id: 'src-1',
          sourceType: 'upload',
          sourceName: 'test.pdf',
          status: 'registered',
          currentStage: 'queued',
          terminalOutcome: null,
          collectedAt: new Date('2026-01-01'),
        },
        document: { id: 'doc-1' },
        job: {
          id: 'job-1',
          businessId: 'biz-1',
          status: 'queued',
          attemptCount: 0,
          maxAttempts: 3,
          createdAt: new Date('2026-01-01'),
        },
      },
    })

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route'
    )
    const res = await POST(
      makeRequest({ storage_path: 'uploads/ws-1/biz-1/test.pdf', checksum_sha256: 'sha256-abc' }),
      makeParams(),
    )

    expect(res.status).toBe(202)
    expect(mockCompleteUploadIntent).toHaveBeenCalledWith(
      mockUploadRepo,
      mockBcRepo,
      mockStorage,
      mockScanner,
      expect.any(Function),
      {
        workspaceId: 'ws-1',
        businessId: 'biz-1',
        intentId: 'intent-1',
        storagePath: 'uploads/ws-1/biz-1/test.pdf',
        checksumSha256: 'sha256-abc',
      },
      expect.objectContaining({ storageBucket: expect.any(String) }),
    )
  })

  it('maps STORAGE_PATH_MISMATCH to 409', async () => {
    mockRequireAuthz.mockResolvedValue({ ok: true })
    mockParseJsonBody.mockResolvedValue({
      ok: true,
      data: { storage_path: 'wrong/path.pdf' },
    })
    mockValidateWithSchema.mockReturnValue({
      ok: true,
      data: { storage_path: 'wrong/path.pdf' },
    })
    mockCompleteUploadIntent.mockResolvedValue({
      ok: false,
      error: { code: 'STORAGE_PATH_MISMATCH', message: 'path mismatch' },
    })

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route'
    )
    const res = await POST(makeRequest({ storage_path: 'wrong/path.pdf' }), makeParams())

    expect(res.status).toBe(409)
  })

  it('maps CHECKSUM_MISMATCH to 409', async () => {
    mockRequireAuthz.mockResolvedValue({ ok: true })
    mockParseJsonBody.mockResolvedValue({
      ok: true,
      data: { storage_path: 'uploads/test.pdf' },
    })
    mockValidateWithSchema.mockReturnValue({
      ok: true,
      data: { storage_path: 'uploads/test.pdf' },
    })
    mockCompleteUploadIntent.mockResolvedValue({
      ok: false,
      error: { code: 'CHECKSUM_MISMATCH', message: 'checksum mismatch' },
    })

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route'
    )
    const res = await POST(makeRequest({ storage_path: 'uploads/test.pdf' }), makeParams())

    expect(res.status).toBe(409)
  })

  it('maps SOURCE_NOT_FOUND to 404', async () => {
    mockRequireAuthz.mockResolvedValue({ ok: true })
    mockParseJsonBody.mockResolvedValue({
      ok: true,
      data: { storage_path: 'uploads/test.pdf' },
    })
    mockValidateWithSchema.mockReturnValue({
      ok: true,
      data: { storage_path: 'uploads/test.pdf' },
    })
    mockCompleteUploadIntent.mockResolvedValue({
      ok: false,
      error: { code: 'SOURCE_NOT_FOUND', message: 'source missing' },
    })

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route'
    )
    const res = await POST(makeRequest({ storage_path: 'uploads/test.pdf' }), makeParams())

    expect(res.status).toBe(404)
  })

  it('uses Container getters for uploadRepo, bcRepo, storage, scanner', async () => {
    mockRequireAuthz.mockResolvedValue({ ok: true })
    mockParseJsonBody.mockResolvedValue({
      ok: true,
      data: { storage_path: 'uploads/test.pdf' },
    })
    mockValidateWithSchema.mockReturnValue({
      ok: true,
      data: { storage_path: 'uploads/test.pdf' },
    })
    mockCompleteUploadIntent.mockResolvedValue({
      ok: true,
      data: {
        intent: {
          id: 'intent-1',
          documentClass: 'brand_deck',
          classificationSource: 'system_proposed',
          status: 'completed',
          malwareScanStatus: 'clean',
          malwareScanCode: 0,
          expiresAt: new Date('2026-01-01'),
        },
        source: {
          id: 'src-1',
          sourceType: 'upload',
          sourceName: 'test.pdf',
          status: 'registered',
          currentStage: 'queued',
          terminalOutcome: null,
          collectedAt: new Date('2026-01-01'),
        },
        document: { id: 'doc-1' },
        job: null,
      },
    })

    const { Container } = await import('../../../src/di/container')

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route'
    )
    await POST(makeRequest({ storage_path: 'uploads/test.pdf' }), makeParams())

    expect(Container.getUploadRepository).toHaveBeenCalledOnce()
    expect(Container.getBusinessContextRepository).toHaveBeenCalledOnce()
    expect(Container.getUploadStorage).toHaveBeenCalledOnce()
    expect(Container.getMalwareScanner).toHaveBeenCalledOnce()
  })

  it('passes nullable checksum_sha256 as undefined when omitted', async () => {
    mockRequireAuthz.mockResolvedValue({ ok: true })
    mockParseJsonBody.mockResolvedValue({
      ok: true,
      data: { storage_path: 'uploads/test.pdf' },
    })
    mockValidateWithSchema.mockReturnValue({
      ok: true,
      data: { storage_path: 'uploads/test.pdf' },
    })
    mockCompleteUploadIntent.mockResolvedValue({
      ok: true,
      data: {
        intent: {
          id: 'intent-1',
          documentClass: 'brand_deck',
          classificationSource: 'system_proposed',
          status: 'completed',
          malwareScanStatus: 'clean',
          malwareScanCode: 0,
          expiresAt: new Date('2026-01-01'),
        },
        source: {
          id: 'src-1',
          sourceType: 'upload',
          sourceName: 'test.pdf',
          status: 'registered',
          currentStage: 'queued',
          terminalOutcome: null,
          collectedAt: new Date('2026-01-01'),
        },
        document: { id: 'doc-1' },
        job: null,
      },
    })

    const { POST } = await import(
      '../../../src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route'
    )
    await POST(makeRequest({ storage_path: 'uploads/test.pdf' }), makeParams())

    const callArgs = mockCompleteUploadIntent.mock.calls[0]
    expect(callArgs[5]).toHaveProperty('checksumSha256', undefined)
  })
})
