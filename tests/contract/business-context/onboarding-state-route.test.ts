import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Contract test: GET /api/businesses/[id]/onboarding/state
// Expects route to exist and return aggregated onboarding state.
// Will FAIL until route is implemented.
// ---------------------------------------------------------------------------

const routeMocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  requireAuthz: vi.fn(),
  getOnboardingState: vi.fn(),
  getSupabaseServiceClient: vi.fn(),
  SupabaseRepository: vi.fn(),
}))

vi.mock('../../../src/app/api/businesses/_shared', () => ({
  authenticateRequest: routeMocks.authenticateRequest,
  requireAuthz: routeMocks.requireAuthz,
  errorResponse: (status: number, code: string, message: string) =>
    Response.json({ error: { code, message } }, { status }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}))

vi.mock('../../../src/core/business-context/service', () => ({
  getOnboardingState: routeMocks.getOnboardingState,
}))

vi.mock('../../../src/infrastructure/business-context/supabase-client', () => ({
  getSupabaseServiceClient: routeMocks.getSupabaseServiceClient,
}))

vi.mock('../../../src/infrastructure/business-context/supabase.repository', () => ({
  SupabaseRepository: routeMocks.SupabaseRepository,
}))

// This import WILL FAIL until the route module exists — expected behavior.
import { GET } from '../../../src/app/api/businesses/[id]/onboarding/state/route'

const BUSINESS_ID = 'biz-1'
const WORKSPACE_ID = 'ws-1'

function request() {
  return new NextRequest(`http://localhost/api/businesses/${BUSINESS_ID}/onboarding/state`)
}

function businessClient(data: { workspace_id: string } | null, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return { from }
}

const FULL_STATE_RESPONSE = {
  business: { id: BUSINESS_ID, name: 'Acme Corp', status: 'active' },
  session: {
    id: 'os-1',
    businessId: BUSINESS_ID,
    status: 'created',
    currentStep: 'business-basics',
  },
  sources: [{ id: 'src-1', name: 'Website', type: 'website', status: 'complete' }],
  questions: [{ factKey: 'offers.pricing', question: 'What is pricing?', answer: null }],
  readiness: { canAdvance: true, blockers: [] },
  profile: { summary: 'Acme Corp is a SaaS company' },
  meta: { status: 'connected', connectionId: 'meta-1' },
  permissions: { canApprove: false, role: 'editor' },
}

describe('GET onboarding state route — contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeMocks.authenticateRequest.mockResolvedValue({ ok: true, userId: 'user-1' })
    routeMocks.requireAuthz.mockResolvedValue({ ok: true, ctx: { role: 'viewer' } })
    routeMocks.getSupabaseServiceClient.mockReturnValue(
      businessClient({ workspace_id: WORKSPACE_ID }),
    )
    routeMocks.SupabaseRepository.mockImplementation(function MockRepository() {
      return {}
    })
    routeMocks.getOnboardingState.mockResolvedValue({
      ok: true,
      data: FULL_STATE_RESPONSE,
    })
  })

  it('returns 401 before looking up business when unauthenticated', async () => {
    routeMocks.authenticateRequest.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 },
      ),
    })

    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(401)
    expect(routeMocks.getSupabaseServiceClient).not.toHaveBeenCalled()
  })

  it('returns 403 when viewer authorization fails', async () => {
    routeMocks.requireAuthz.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      ),
    })

    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(403)
    expect(routeMocks.requireAuthz).toHaveBeenCalledWith(
      expect.any(NextRequest),
      WORKSPACE_ID,
      'viewer',
      'user-1',
    )
  })

  it('returns 404 when business does not exist', async () => {
    routeMocks.getSupabaseServiceClient.mockReturnValue(businessClient(null, { code: 'PGRST116' }))

    const response = await GET(request(), { params: Promise.resolve({ id: 'missing' }) })

    expect(response.status).toBe(404)
    expect(routeMocks.requireAuthz).not.toHaveBeenCalled()
  })

  it('returns 200 with all required top-level keys', async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(200)
    const body = await response.json()

    expect(body).toHaveProperty('business')
    expect(body).toHaveProperty('session')
    expect(body).toHaveProperty('sources')
    expect(body).toHaveProperty('questions')
    expect(body).toHaveProperty('readiness')
    expect(body).toHaveProperty('profile')
    expect(body).toHaveProperty('meta')
    expect(body).toHaveProperty('permissions')
  })

  it('returns session: null when no session exists', async () => {
    routeMocks.getOnboardingState.mockResolvedValue({
      ok: true,
      data: {
        ...FULL_STATE_RESPONSE,
        session: null,
      },
    })

    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.session).toBeNull()
  })

  it('returns meta.status not_configured when Meta env is missing', async () => {
    routeMocks.getOnboardingState.mockResolvedValue({
      ok: true,
      data: {
        ...FULL_STATE_RESPONSE,
        meta: { status: 'not_configured' },
      },
    })

    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.meta.status).toBe('not_configured')
  })

  it('returns readiness.canAdvance as boolean', async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(typeof body.readiness.canAdvance).toBe('boolean')
    expect(Array.isArray(body.readiness.blockers)).toBe(true)
  })

  it('returns sources as array of objects with expected shape', async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body.sources)).toBe(true)
    if (body.sources.length > 0) {
      expect(body.sources[0]).toHaveProperty('id')
      expect(body.sources[0]).toHaveProperty('name')
      expect(body.sources[0]).toHaveProperty('status')
    }
  })

  it('returns permissions with canApprove and role', async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(typeof body.permissions.canApprove).toBe('boolean')
    expect(['viewer', 'editor', 'admin']).toContain(body.permissions.role)
  })

  it('returns canApprove=true and role=admin when authz role is admin', async () => {
    routeMocks.requireAuthz.mockResolvedValue({ ok: true, ctx: { role: 'admin' } })

    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.permissions.canApprove).toBe(true)
    expect(body.permissions.role).toBe('admin')
  })

  it('returns canApprove=true and role=owner when authz role is owner', async () => {
    routeMocks.requireAuthz.mockResolvedValue({ ok: true, ctx: { role: 'owner' } })

    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.permissions.canApprove).toBe(true)
    expect(body.permissions.role).toBe('owner')
  })

  it('returns canApprove=false and role=editor when authz role is editor', async () => {
    routeMocks.requireAuthz.mockResolvedValue({ ok: true, ctx: { role: 'editor' } })

    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.permissions.canApprove).toBe(false)
    expect(body.permissions.role).toBe('editor')
  })

  it('returns error on repository failure', async () => {
    routeMocks.getOnboardingState.mockResolvedValue({
      ok: false,
      error: { code: 'DB_ERROR', message: 'Connection failed' },
    })

    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBeGreaterThanOrEqual(400)
  })
})
