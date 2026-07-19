import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'

// Mock all dependencies
vi.mock('@/app/api/businesses/_shared', () => ({
  requireAuthz: vi.fn().mockResolvedValue({ ok: true }),
  parseJsonBody: vi.fn().mockResolvedValue({
    ok: true,
    data: { query: 'test query', purpose: 'campaign_setup', limit: 5 },
  }),
  validateWithSchema: vi.fn().mockImplementation((_schema, data) => ({
    ok: true,
    data,
  })),
  errorResponse: vi.fn().mockImplementation((status, code, message) => 
    new Response(JSON.stringify({ error: { code, message } }), { status })
  ),
  jsonResponse: vi.fn().mockImplementation((data, status) => 
    new Response(JSON.stringify(data), { status })
  ),
}))

vi.mock('@/infrastructure/business-context/supabase-client', () => ({
  getSupabaseServiceClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { workspace_id: 'ws-1' },
            error: null,
          }),
        }),
      }),
    }),
  })),
}))

vi.mock('@/infrastructure/business-context/supabase.repository', () => ({
  SupabaseRepository: vi.fn().mockImplementation(function () {
    return {
      getCurrentProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: { profile: { name: 'Test' } },
      }),
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [] },
      }),
    }
  }),
}))

vi.mock('@/infrastructure/business-context/retrieval.repository', () => ({
  RetrievalRepository: vi.fn().mockImplementation(function () {
    return {
      hybridSearch: vi.fn().mockResolvedValue({
        ok: true,
        data: [],
      }),
    }
  }),
}))

vi.mock('@/infrastructure/business-context/openai-embedding.adapter', () => ({
  OpenAIEmbeddingAdapter: vi.fn().mockImplementation(function () {
    return {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      embed: vi.fn().mockResolvedValue({
        ok: true,
        data: [Array(1536).fill(0.1)],
      }),
    }
  }),
}))

vi.mock('@/infrastructure/meta/supabase-meta.repository', () => ({
  SupabaseMetaRepository: vi.fn().mockImplementation(function () {
    return {
      listAdAccounts: vi.fn().mockResolvedValue({
        ok: true,
        data: [],
      }),
    }
  }),
}))

describe('POST /api/businesses/[id]/context/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.EMBEDDING_API_KEY = 'test-key'
  })

  it('returns 200 with retrieval result', async () => {
    const req = new NextRequest('http://localhost/api/businesses/biz-1/context/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'test', purpose: 'campaign_setup' }),
    })

    const response = await POST(req, { params: Promise.resolve({ id: 'biz-1' }) })

    expect(response.status).toBe(200)
  })

  it('returns 500 when EMBEDDING_API_KEY missing', async () => {
    delete process.env.EMBEDDING_API_KEY

    const req = new NextRequest('http://localhost/api/businesses/biz-1/context/search', {
      method: 'POST',
      body: JSON.stringify({ query: 'test', purpose: 'campaign_setup' }),
    })

    const response = await POST(req, { params: Promise.resolve({ id: 'biz-1' }) })

    expect(response.status).toBe(500)
  })
})
