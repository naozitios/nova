import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RetrievalService } from './retrieval.service'
import type { EmbeddingPort } from '../embedding.port'
import type { RepositoryPort } from '../repository.port'
import type { MetaRepositoryPort } from '@/core/meta-data/repository.port'
import type { RetrievalPort } from '../retrieval.port'

type MockRepo = Pick<RepositoryPort, 'getCurrentProfileVersion' | 'listContextFacts'>
type MockRetrievalPort = Pick<RetrievalPort, 'hybridSearch'>
type MockEmbeddingPort = Pick<EmbeddingPort, 'model' | 'dimensions' | 'embed'>
type MockMetaRepo = Pick<MetaRepositoryPort, 'listAdAccounts'>

describe('RetrievalService', () => {
  let mockRepo: MockRepo
  let mockRetrievalPort: MockRetrievalPort
  let mockEmbeddingPort: MockEmbeddingPort
  let mockMetaRepo: MockMetaRepo
  let service: RetrievalService

  beforeEach(() => {
    mockRepo = {
      getCurrentProfileVersion: vi.fn().mockResolvedValue({
        ok: true,
        data: { profile: { name: 'Test Business' } },
      }),
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [{ id: 'fact-1', value: 'test' }] },
      }),
    }
    mockRetrievalPort = {
      hybridSearch: vi.fn().mockResolvedValue({
        ok: true,
        data: [
          {
            id: 'chunk-1',
            sourceDocumentId: 'doc-1',
            content: 'test content',
            headingPath: ['H1'],
            locator: {},
            score: 0.9,
          },
        ],
      }),
    }
    mockEmbeddingPort = {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      embed: vi.fn().mockResolvedValue({
        ok: true,
        data: [Array(1536).fill(0.1)],
      }),
    }
    mockMetaRepo = {
      listAdAccounts: vi.fn().mockResolvedValue({
        ok: true,
        data: [{ id: 'ad-account-1', name: 'Test Account' }],
      }),
    }
    service = new RetrievalService(
      mockRepo as RepositoryPort,
      mockRetrievalPort,
      mockEmbeddingPort,
      mockMetaRepo as MetaRepositoryPort,
    )
  })

  it('returns profile, facts, chunks, and meta metrics', async () => {
    const result = await service.retrieveBusinessContext({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      query: 'test query',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.profile).toEqual({ name: 'Test Business' })
      expect(result.data.facts).toHaveLength(1)
      expect(result.data.evidenceChunks).toHaveLength(1)
      expect(result.data.metaMetrics.adAccounts).toHaveLength(1)
    }
  })

  it('embeds query and calls hybrid search', async () => {
    await service.retrieveBusinessContext({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      query: 'test query',
      limit: 5,
    })

    expect(mockEmbeddingPort.embed).toHaveBeenCalledWith(['test query'])
    expect(mockRetrievalPort.hybridSearch).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      query: 'test query',
      queryEmbedding: expect.any(Array),
      limit: 5,
    })
  })

  it('handles embedding failure', async () => {
    vi.mocked(mockEmbeddingPort.embed).mockResolvedValue({
      ok: false,
      error: { code: 'EMBEDDING_FAILED', message: 'API error' },
    })

    const result = await service.retrieveBusinessContext({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      query: 'test',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EMBEDDING_FAILED')
    }
  })
})
