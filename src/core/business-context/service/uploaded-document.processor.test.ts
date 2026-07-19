import { describe, expect, it, vi } from 'vitest'
import { UploadedDocumentProcessor } from './uploaded-document.processor'
import type { RepositoryPort } from '../repository.port'
import type { DocumentParserPort } from '../document-parser.port'
import type { CanonicalDocumentIndexer } from './canonical-document-indexer'
import type { SourceDocument } from '../types'
import type { SourceFactPipeline } from './source-fact-pipeline'

function makeDoc(overrides: Partial<SourceDocument> = {}): SourceDocument {
  return {
    id: 'doc-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sourceId: 'src-1',
    url: null,
    title: 'Test Doc',
    documentType: null,
    mimeType: 'application/pdf',
    fileName: 'test.pdf',
    fileSizeBytes: 1024,
    contentText: null,
    storagePath: 'ws-1/biz-1/test.pdf',
    processedStoragePath: null,
    processingStatus: 'pending',
    embeddingModel: null,
    indexedAt: null,
    contentHash: 'abc123',
    httpStatus: null,
    pageOrSlideCount: null,
    parserName: null,
    parserVersion: null,
    effectiveAt: null,
    supersedesDocumentId: null,
    metadata: {},
    retrievedAt: new Date(),
    ...overrides,
  }
}

function createMockRepo(overrides: Partial<RepositoryPort> = {}): RepositoryPort {
  return new Proxy({} as RepositoryPort, {
    get(_target, prop: string) {
      if (prop in overrides) {
        return (overrides as Record<string, unknown>)[prop]
      }
      return async () => ({ ok: true, data: undefined })
    },
  })
}

function createMockParser(overrides: Partial<DocumentParserPort> = {}): DocumentParserPort {
  return {
    supports: vi.fn().mockReturnValue(true),
    parse: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        contentText: '# Test Content\n\nParsed markdown content.',
        title: 'Test Doc',
        mimeType: 'application/pdf',
        pageOrSlideCount: 5,
        parserName: 'docling',
        parserVersion: '1.0.0',
        warnings: [],
        metadata: {},
      },
    }),
    parseContent: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        contentText: '# Test Content',
        parserName: 'docling',
        parserVersion: '1.0.0',
        warnings: [],
        metadata: {},
      },
    }),
    ...overrides,
  }
}

function createMockIndexer(overrides: Partial<CanonicalDocumentIndexer> = {}): CanonicalDocumentIndexer {
  return {
    model: 'text-embedding-3-small',
    index: vi.fn().mockResolvedValue({ ok: true, data: { processedStoragePath: 'ws-1/biz-1/test.pdf.md' } }),
    ...overrides,
  } as CanonicalDocumentIndexer
}

