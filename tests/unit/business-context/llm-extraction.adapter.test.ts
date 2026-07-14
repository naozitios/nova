import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  LlmExtractionAdapter,
  type LlmClient,
  type ExtractionSchema,
} from '../../../src/infrastructure/business-context/llm-extraction.adapter'
import type { ExtractionRequest, ReconciliationRequest } from '../../../src/core/business-context/extraction.port'

// ─── Mock LLM client ──────────────────────────────────────────────────────

function createMockLlmClient(): LlmClient {
  return {
    complete: vi.fn().mockResolvedValue({
      facts: [
        { factKey: 'business.name', value: 'Acme Corp', confidence: 0.85, sourceExcerpt: 'Acme Corp is a leader', evidenceLocator: null },
      ],
      conflicts: [],
      warnings: [],
    }),
  }
}

// ─── extractFacts ──────────────────────────────────────────────────────────

describe('LlmExtractionAdapter.extractFacts', () => {
  let client: LlmClient
  let adapter: LlmExtractionAdapter

  beforeEach(() => {
    client = createMockLlmClient()
    adapter = new LlmExtractionAdapter(client)
  })

  it('returns facts from LLM response', async () => {
    const request: ExtractionRequest = {
      sourceDocumentId: 'doc-1',
      sourceId: 'src-1',
      businessId: 'biz-1',
      workspaceId: 'ws-1',
      contentText: 'Acme Corp makes widgets',
      sourceType: 'website',
      parserName: 'firecrawl',
    }

    const result = await adapter.extractFacts(request)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.facts).toHaveLength(1)
      expect(result.data.facts[0].factKey).toBe('business.name')
      expect(result.data.facts[0].value).toBe('Acme Corp')
    }
  })

  it('calls LLM with schema-constrained prompt', async () => {
    const request: ExtractionRequest = {
      sourceDocumentId: 'doc-1',
      sourceId: 'src-1',
      businessId: 'biz-1',
      workspaceId: 'ws-1',
      contentText: 'Some content',
      sourceType: 'website',
      parserName: 'firecrawl',
    }

    await adapter.extractFacts(request)

    expect(client.complete).toHaveBeenCalledOnce()
    const callArgs = (client.complete as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(callArgs).toHaveProperty('schema')
    expect(callArgs).toHaveProperty('content')
    expect(callArgs.content).toContain('Some content')
  })

  it('repairs invalid JSON once', async () => {
    const mockClient: LlmClient = {
      complete: vi
        .fn()
        .mockResolvedValueOnce('not valid json {{{')
        .mockResolvedValueOnce({
          facts: [{ factKey: 'business.name', value: 'Acme', confidence: 0.7, sourceExcerpt: null, evidenceLocator: null }],
          conflicts: [],
          warnings: [],
        }),
    }
    const adapter = new LlmExtractionAdapter(mockClient)

    const request: ExtractionRequest = {
      sourceDocumentId: 'doc-1',
      sourceId: 'src-1',
      businessId: 'biz-1',
      workspaceId: 'ws-1',
      contentText: 'content',
      sourceType: 'website',
      parserName: 'firecrawl',
    }

    const result = await adapter.extractFacts(request)

    expect(result.ok).toBe(true)
    expect(mockClient.complete).toHaveBeenCalledTimes(2)
  })

  it('returns error after failed repair attempt', async () => {
    const mockClient: LlmClient = {
      complete: vi
        .fn()
        .mockResolvedValueOnce('invalid 1')
        .mockResolvedValueOnce('invalid 2'),
    }
    const adapter = new LlmExtractionAdapter(mockClient)

    const request: ExtractionRequest = {
      sourceDocumentId: 'doc-1',
      sourceId: 'src-1',
      businessId: 'biz-1',
      workspaceId: 'ws-1',
      contentText: 'content',
      sourceType: 'website',
      parserName: 'firecrawl',
    }

    const result = await adapter.extractFacts(request)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EXTRACTION_FAILED')
    }
  })

  it('returns error when LLM throws', async () => {
    const mockClient: LlmClient = {
      complete: vi.fn().mockRejectedValue(new Error('provider down')),
    }
    const adapter = new LlmExtractionAdapter(mockClient)

    const request: ExtractionRequest = {
      sourceDocumentId: 'doc-1',
      sourceId: 'src-1',
      businessId: 'biz-1',
      workspaceId: 'ws-1',
      contentText: 'content',
      sourceType: 'website',
      parserName: 'firecrawl',
    }

    const result = await adapter.extractFacts(request)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('LLM_ERROR')
    }
  })
})

// ─── reconcileFacts ────────────────────────────────────────────────────────

describe('LlmExtractionAdapter.reconcileFacts', () => {
  let adapter: LlmExtractionAdapter

  beforeEach(() => {
    adapter = new LlmExtractionAdapter(createMockLlmClient())
  })

  it('supersedes lower-precedence facts', async () => {
    const request: ReconciliationRequest = {
      businessId: 'biz-1',
      workspaceId: 'ws-1',
      factKey: 'business.name',
      existingFacts: [
        { id: 'f-1', value: 'Old Name', confidence: 0.5, verificationStatus: 'extracted', validFrom: new Date() },
      ],
      newFacts: [
        { factKey: 'business.name', value: 'New Name', confidence: 0.9, sourceExcerpt: null, evidenceLocator: null },
      ],
    }

    const result = await adapter.reconcileFacts(request)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.superseded).toHaveLength(1)
      expect(result.data.superseded[0].oldFactId).toBe('f-1')
      expect(result.data.toCreate).toHaveLength(1)
    }
  })

  it('detects conflict for same-precedence different values', async () => {
    const request: ReconciliationRequest = {
      businessId: 'biz-1',
      workspaceId: 'ws-1',
      factKey: 'business.name',
      existingFacts: [
        { id: 'f-1', value: 'Acme', confidence: 0.8, verificationStatus: 'extracted', validFrom: new Date() },
      ],
      newFacts: [
        { factKey: 'business.name', value: 'MegaCorp', confidence: 0.8, sourceExcerpt: null, evidenceLocator: null },
      ],
    }

    const result = await adapter.reconcileFacts(request)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.conflicts).toHaveLength(1)
    }
  })

  it('bumps confidence for matching values', async () => {
    const request: ReconciliationRequest = {
      businessId: 'biz-1',
      workspaceId: 'ws-1',
      factKey: 'business.name',
      existingFacts: [
        { id: 'f-1', value: 'Acme', confidence: 0.5, verificationStatus: 'extracted', validFrom: new Date() },
      ],
      newFacts: [
        { factKey: 'business.name', value: 'Acme', confidence: 0.9, sourceExcerpt: null, evidenceLocator: null },
      ],
    }

    const result = await adapter.reconcileFacts(request)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.toUpdate).toHaveLength(1)
      expect(result.data.toUpdate[0].confidence).toBe(0.9)
    }
  })
})
