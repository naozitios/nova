import type { RepositoryPort } from '../repository.port'
import type { EmbeddingPort } from '../embedding.port'
import type { UploadStoragePort } from '../upload-storage.port'
import type { JsonValue, ServiceResult } from '../types'
import { chunkMarkdown } from '../document-chunk'

export class CanonicalDocumentIndexer {
  constructor(
    private readonly storage: UploadStoragePort,
    private readonly embedder: EmbeddingPort,
    private readonly repo: RepositoryPort,
  ) {}

  get model(): string {
    return this.embedder.model
  }

  private async markFailed(workspaceId: string, documentId: string): Promise<void> {
    try {
      await this.repo.updateSourceDocument(workspaceId, documentId, {
        processingStatus: 'failed',
      })
    } catch {
      // best-effort status update — never mask original failure
    }
  }

  async index(params: {
    workspaceId: string
    businessId: string
    documentId: string
    markdown: string
    processedStoragePath: string
    parserName: string
    parserVersion: string
    pageOrSlideCount: number | null
    baseLocator?: Record<string, JsonValue>
  }): Promise<ServiceResult<{ processedStoragePath: string; chunkCount: number }>> {
    try {
      const bucket = 'business-context-sources'

      const uploadResult = await this.storage.upload({
        bucket,
        path: params.processedStoragePath,
        content: Buffer.from(params.markdown, 'utf-8'),
        contentType: 'text/markdown; charset=utf-8',
        upsert: true,
      })
      if (!uploadResult.ok) {
        await this.markFailed(params.workspaceId, params.documentId)
        return uploadResult
      }

      const chunks = chunkMarkdown(params.markdown)
      const texts = chunks.map(c => c.content)
      const embedResult = await this.embedder.embed(texts)
      if (!embedResult.ok) {
        await this.markFailed(params.workspaceId, params.documentId)
        return embedResult
      }

      if (embedResult.data.length !== chunks.length) {
        await this.markFailed(params.workspaceId, params.documentId)
        return { ok: false, error: { code: 'INDEXING_FAILED', message: 'Embedding result count mismatch' } }
      }

      const chunkDrafts = chunks.map((chunk, idx) => {
        const locator = params.baseLocator
          ? { ...chunk.locator, ...params.baseLocator }
          : chunk.locator as Record<string, JsonValue>
        return {
          chunkIndex: chunk.chunkIndex,
          headingPath: chunk.headingPath,
          content: chunk.content,
          locator,
          embedding: embedResult.data[idx],
          embeddingModel: this.embedder.model,
        }
      })
      const replaceResult = await this.repo.replaceDocumentChunks(
        params.workspaceId,
        params.businessId,
        params.documentId,
        chunkDrafts,
      )
      if (!replaceResult.ok) {
        await this.markFailed(params.workspaceId, params.documentId)
        return replaceResult
      }

      const updateResult = await this.repo.updateSourceDocument(params.workspaceId, params.documentId, {
        processedStoragePath: params.processedStoragePath,
        processingStatus: 'indexed',
        embeddingModel: this.embedder.model,
        indexedAt: new Date(),
        contentText: params.markdown,
        pageOrSlideCount: params.pageOrSlideCount,
        parserName: params.parserName,
        parserVersion: params.parserVersion,
      })
      if (!updateResult.ok) {
        await this.markFailed(params.workspaceId, params.documentId)
        return updateResult
      }

      return { ok: true, data: { processedStoragePath: params.processedStoragePath, chunkCount: chunks.length } }
    } catch (error) {
      await this.markFailed(params.workspaceId, params.documentId)
      return {
        ok: false,
        error: { code: 'INDEXING_FAILED', message: error instanceof Error ? error.message : 'Unknown error' },
      }
    }
  }
}
