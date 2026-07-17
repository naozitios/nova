import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuthz: vi.fn(),
  getVersion: vi.fn(),
  compareVersions: vi.fn(),
  repo: {},
}))

vi.mock('@/app/api/businesses/_shared', () => ({
  requireAuthz: mocks.requireAuthz,
  errorResponse: (status: number, code: string, message: string) =>
    Response.json({ error: { code, message } }, { status }),
  jsonResponse: (data: unknown, status = 200) => Response.json(data, { status }),
}))

vi.mock('@/infrastructure/business-context/supabase-client', () => ({
  getSupabaseServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { workspace_id: 'ws-1' }, error: null }),
        }),
      }),
    }),
  }),
}))

vi.mock('@/infrastructure/business-context/supabase.repository', () => ({
  SupabaseRepository: class {
    constructor() {
      return mocks.repo
    }
  },
}))

vi.mock('@/core/business-context/service', () => ({
  getVersion: mocks.getVersion,
  compareVersions: mocks.compareVersions,
}))

const version = {
  id: '11111111-1111-4111-8111-111111111111',
  workspaceId: 'ws-1',
  businessId: 'biz-1',
  version: 2,
  profile: { business: { name: 'Acme' } },
  profileMarkdown: null,
  status: 'current',
  changeSummary: 'Updated name',
  createdBy: 'user-1',
  createdAt: new Date('2026-07-17T00:00:00Z'),
  approvedBy: 'user-2',
  approvedAt: new Date('2026-07-17T00:01:00Z'),
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthz.mockResolvedValue({
    ok: true,
    ctx: { userId: 'viewer-1', workspaceId: 'ws-1', role: 'viewer' },
  })
})

describe('GET version detail route', () => {
  it('allows viewer and returns Profile contract', async () => {
    mocks.getVersion.mockResolvedValue({ ok: true, data: version })
    const { GET } = await import(
      '../../../src/app/api/businesses/[id]/context/versions/[versionId]/route'
    )

    const response = await GET(
      new NextRequest('http://localhost/api/businesses/biz-1/context/versions/11111111-1111-4111-8111-111111111111'),
      { params: Promise.resolve({ id: 'biz-1', versionId: version.id }) },
    )

    expect(response.status).toBe(200)
    expect(mocks.requireAuthz).toHaveBeenCalledWith(expect.any(NextRequest), 'ws-1', 'viewer')
    expect(await response.json()).toEqual({
      id: version.id,
      version: 2,
      status: 'current',
      profile: version.profile,
      base_version_id: null,
      approved_by: 'user-2',
      approved_at: '2026-07-17T00:01:00.000Z',
      updated_at: '2026-07-17T00:00:00.000Z',
      change_summary: 'Updated name',
      draft_change_count: 0,
      section_readiness: [],
    })
  })

  it('returns 404 for missing or cross-business version', async () => {
    mocks.getVersion.mockResolvedValue({ ok: true, data: null })
    const { GET } = await import(
      '../../../src/app/api/businesses/[id]/context/versions/[versionId]/route'
    )

    const response = await GET(
      new NextRequest('http://localhost/api/businesses/biz-1/context/versions/missing'),
      { params: Promise.resolve({ id: 'biz-1', versionId: 'missing' }) },
    )

    expect(response.status).toBe(404)
  })
})

describe('GET version comparison route', () => {
  it('validates from and to query parameters', async () => {
    const { GET } = await import(
      '../../../src/app/api/businesses/[id]/context/versions/compare/route'
    )
    const response = await GET(
      new NextRequest('http://localhost/api/businesses/biz-1/context/versions/compare?from=one'),
      { params: Promise.resolve({ id: 'biz-1' }) },
    )

    expect(response.status).toBe(400)
    expect(mocks.compareVersions).not.toHaveBeenCalled()
  })

  it('rejects non-UUID version query parameters', async () => {
    const { GET } = await import(
      '../../../src/app/api/businesses/[id]/context/versions/compare/route'
    )
    const response = await GET(
      new NextRequest('http://localhost/api/businesses/biz-1/context/versions/compare?from=one&to=two'),
      { params: Promise.resolve({ id: 'biz-1' }) },
    )

    expect(response.status).toBe(400)
    expect(mocks.compareVersions).not.toHaveBeenCalled()
  })

  it('returns attributed ProfileDiff values and immutable version IDs', async () => {
    mocks.compareVersions.mockResolvedValue({
      ok: true,
      data: {
        fromVersionId: '11111111-1111-4111-8111-111111111111',
        toVersionId: '22222222-2222-4222-8222-222222222222',
        fromVersion: 1,
        toVersion: 2,
        diffs: { business: { before: { name: 'Old' }, after: { name: 'New' } } },
      },
    })
    const { GET } = await import(
      '../../../src/app/api/businesses/[id]/context/versions/compare/route'
    )
    const response = await GET(
      new NextRequest(
        'http://localhost/api/businesses/biz-1/context/versions/compare?from=11111111-1111-4111-8111-111111111111&to=22222222-2222-4222-8222-222222222222',
      ),
      { params: Promise.resolve({ id: 'biz-1' }) },
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      base_version_id: '11111111-1111-4111-8111-111111111111',
      draft_version_id: '22222222-2222-4222-8222-222222222222',
      changes: [{
        section: 'business',
        fact_key: 'business.name',
        previous_value: 'Old',
        proposed_value: 'New',
        source_id: null,
        source_name: null,
        reason: 'Profile field changed between immutable versions',
      }],
    })
  })
})
