import { describe, expect, it, vi } from 'vitest'
import { UploadedDocumentProcessor } from './uploaded-document.processor'
import type { RepositoryPort } from '../repository.port'
import type { DocumentParserPort } from '../document-parser.port'
import type { EmbeddingPort } from '../embedding.port'
import type { UploadStoragePort } from '../upload-storage.port'
import type { SourceDocument } from '../types'

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
      return async (..._args: unknown[]) => ({ ok: true, data: undefined })
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

function createMockStorage(overrides: Partial<UploadStoragePort> = {}): UploadStoragePort {
  return {
    upload: vi.fn().mockResolvedValue({ ok: true, data: { storagePath: 'ws-1/biz-1/test.pdf.md' } }),
    download: vi.fn().mockResolvedValue({ ok: true, data: Buffer.alloc(0) }),
    delete: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    getSignedUrl: vi.fn().mockResolvedValue({ ok: true, data: 'https://signed.example.com' }),
    ...overrides,
  }
}

function createMockEmbedder(overrides: Partial<EmbeddingPort> = {}): EmbeddingPort {
  return {
    model: 'text-embedding-3-small',
    dimensions: 1536,
    embed: vi.fn().mockResolvedValue({
      ok: true,
      data: [[0.1, 0.2, 0.3]],
    }),
    ...overrides,
  }
}

describe('UploadedDocumentProcessor', () => {
  it('parses document, uploads markdown, stores chunks, marks indexed', async () => {
    const updateDocSpy = vi.fn().mockResolvedValue({ ok: true, data: makeDoc() })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      updateSourceDocument: updateDocSpy,
      replaceDocumentChunks: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    })
    const parser = createMockParser()
    const storage = createMockStorage()
    const embedder = createMockEmbedder()

    const processor = new UploadedDocumentProcessor(repo, parser, storage, embedder)
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

    // Parser called with storagePath and mimeType
    expect(parser.parse).toHaveBeenCalledWith({
      storagePath: 'ws-1/biz-1/test.pdf',
      mimeType: 'application/pdf',
      fileName: 'test.pdf',
    })

    // Storage upload called with .md suffix and upsert
    expect(storage.upload).toHaveBeenCalledWith({
      bucket: 'business-context-sources',
      path: 'ws-1/biz-1/test.pdf.md',
      content: expect.any(Buffer),
      contentType: 'text/markdown; charset=utf-8',
      upsert: true,
    })

    // Embedder called with parsed content
    expect(embedder.embed).toHaveBeenCalled()

    // Document updated to indexed
    expect(updateDocSpy).toHaveBeenCalledWith(
      'ws-1',
      'doc-1',
      expect.objectContaining({
        processingStatus: 'indexed',
        embeddingModel: 'text-embedding-3-small',
        processedStoragePath: 'ws-1/biz-1/test.pdf.md',
      }),
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
    const storage = createMockStorage()
    const embedder = createMockEmbedder()

    const processor = new UploadedDocumentProcessor(repo, parser, storage, embedder)
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

    // No parsing, uploading, or embedding should happen
    expect(parser.parse).not.toHaveBeenCalled()
    expect(storage.upload).not.toHaveBeenCalled()
    expect(embedder.embed).not.toHaveBeenCalled()
    expect(updateDocSpy).not.toHaveBeenCalled()
  })

  it('uploads to ${storagePath}.md with upsert: true', async () => {
    const storage = createMockStorage()
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({
        ok: true,
        data: makeDoc({ storagePath: 'custom/path/doc.pdf' }),
      }),
      updateSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      replaceDocumentChunks: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    })
    const parser = createMockParser()
    const embedder = createMockEmbedder()

    const processor = new UploadedDocumentProcessor(repo, parser, storage, embedder)
    await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'custom/path/doc.pdf.md',
        upsert: true,
      }),
    )
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
    const storage = createMockStorage()
    const embedder = createMockEmbedder()

    const processor = new UploadedDocumentProcessor(repo, parser, storage, embedder)
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

    // Document marked as processing then failed
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

  it('marks failed on embed error', async () => {
    const updateDocSpy = vi.fn().mockResolvedValue({ ok: true, data: makeDoc() })
    const repo = createMockRepo({
      getSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: makeDoc() }),
      updateSourceDocument: updateDocSpy,
      replaceDocumentChunks: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    })
    const parser = createMockParser()
    const storage = createMockStorage()
    const embedder = createMockEmbedder({
      embed: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'EMBEDDING_FAILED', message: 'Embedding error' },
      }),
    })

    const processor = new UploadedDocumentProcessor(repo, parser, storage, embedder)
    const result = await processor.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EMBEDDING_FAILED')
    }

    // Document marked as processing then failed
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
    const storage = createMockStorage()
    const embedder = createMockEmbedder()

    const processor = new UploadedDocumentProcessor(repo, parser, storage, embedder)
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

    // Document marked as processing then failed
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
