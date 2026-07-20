import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getOnboardingReview } from '../../../src/core/business-context/service/onboarding-review'
import { createMockRepo } from './_mock-repo'

const routeMocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  requireAuthz: vi.fn(),
  getOnboardingReview: vi.fn(),
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
  getOnboardingReview: routeMocks.getOnboardingReview,
}))

vi.mock('../../../src/infrastructure/business-context/supabase-client', () => ({
  getSupabaseServiceClient: routeMocks.getSupabaseServiceClient,
}))

vi.mock('../../../src/infrastructure/business-context/supabase.repository', () => ({
  SupabaseRepository: routeMocks.SupabaseRepository,
}))

import { GET } from '../../../src/app/api/businesses/[id]/onboarding/review/route'

const BUSINESS_ID = 'biz-1'
const WORKSPACE_ID = 'ws-1'

function request() {
  return new NextRequest(`http://localhost/api/businesses/${BUSINESS_ID}/onboarding/review`)
}

function businessClient(data: { workspace_id: string } | null, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ select })
  return { from }
}

describe('GET onboarding review route — contract', () => {
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
    routeMocks.getOnboardingReview.mockResolvedValue({
      ok: true,
      data: {
        profile: { business: { name: 'Acme' } },
        unresolvedFields: ['offers.pricing'],
        warnings: ['Needs review'],
        sources: [{ id: 'source-1', name: 'Website', type: 'website', status: 'processed' }],
        questions: [{ factKey: 'offers.pricing', question: 'What is pricing?', answer: null }],
      },
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

  it('returns snake-case review payload for authorized viewer', async () => {
    const response = await GET(request(), { params: Promise.resolve({ id: BUSINESS_ID }) })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      profile: { business: { name: 'Acme' } },
      unresolved_fields: ['offers.pricing'],
      warnings: ['Needs review'],
      sources: [{ id: 'source-1', name: 'Website', type: 'website', status: 'processed' }],
      questions: [{ fact_key: 'offers.pricing', question: 'What is pricing?', answer: null }],
    })
  })
})

describe('getOnboardingReview — contract', () => {
  it('returns review with profile, sources, and questions', async () => {
    const repo = createMockRepo()
    const result = await getOnboardingReview(repo, BUSINESS_ID, WORKSPACE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveProperty('profile')
      expect(result.data).toHaveProperty('unresolvedFields')
      expect(result.data).toHaveProperty('warnings')
      expect(result.data).toHaveProperty('sources')
      expect(result.data.sources.length).toBeGreaterThanOrEqual(1)
      expect(result.data.sources[0]).toHaveProperty('id')
      expect(result.data.sources[0]).toHaveProperty('name')
      expect(result.data.sources[0]).toHaveProperty('type')
      expect(result.data.sources[0]).toHaveProperty('status')
      expect(result.data).toHaveProperty('questions')
    }
  })

  it('returns NO_SESSION when no session exists', async () => {
    const repo = createMockRepo({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    })

    const result = await getOnboardingReview(repo, BUSINESS_ID, WORKSPACE_ID)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('NO_SESSION')
    }
  })

  it('returns error on repository failure', async () => {
    const repo = createMockRepo({
      listOnboardingSessions: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'DB_ERROR', message: 'Connection failed' },
      }),
    })

    const result = await getOnboardingReview(repo, BUSINESS_ID, WORKSPACE_ID)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DB_ERROR')
    }
  })

  it('returns only open questions, not answered or dismissed', async () => {
    const repo = createMockRepo({
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            {
              id: 'q-1',
              workspaceId: WORKSPACE_ID,
              sessionId: 'ses-1',
              businessId: BUSINESS_ID,
              factKey: 'open_field',
              questionType: 'text',
              question: 'What is this?',
              options: null,
              reason: 'Low confidence',
              priority: 1,
              status: 'open',
              answer: null,
              answeredBy: null,
              answeredAt: null,
            },
            {
              id: 'q-2',
              workspaceId: WORKSPACE_ID,
              sessionId: 'ses-1',
              businessId: BUSINESS_ID,
              factKey: 'answered_field',
              questionType: 'text',
              question: 'Already answered?',
              options: null,
              reason: 'User input',
              priority: 1,
              status: 'answered',
              answer: 'Yes',
              answeredBy: 'user-1',
              answeredAt: new Date(),
            },
          ],
          total: 2,
        },
      }),
    })

    const result = await getOnboardingReview(repo, BUSINESS_ID, WORKSPACE_ID)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.questions).toHaveLength(1)
      expect(result.data.questions[0].factKey).toBe('open_field')
    }
  })
})
