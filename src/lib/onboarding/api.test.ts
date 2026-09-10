import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  compileOnboardingDraft,
  completeOnboardingUpload,
  createOnboardingUploadIntent,
  createOnboardingReviewRequest,
  fetchOnboardingReview,
  OnboardingApiError,
  queueOnboardingScan,
  registerOnboardingSource,
  startOnboardingSession,
  submitOnboardingAnswers,
} from './api'

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

describe('registerOnboardingSource', () => {
  it('posts source details to the backend and maps the created source', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'src-1',
        source_type: 'website',
        source_name: 'https://example.com',
        external_reference: 'https://example.com',
        status: 'registered',
        current_stage: null,
      }),
    })

    const source = await registerOnboardingSource('biz-1', {
      sourceType: 'website',
      sourceName: 'https://example.com',
      externalReference: 'https://example.com',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/businesses/biz-1/context/sources',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^onboarding-source-biz-1-website-/),
        }),
        body: JSON.stringify({
          source_type: 'website',
          source_name: 'https://example.com',
          external_reference: 'https://example.com',
        }),
      }),
    )
    expect(source).toEqual({
      id: 'src-1',
      sourceType: 'website',
      sourceName: 'https://example.com',
      externalReference: 'https://example.com',
      status: 'registered',
      currentStage: null,
      progress: 0,
    })
  })
})

describe('createOnboardingUploadIntent', () => {
  it('creates a signed upload intent with storage path', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'upload-1',
        source_type: 'upload',
        document_class: 'other',
        classification_source: 'user_selected',
        upload_url: 'https://storage.example/upload',
        storage_path: 'workspaces/ws-1/businesses/biz-1/uploads/upload-1/notes.pdf',
        expires_at: '2026-07-21T00:00:00.000Z',
        status: 'pending',
        malware_scan_status: 'pending',
        malware_scan_code: null,
      }),
    })

    const intent = await createOnboardingUploadIntent('biz-1', {
      sourceName: 'notes.pdf',
      fileName: 'notes.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1234,
      documentClass: 'other',
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/businesses/biz-1/context/uploads',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^onboarding-upload-biz-1-/),
        }),
        body: JSON.stringify({
          source_type: 'upload',
          source_name: 'notes.pdf',
          file_name: 'notes.pdf',
          mime_type: 'application/pdf',
          size_bytes: 1234,
          document_class: 'other',
        }),
      }),
    )
    expect(intent.storagePath).toBe('workspaces/ws-1/businesses/biz-1/uploads/upload-1/notes.pdf')
    expect(intent.uploadUrl).toBe('https://storage.example/upload')
  })
})

describe('completeOnboardingUpload', () => {
  it('uploads file bytes to signed URL then completes backend upload', async () => {
    const file = new File(['pdf'], 'notes.pdf', { type: 'application/pdf' })
    mockFetch
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          source: {
            id: 'src-1',
            source_type: 'system_inference',
            source_name: 'notes.pdf',
            status: 'queued',
            current_stage: 'queued',
          },
        }),
      })

    const result = await completeOnboardingUpload('biz-1', {
      uploadId: 'upload-1',
      uploadUrl: 'https://storage.example/upload',
      storagePath: 'workspaces/ws-1/businesses/biz-1/uploads/upload-1/notes.pdf',
      file,
    })

    expect(mockFetch).toHaveBeenNthCalledWith(1, 'https://storage.example/upload', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: file,
    })
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/businesses/biz-1/context/uploads/upload-1/complete',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^onboarding-upload-complete-biz-1-/),
        }),
        body: JSON.stringify({
          storage_path: 'workspaces/ws-1/businesses/biz-1/uploads/upload-1/notes.pdf',
        }),
      }),
    )
    expect(result).toEqual({
      id: 'src-1',
      sourceType: 'system_inference',
      sourceName: 'notes.pdf',
      externalReference: null,
      status: 'queued',
      currentStage: 'queued',
      progress: 0,
    })
  })
})

describe('queueOnboardingScan', () => {
  it('queues backend processing for registered onboarding sources', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ jobs_queued: 2 }),
    })

    const result = await queueOnboardingScan('biz-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/businesses/biz-1/onboarding/scan',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^onboarding-scan-biz-1-/),
        }),
      }),
    )
    expect(result.jobsQueued).toBe(2)
  })
})

describe('compileOnboardingDraft', () => {
  it('requests backend profile compilation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { business: { summary: 'Acme summary' } } }),
    })

    const result = await compileOnboardingDraft('biz-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/businesses/biz-1/onboarding/compile',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^onboarding-compile-biz-1-/),
        }),
      }),
    )
    expect(result.profile).toEqual({ business: { summary: 'Acme summary' } })
  })
})

describe('startOnboardingSession', () => {
  it('starts backend onboarding session with an idempotency key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'session-1', status: 'in_progress' }),
    })

    const result = await startOnboardingSession('biz-1')

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/businesses/biz-1/onboarding',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^onboarding-session-biz-1-/),
        }),
      }),
    )
    expect(result.id).toBe('session-1')
  })
})

describe('submitOnboardingAnswers', () => {
  it('posts onboarding facts with an idempotency key', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })

    await submitOnboardingAnswers('biz-1', {
      answers: [
        { factKey: 'business.name', answer: 'Demo Agency' },
        { factKey: 'economics.monthly_meta_budget', answer: 0 },
      ],
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/businesses/biz-1/onboarding/answers',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Idempotency-Key': expect.stringMatching(/^onboarding-answers-biz-1-/),
        }),
        body: JSON.stringify({
          answers: [
            { factKey: 'business.name', answer: 'Demo Agency' },
            { factKey: 'economics.monthly_meta_budget', answer: 0 },
          ],
        }),
      }),
    )
  })
})
