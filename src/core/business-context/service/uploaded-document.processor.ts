import type { RepositoryPort } from '../repository.port'
import type { DocumentParserPort } from '../document-parser.port'
import type { EmbeddingPort } from '../embedding.port'
import type { UploadStoragePort } from '../upload-storage.port'
import type { ServiceResult } from '../types'
import { chunkMarkdown } from '../document-chunk'

export class UploadedDocumentProcessor {
  constructor(
    private readonly repo: RepositoryPort,
    private readonly parser: DocumentParserPort,
    private readonly storage: UploadStoragePort,
    private readonly embedder: EmbeddingPort
  ) {}

  async process(params: {
    workspaceId: string
    businessId: string
    sourceId: string
    documentId: string
  }): Promise<ServiceResult<{ status: string; warnings: string[] }>> {
    // 1. Get document row
    const docResult = await this.repo.getSourceDocument(params.workspaceId, params.documentId)
    if (!docResult.ok) return docResult
    const doc = docResult.data
    if (!doc || doc.sourceId !== params.sourceId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }
    }

    // 2. Idempotency: if already indexed with same model, return success
    if (doc.processingStatus === 'indexed' && doc.embeddingModel === this.embedder.model) {
      return { ok: true, data: { status: 'indexed', warnings: [] } }
    }

    // 3. Mark processing
    await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
      processingStatus: 'processing',
    })

    try {
      // 4. Parse original via Docling
      if (!doc.storagePath || !doc.mimeType) {
        throw new Error('Missing storagePath or mimeType')
      }
      const parseResult = await this.parser.parse({
        storagePath: doc.storagePath,
        mimeType: doc.mimeType,
        fileName: doc.fileName ?? undefined,
      })
      if (!parseResult.ok) {
        await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
          processingStatus: 'failed',
        })
        return parseResult
      }
      const markdown = parseResult.data.contentText

      // 5. Upload deterministic Markdown artifact
      const processedPath = `${doc.storagePath}.md`
      const bucket = 'business-context-sources'
      const uploadResult = await this.storage.upload({
        bucket,
        path: processedPath,
        content: Buffer.from(markdown, 'utf-8'),
        contentType: 'text/markdown; charset=utf-8',
        upsert: true,
      })
      if (!uploadResult.ok) {
        await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
          processingStatus: 'failed',
        })
        return uploadResult
      }

      // 6. Chunk markdown
      const chunks = chunkMarkdown(markdown)

      // 7. Embed chunks
      const texts = chunks.map(c => c.content)
      const embedResult = await this.embedder.embed(texts)
      if (!embedResult.ok) {
        await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
          processingStatus: 'failed',
        })
        return embedResult
      }

      // 8. Replace chunks
      const chunkDrafts = chunks.map((chunk, idx) => ({
        chunkIndex: chunk.chunkIndex,
        headingPath: chunk.headingPath,
        content: chunk.content,
        locator: chunk.locator as Record<string, any>,
        embedding: embedResult.data[idx],
        embeddingModel: this.embedder.model,
      }))
      const replaceResult = await this.repo.replaceDocumentChunks(
        params.workspaceId,
        params.businessId,
        doc.id,
        chunkDrafts
      )
      if (!replaceResult.ok) {
        await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
          processingStatus: 'failed',
        })
        return replaceResult
      }

      // 9. Update document with processed fields
      await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
        processedStoragePath: processedPath,
        processingStatus: 'indexed',
        embeddingModel: this.embedder.model,
        indexedAt: new Date(),
        contentText: markdown,
        pageOrSlideCount: parseResult.data.pageOrSlideCount ?? null,
        parserName: parseResult.data.parserName,
        parserVersion: parseResult.data.parserVersion,
      })

      return { ok: true, data: { status: 'indexed', warnings: [] } }
    } catch (error) {
      await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
        processingStatus: 'failed',
      })
      return {
        ok: false,
        error: { code: 'PROCESSING_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
      }
    }
  }
}
