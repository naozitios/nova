import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fetchOnboardingReview, OnboardingApiError, createOnboardingReviewRequest } from './api'

const mockFetch = vi.fn()

beforeEach(() => {
  global.fetch = mockFetch
})

afterEach(() => {
  mockFetch.mockReset()
})

describe('fetchOnboardingReview', () => {
  it('returns mapped review on 200', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: { business: { name: 'Acme' } },
        unresolved_fields: ['offers.pricing'],
        warnings: ['Low confidence for offers.pricing'],
        sources: [
          { id: 'src-1', name: 'Website', type: 'website', status: 'processed' },
        ],
        questions: [
          { fact_key: 'offers.pricing', question: 'What pricing?', answer: null },
        ],
      }),
    })

    const review = await fetchOnboardingReview('biz-1')

    expect(review.profile).toEqual({ business: { name: 'Acme' } })
    expect(review.unresolvedFields).toEqual(['offers.pricing'])
    expect(review.warnings).toEqual(['Low confidence for offers.pricing'])
    expect(review.sources).toHaveLength(1)
    expect((review.sources[0] as Record<string, unknown>).factKey).toBeUndefined()
    expect(review.questions[0].factKey).toBe('offers.pricing')
  })

  it('throws OnboardingApiError on non-2xx', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ code: 'NO_SESSION' }),
    })

    await expect(fetchOnboardingReview('biz-1')).rejects.toThrow(OnboardingApiError)
    await expect(fetchOnboardingReview('biz-1')).rejects.toThrow('Failed to fetch onboarding review: 404')
  })

  it('throws OnboardingApiError with code from body', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ code: 'NO_SESSION' }),
    })

    try {
      await fetchOnboardingReview('biz-1')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(OnboardingApiError)
      const err = e as OnboardingApiError
      expect(err.status).toBe(404)
      expect(err.code).toBe('NO_SESSION')
    }
  })

  it('throws OnboardingApiError without code when body unparseable', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => { throw new Error('bad json') },
    })

    try {
      await fetchOnboardingReview('biz-1')
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(OnboardingApiError)
      expect((e as OnboardingApiError).code).toBeUndefined()
    }
  })

  it('passes signal to fetch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ profile: {}, unresolved_fields: [], warnings: [], sources: [], questions: [] }),
    })

    const controller = new AbortController()
    await fetchOnboardingReview('biz-1', controller.signal)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/businesses/biz-1/onboarding/review',
      expect.objectContaining({ signal: controller.signal }),
    )
  })

  it('returns empty defaults for missing fields', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })

    const review = await fetchOnboardingReview('biz-1')
    expect(review.profile).toEqual({})
    expect(review.unresolvedFields).toEqual([])
    expect(review.warnings).toEqual([])
    expect(review.sources).toEqual([])
    expect(review.questions).toEqual([])
  })
})

describe('createOnboardingReviewRequest', () => {
  it('returns { promise, abort } and passes signal to fetch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ profile: {}, unresolved_fields: [], warnings: [], sources: [], questions: [] }),
    })

    const req = createOnboardingReviewRequest('biz-1')

    expect(req).toHaveProperty('promise')
    expect(req).toHaveProperty('abort')
    expect(typeof req.abort).toBe('function')

    await req.promise

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/businesses/biz-1/onboarding/review',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
  })

  it('abort() aborts the fetch signal', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})) // never resolves

    const req = createOnboardingReviewRequest('biz-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/businesses/biz-1/onboarding/review',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )

    const fetchSignal = mockFetch.mock.calls[0][1].signal
    expect(fetchSignal.aborted).toBe(false)

    req.abort()

    expect(fetchSignal.aborted).toBe(true)
  })
})
