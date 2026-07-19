import { describe, expect, it, vi, beforeEach } from 'vitest'
import { OpenAIEmbeddingAdapter } from './openai-embedding.adapter'

describe('OpenAIEmbeddingAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('embeds single text', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: Array(1536).fill(0.1) }],
      }),
    })
    global.fetch = mockFetch

    const adapter = new OpenAIEmbeddingAdapter({ apiKey: 'test-key' })
    const result = await adapter.embed(['test text'])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toHaveLength(1536)
    }
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: ['test text'],
          dimensions: 1536,
        }),
      })
    )
  })

  it('multiple texts preserve input order', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { embedding: [1, 2, 3] },
          { embedding: [4, 5, 6] },
          { embedding: [7, 8, 9] },
        ],
      }),
    })
    global.fetch = mockFetch

    const adapter = new OpenAIEmbeddingAdapter({
      apiKey: 'test-key',
      dimensions: 3,
    })
    const result = await adapter.embed(['first', 'second', 'third'])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data[0]).toEqual([1, 2, 3])
      expect(result.data[1]).toEqual([4, 5, 6])
      expect(result.data[2]).toEqual([7, 8, 9])
    }
  })

  it('sends all texts in one request (no batching)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: Array(100).fill({ embedding: Array(1536).fill(0.1) }),
      }),
    })
    global.fetch = mockFetch

    const adapter = new OpenAIEmbeddingAdapter({ apiKey: 'test-key' })
    const texts = Array(100).fill('text')
    await adapter.embed(texts)

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('non-2xx response returns EMBEDDING_FAILED error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    })
    global.fetch = mockFetch

    const adapter = new OpenAIEmbeddingAdapter({ apiKey: 'bad-key' })
    const result = await adapter.embed(['test'])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EMBEDDING_FAILED')
      expect(result.error.message).toContain('401')
    }
  })

  it('network error returns EMBEDDING_FAILED error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    global.fetch = mockFetch

    const adapter = new OpenAIEmbeddingAdapter({ apiKey: 'test-key' })
    const result = await adapter.embed(['test'])

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EMBEDDING_FAILED')
      expect(result.error.message).toBe('ECONNREFUSED')
    }
  })

  it('empty input returns empty array without fetch call', async () => {
    const mockFetch = vi.fn()
    global.fetch = mockFetch

    const adapter = new OpenAIEmbeddingAdapter({ apiKey: 'test-key' })
    const result = await adapter.embed([])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual([])
    }
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('uses correct model text-embedding-3-small', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1] }],
      }),
    })
    global.fetch = mockFetch

    const adapter = new OpenAIEmbeddingAdapter({ apiKey: 'test-key', dimensions: 1 })
    await adapter.embed(['text'])

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toBe('text-embedding-3-small')
  })

  it('uses correct API URL and headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1] }],
      }),
    })
    global.fetch = mockFetch

    const adapter = new OpenAIEmbeddingAdapter({
      apiKey: 'sk-abc123',
      baseUrl: 'https://custom.api.com/v1',
      dimensions: 1,
    })
    await adapter.embed(['text'])

    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom.api.com/v1/embeddings',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer sk-abc123',
          'Content-Type': 'application/json',
        },
      })
    )
  })
})
