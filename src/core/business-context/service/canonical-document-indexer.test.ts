import { describe, expect, it, vi } from 'vitest'
import { CanonicalDocumentIndexer } from './canonical-document-indexer'
import type { UploadStoragePort } from '../upload-storage.port'
import type { EmbeddingPort } from '../embedding.port'
import type { RepositoryPort } from '../repository/repository.port'
import type { JsonValue } from '../types'

function makeFakeRepo(overrides?: Record<string, unknown>) {
  return {
    updateSourceDocument: vi.fn().mockResolvedValue({ ok: true }),
    replaceDocumentChunks: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    ...overrides,
  }
}

function makeFakeStorage(overrides?: Record<string, unknown>) {
  return {
    upload: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
}

function makeFakeEmbedder(overrides?: Record<string, unknown>) {
  return {
    model: 'text-embedding-ada-002',
    embed: vi.fn().mockImplementation((texts: string[]) =>
      Promise.resolve({
        ok: true,
        data: texts.map(() => [0.1, 0.2]),
      }),
    ),
    ...overrides,
  }
}

function makeIndexer(
  storage: UploadStoragePort,
  embedder: EmbeddingPort,
  repo: RepositoryPort,
) {
  return new CanonicalDocumentIndexer(storage, embedder, repo)
}

const baseParams = {
  workspaceId: 'ws-1',
  businessId: 'biz-1',
  documentId: 'doc-1',
  markdown: '# Title\n\nSome content',
  processedStoragePath: 'processed/doc-1.md',
  parserName: 'docling',
  parserVersion: '1.0.0',
  pageOrSlideCount: 3,
}

describe('CanonicalDocumentIndexer', () => {
  it('uploads exact processedStoragePath with correct content type', async () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index(baseParams)

    expect(result.ok).toBe(true)
    expect(storage.upload).toHaveBeenCalledTimes(1)
    expect(storage.upload).toHaveBeenCalledWith({
      bucket: 'business-context-sources',
      path: 'processed/doc-1.md',
      content: Buffer.from(baseParams.markdown, 'utf-8'),
      contentType: 'text/markdown; charset=utf-8',
      upsert: true,
    })
  })

  it('returns chunkCount and processedStoragePath', async () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index(baseParams)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.processedStoragePath).toBe('processed/doc-1.md')
      expect(typeof result.data.chunkCount).toBe('number')
      expect(result.data.chunkCount).toBeGreaterThanOrEqual(0)
    }
  })

  it('merges baseLocator into every chunk locator', async () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index({
      ...baseParams,
      baseLocator: { url: 'https://example.com', page: 1 },
    })

    expect(result.ok).toBe(true)
    const chunks = repo.replaceDocumentChunks.mock.calls[0]![3] as Array<{
      chunkIndex: number
      headingPath: string[]
      content: string
      locator: Record<string, JsonValue>
      embedding: number[]
      embeddingModel: string
    }>
    for (const chunk of chunks) {
      expect(chunk.locator.url).toBe('https://example.com')
      expect(chunk.locator.page).toBe(1)
    }
  })

  it('preserves existing locator fields when baseLocator is provided', async () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index({
      ...baseParams,
      markdown: '# Hello\n\nWorld',
      baseLocator: { url: 'https://example.com' },
    })

    expect(result.ok).toBe(true)
    const chunks = repo.replaceDocumentChunks.mock.calls[0]![3] as Array<{
      chunkIndex: number
      headingPath: string[]
      content: string
      locator: Record<string, JsonValue>
      embedding: number[]
      embeddingModel: string
    }>
    for (const chunk of chunks) {
      expect(chunk.locator.url).toBe('https://example.com')
      expect(typeof chunk.locator.startChar).toBe('number')
    }
  })

  it('updates document indexed fields on success', async () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    await indexer.index(baseParams)

    expect(repo.updateSourceDocument).toHaveBeenCalledWith('ws-1', 'doc-1', {
      processedStoragePath: 'processed/doc-1.md',
      processingStatus: 'indexed',
      embeddingModel: 'text-embedding-ada-002',
      indexedAt: expect.any(Date),
      contentText: baseParams.markdown,
      pageOrSlideCount: 3,
      parserName: 'docling',
      parserVersion: '1.0.0',
    })
  })

  it('sets processingStatus failed on upload failure', async () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage({
      upload: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'UPLOAD_FAILED', message: 'Storage unreachable' },
      }),
    })
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index(baseParams)

    expect(result.ok).toBe(false)
    expect(repo.updateSourceDocument).toHaveBeenCalledWith('ws-1', 'doc-1', {
      processingStatus: 'failed',
    })
  })

  it('sets processingStatus failed on embed failure', async () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder({
      embed: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'EMBED_FAILED', message: 'API error' },
      }),
    })
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index(baseParams)

    expect(result.ok).toBe(false)
    expect(repo.updateSourceDocument).toHaveBeenCalledWith('ws-1', 'doc-1', {
      processingStatus: 'failed',
    })
  })

  it('sets processingStatus failed on replace chunks failure', async () => {
    const repo = makeFakeRepo({
      replaceDocumentChunks: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'REPLACE_FAILED', message: 'DB error' },
      }),
    })
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index(baseParams)

    expect(result.ok).toBe(false)
    expect(repo.updateSourceDocument).toHaveBeenCalledWith('ws-1', 'doc-1', {
      processingStatus: 'failed',
    })
  })

  it('sets processingStatus failed on indexed update failure', async () => {
    const updateFn = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'UPDATE_FAILED', message: 'DB write error' },
      })
      .mockResolvedValueOnce({ ok: true }) // fallback failed-status call
    const repo = makeFakeRepo({ updateSourceDocument: updateFn })
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index(baseParams)

    expect(result.ok).toBe(false)
    expect(result).toEqual({
      ok: false,
      error: { code: 'UPDATE_FAILED', message: 'DB write error' },
    })
    expect(updateFn).toHaveBeenCalledTimes(2)
    expect(updateFn).toHaveBeenNthCalledWith(2, 'ws-1', 'doc-1', {
      processingStatus: 'failed',
    })
  })

  it('returns INDEXING_FAILED and failed status on embedding count mismatch', async () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder({
      embed: vi.fn().mockResolvedValue({
        ok: true,
        data: [], // 0 embeddings for 2 chunks → mismatch
      }),
    })
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index(baseParams)

    expect(result.ok).toBe(false)
    expect(result).toEqual({
      ok: false,
      error: { code: 'INDEXING_FAILED', message: 'Embedding result count mismatch' },
    })
    expect(repo.updateSourceDocument).toHaveBeenCalledWith('ws-1', 'doc-1', {
      processingStatus: 'failed',
    })
  })

  it('attempts processingStatus failed and returns failure when updateSourceDocument throws', async () => {
    const repo = makeFakeRepo({
      updateSourceDocument: vi.fn()
        .mockRejectedValueOnce(new Error('DB crash')) // first call (indexed update) throws
        .mockResolvedValue({ ok: true }), // fallback in catch block
    })
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index(baseParams)

    expect(result.ok).toBe(false)
    expect(result).toEqual({
      ok: false,
      error: { code: 'INDEXING_FAILED', message: 'DB crash' },
    })
  })

  it('returns empty chunks and chunkCount 0 for empty markdown', async () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index({
      ...baseParams,
      markdown: '',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.chunkCount).toBe(0)
      expect(result.data.processedStoragePath).toBe('processed/doc-1.md')
    }
  })

  it('preserves model getter', () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder({ model: 'text-embedding-3-small' })
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    expect(indexer.model).toBe('text-embedding-3-small')
  })

  it('accepts pageOrSlideCount as null', async () => {
    const repo = makeFakeRepo()
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index({ ...baseParams, pageOrSlideCount: null })

    expect(result.ok).toBe(true)
    expect(repo.updateSourceDocument).toHaveBeenCalledWith('ws-1', 'doc-1', expect.objectContaining({
      pageOrSlideCount: null,
    }))
  })

  it('does not mask original failure when markFailed throws', async () => {
    const repo = makeFakeRepo({
      updateSourceDocument: vi.fn()
        .mockResolvedValueOnce({ ok: false, error: { code: 'UPDATE_FAILED', message: 'DB write error' } })
        .mockRejectedValueOnce(new Error('DB crash')),
    })
    const storage = makeFakeStorage()
    const embedder = makeFakeEmbedder()
    const indexer = makeIndexer(
      storage as unknown as UploadStoragePort,
      embedder as unknown as EmbeddingPort,
      repo as unknown as RepositoryPort,
    )

    const result = await indexer.index(baseParams)

    expect(result.ok).toBe(false)
    expect(result).toEqual({
      ok: false,
      error: { code: 'UPDATE_FAILED', message: 'DB write error' },
    })
  })
})
