import { describe, expect, it, vi } from 'vitest'
import { compileDraftFromFacts } from '@/core/business-context/compiler'
import type { ContextFact, JsonValue, SourceDocument } from '@/core/business-context/types'
import type { RepositoryPort } from '@/core/business-context/repository.port'

function fact(overrides: Partial<ContextFact>): ContextFact {
  return {
    id: 'f-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    factKey: 'business.name',
    value: 'Acme' as JsonValue,
    sourceId: 'src-1',
    sourceDocumentId: null,
    sourceExcerpt: 'Acme',
    evidenceLocator: null,
    confidence: 0.9,
    verificationStatus: 'extracted',
    supersedesFactId: null,
    validFrom: new Date(),
    validTo: null,
    createdBy: 'system',
    createdAt: new Date(),
    ...overrides,
  }
}

function sourceDocument(overrides?: Partial<SourceDocument>): SourceDocument {
  return {
    id: 'doc-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sourceId: 'src-meta',
    url: null,
    title: 'Meta Performance Evidence',
    documentType: null,
    mimeType: 'application/json',
    fileName: null,
    fileSizeBytes: null,
    contentText: 'Meta evidence',
    storagePath: null,
    contentHash: 'hash-1',
    httpStatus: null,
    pageOrSlideCount: null,
    parserName: null,
    parserVersion: null,
    effectiveAt: null,
    supersedesDocumentId: null,
    metadata: {
      metaAdAccountId: 'act_123',
      dataWindow: { since: '2026-07-01', until: '2026-07-07' },
      freshness: { latestDate: '2026-07-07', missingWindowCount: 0, gapCount: 0 },
      syncRunId: 'run-123',
    },
    retrievedAt: new Date(),
    ...overrides,
  }
}

function makeRepo(docs: SourceDocument[]): RepositoryPort {
  return {
    listContextFacts: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: [fact({ factKey: 'business.name', value: 'Acme' })], total: 1 },
    }),
    listContextConflicts: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
    listSourceDocuments: vi.fn().mockResolvedValue({ ok: true, data: { items: docs, total: docs.length } }),
  } as unknown as RepositoryPort
}

describe('Meta evidence provenance', () => {
  it('adds Meta provenance when source documents include Meta evidence metadata', async () => {
    const result = await compileDraftFromFacts(makeRepo([sourceDocument()]), 'biz-1', 'ws-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.profile._provenance).toEqual({
      meta: [
        expect.objectContaining({
          sourceDocumentId: 'doc-1',
          metaAdAccountId: 'act_123',
          syncRunId: 'run-123',
          dataWindow: { since: '2026-07-01', until: '2026-07-07' },
          freshness: { latestDate: '2026-07-07', missingWindowCount: 0, gapCount: 0 },
        }),
      ],
    })
  })

  it('omits Meta provenance when no Meta source document is present', async () => {
    const result = await compileDraftFromFacts(makeRepo([sourceDocument({ metadata: { pageCount: 1 } })]), 'biz-1', 'ws-1')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.profile._provenance).toBeUndefined()
  })
})