describe('UploadedDocumentProcessor', () => {
  it('parses document, indexes via CanonicalDocumentIndexer, marks indexed', async () => {
    const updateDocSpy = vi.fn().mockResolvedValue({ ok: true, data: makeDoc() })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      updateSourceDocument: updateDocSpy,
    })
    const parser = createMockParser()
    const indexer = createMockIndexer()

    const processor = new UploadedDocumentProcessor(repo, parser, indexer)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.status).toBe('indexed')
    }

    expect(parser.parse).toHaveBeenCalledWith({
      storagePath: 'ws-1/biz-1/test.pdf',
      mimeType: 'application/pdf',
      fileName: 'test.pdf',
    })

    expect(indexer.index).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      documentId: 'doc-1',
      markdown: '# Test Content\n\nParsed markdown content.',
      processedStoragePath: 'ws-1/biz-1/test.pdf.md',
      parserName: 'docling',
      parserVersion: '1.0.0',
      pageOrSlideCount: 5,
    })

    // Indexer handles metadata update — processor only sets 'processing'
    expect(updateDocSpy).toHaveBeenCalledTimes(1)
    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({ processingStatus: 'processing' }),
    )
  })

  it('is idempotent when already indexed with same model', async () => {
    const updateDocSpy = vi.fn()
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({
        ok: true,
        data: makeDoc({
          processingStatus: 'indexed',
          embeddingModel: 'text-embedding-3-small',
        }),
      }),
      updateSourceDocument: updateDocSpy,
    })
    const parser = createMockParser()
    const indexer = createMockIndexer()

    const processor = new UploadedDocumentProcessor(repo, parser, indexer)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.status).toBe('indexed')
    }

    expect(parser.parse).not.toHaveBeenCalled()
    expect(indexer.index).not.toHaveBeenCalled()
    expect(updateDocSpy).not.toHaveBeenCalled()
  })

  it('marks failed on parse error', async () => {
    const updateDocSpy = vi.fn().mockResolvedValue({ ok: true, data: makeDoc() })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      updateSourceDocument: updateDocSpy,
    })
    const parser = createMockParser({
      parse: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'DOCLING_FAILED', message: 'Parse error' },
      }),
    })
    const indexer = createMockIndexer()

    const processor = new UploadedDocumentProcessor(repo, parser, indexer)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DOCLING_FAILED')
    }

    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({ processingStatus: 'processing' }),
    )
    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({ processingStatus: 'failed' }),
    )
  })

  it('marks failed on index error', async () => {
    const updateDocSpy = vi.fn().mockResolvedValue({ ok: true, data: makeDoc() })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      updateSourceDocument: updateDocSpy,
    })
    const parser = createMockParser()
    const indexer = createMockIndexer({
      index: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'INDEXING_FAILED', message: 'Embedding result count mismatch' },
      }),
    })

    const processor = new UploadedDocumentProcessor(repo, parser, indexer)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('INDEXING_FAILED')
    }

    // Processor only marks processing; indexer handles its own failure marking
    expect(updateDocSpy).toHaveBeenCalledTimes(1)
    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({ processingStatus: 'processing' }),
    )
  })

  it('extracts facts via SourceFactPipeline when injected', async () => {
    const updateDocSpy = vi.fn().mockResolvedValue({ ok: true, data: makeDoc() })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      updateSourceDocument: updateDocSpy,
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [] },
      }),
    })
    const parser = createMockParser()
    const indexer = createMockIndexer()
    const factPipeline = {
      process: vi.fn().mockResolvedValue({
        ok: true,
        data: { factsExtracted: 2, warnings: ['low confidence for field_x'] },
      }),
    } as unknown as SourceFactPipeline

    const processor = new UploadedDocumentProcessor(repo, parser, indexer, factPipeline)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
      runId: 'run-1',
      sessionId: 'session-1',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.status).toBe('processed_with_warnings')
      expect(result.data.warnings).toContain('low confidence for field_x')
    }

    expect(factPipeline.process).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'upload',
        runId: 'run-1',
        sessionId: 'session-1',
        documents: [
          expect.objectContaining({
            sourceDocumentId: 'doc-1',
            parserName: 'docling',
          }),
        ],
      }),
    )

    expect(factPipeline.process).not.toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: expect.anything(),
      }),
    )

    expect(factPipeline.process).not.toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.anything(),
      }),
    )

    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({
        metadata: expect.objectContaining({ uploadFactProcessingCompleted: true }),
      }),
    )
  })

  it('returns processed when factPipeline succeeds with no warnings', async () => {
    const updateDocSpy = vi.fn().mockResolvedValue({ ok: true, data: makeDoc() })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      updateSourceDocument: updateDocSpy,
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [] },
      }),
    })
    const parser = createMockParser()
    const indexer = createMockIndexer()
    const factPipeline = {
      process: vi.fn().mockResolvedValue({
        ok: true,
        data: { factsExtracted: 3, warnings: [] },
      }),
    } as unknown as SourceFactPipeline

    const processor = new UploadedDocumentProcessor(repo, parser, indexer, factPipeline)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.status).toBe('processed')
      expect(result.data.warnings).toEqual([])
    }

    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({ metadata: expect.objectContaining({ uploadFactProcessingCompleted: true }) }),
    )
  })

  it('marks failed when fact extraction fails', async () => {
    const updateDocSpy = vi.fn().mockResolvedValue({ ok: true, data: makeDoc() })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      updateSourceDocument: updateDocSpy,
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [] },
      }),
    })
    const parser = createMockParser()
    const indexer = createMockIndexer()
    const factPipeline = {
      process: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'EXTRACTION_FAILED', message: 'API error' },
      }),
    } as unknown as SourceFactPipeline

    const processor = new UploadedDocumentProcessor(repo, parser, indexer, factPipeline)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
      runId: 'run-1',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EXTRACTION_FAILED')
    }

    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({ processingStatus: 'failed' }),
    )
  })

  it('is idempotent when indexed with factPipeline completion metadata', async () => {
    const updateDocSpy = vi.fn()
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({
        ok: true,
        data: makeDoc({
          processingStatus: 'indexed',
          embeddingModel: 'text-embedding-3-small',
          metadata: { uploadFactProcessingCompleted: true },
        }),
      }),
      updateSourceDocument: updateDocSpy,
    })
    const parser = createMockParser()
    const indexer = createMockIndexer()
    const factPipeline = {
      process: vi.fn(),
    } as unknown as SourceFactPipeline

    const processor = new UploadedDocumentProcessor(repo, parser, indexer, factPipeline)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.status).toBe('processed')
    }

    expect(parser.parse).not.toHaveBeenCalled()
    expect(indexer.index).not.toHaveBeenCalled()
    expect(factPipeline.process).not.toHaveBeenCalled()
    expect(updateDocSpy).not.toHaveBeenCalled()
  })

  it('stops and marks failed when listContextFacts fails', async () => {
    const updateDocSpy = vi.fn().mockResolvedValue({ ok: true, data: makeDoc() })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      updateSourceDocument: updateDocSpy,
      listContextFacts: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'DB_ERROR', message: 'Connection refused' },
      }),
    })
    const parser = createMockParser()
    const indexer = createMockIndexer()
    const factPipeline = {
      process: vi.fn(),
    } as unknown as SourceFactPipeline

    const processor = new UploadedDocumentProcessor(repo, parser, indexer, factPipeline)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DB_ERROR')
    }

    expect(factPipeline.process).not.toHaveBeenCalled()

    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({ processingStatus: 'failed' }),
    )
  })

  it('returns repo failure when completed-status update fails after successful fact pipeline', async () => {
    const updateDocSpy = vi.fn().mockImplementation(async (
      _wsId: string,
      _docId: string,
      patch: { processingStatus?: string; metadata?: Record<string, unknown> },
    ) => {
      // First call: 'processing' — ok. Second call: metadata completion — fails. Third call: 'failed' — ok (best-effort).
      if (patch.metadata?.uploadFactProcessingCompleted === true) {
        return { ok: false, error: { code: 'DB_WRITE_ERROR', message: 'Connection lost' } }
      }
      return { ok: true, data: makeDoc() }
    })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      updateSourceDocument: updateDocSpy,
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [] },
      }),
    })
    const parser = createMockParser()
    const indexer = createMockIndexer()
    const factPipeline = {
      process: vi.fn().mockResolvedValue({
        ok: true,
        data: { factsExtracted: 2, warnings: [] },
      }),
    } as unknown as SourceFactPipeline

    const processor = new UploadedDocumentProcessor(repo, parser, indexer, factPipeline)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    // Must NOT return success — the final status write failed
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DB_WRITE_ERROR')
    }

    // Fact pipeline ran exactly once (no rerun)
    expect(factPipeline.process).toHaveBeenCalledTimes(1)

    // Best-effort: attempted to mark failed after completed-status failure
    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({ processingStatus: 'failed' }),
    )
  })

  it('marks failed on missing storagePath', async () => {
    const updateDocSpy = vi.fn().mockResolvedValue({ ok: true, data: makeDoc() })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({
        ok: true,
        data: makeDoc({ storagePath: null }),
      }),
      updateSourceDocument: updateDocSpy,
    })
    const parser = createMockParser()
    const indexer = createMockIndexer()

    const processor = new UploadedDocumentProcessor(repo, parser, indexer)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('PROCESSING_FAILED')
      expect(result.error.message).toBe('Missing storagePath or mimeType')
    }

    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({ processingStatus: 'processing' }),
    )
    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({ processingStatus: 'failed' }),
    )
  })
})
