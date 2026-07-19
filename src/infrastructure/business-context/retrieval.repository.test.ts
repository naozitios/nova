import { describe, expect, it, vi, beforeEach } from 'vitest'
import { RetrievalRepository } from './retrieval.repository'

describe('RetrievalRepository', () => {
  let mockDb: any
  let repo: RetrievalRepository

  beforeEach(() => {
    mockDb = {
      rpc: vi.fn(),
    }
    repo = new RetrievalRepository(mockDb)
  })

  it('calls RPC with correct parameters', async () => {
    mockDb.rpc.mockResolvedValue({ data: [], error: null })

    await repo.hybridSearch({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      query: 'test query',
      queryEmbedding: [0.1, 0.2, 0.3],
      limit: 5,
    })

    expect(mockDb.rpc).toHaveBeenCalledWith('hybrid_search_document_chunks', {
      query_text: 'test query',
      query_embedding: [0.1, 0.2, 0.3],
      match_workspace_id: 'ws-1',
      match_business_id: 'biz-1',
      match_count: 5,
    })
  })

  it('maps response to RetrievedChunk[]', async () => {
    mockDb.rpc.mockResolvedValue({
      data: [
        {
          id: 'chunk-1',
          source_document_id: 'doc-1',
          content: 'test content',
          heading_path: ['H1', 'H2'],
          locator: { startChar: 0, endChar: 100 },
          score: 0.95,
        },
      ],
      error: null,
    })

    const result = await repo.hybridSearch({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      query: 'test',
      queryEmbedding: [0.1],
      limit: 5,
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data).toEqual([
        {
          id: 'chunk-1',
          sourceDocumentId: 'doc-1',
          content: 'test content',
          headingPath: ['H1', 'H2'],
          locator: { startChar: 0, endChar: 100 },
          score: 0.95,
        },
      ])
    }
  })

  it('handles RPC error', async () => {
    mockDb.rpc.mockResolvedValue({ data: null, error: { message: 'RPC failed' } })

    const result = await repo.hybridSearch({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      query: 'test',
      queryEmbedding: [0.1],
      limit: 5,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('SEARCH_FAILED')
      expect(result.error.message).toBe('RPC failed')
    }
  })
})
