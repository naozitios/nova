import type { RepositoryPort } from '../repository.port'
import type { DocumentParserPort } from '../document-parser.port'
import type { CanonicalDocumentIndexer } from './canonical-document-indexer'
import type { SourceFactPipeline, SourceFactPipelineDocument } from './source-fact-pipeline'
import type { ServiceResult, SourceType } from '../types'
import type { ContextFact } from '../types/entities'

export class UploadedDocumentProcessor {
  constructor(
    private readonly repo: RepositoryPort,
    private readonly parser: DocumentParserPort,
    private readonly indexer: CanonicalDocumentIndexer,
    private readonly factPipeline?: SourceFactPipeline,
  ) {}

  async process(params: {
    workspaceId: string
    businessId: string
    sourceId: string
    documentId: string
    runId?: string
    sessionId?: string
  }): Promise<ServiceResult<{ status: string; warnings: string[] }>> {
    const docResult = await this.repo.getSourceDocument(params.workspaceId, params.documentId)
    if (!docResult.ok) return docResult
    const doc = docResult.data
    if (!doc || doc.sourceId !== params.sourceId) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Document not found' } }
    }

    if (this.factPipeline) {
      if (
        doc.processingStatus === 'indexed'
        && doc.embeddingModel === this.indexer.model
        && doc.metadata.uploadFactProcessingCompleted === true
      ) {
        return { ok: true, data: { status: 'processed', warnings: [] } }
      }
    } else {
      if (doc.processingStatus === 'indexed' && doc.embeddingModel === this.indexer.model) {
        return { ok: true, data: { status: 'indexed', warnings: [] } }
      }
    }

    await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
      processingStatus: 'processing',
    })

    try {
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

      const processedStoragePath = `${doc.storagePath}.md`

      const indexResult = await this.indexer.index({
        workspaceId: params.workspaceId,
        businessId: params.businessId,
        documentId: doc.id,
        markdown,
        processedStoragePath,
        parserName: parseResult.data.parserName,
        parserVersion: parseResult.data.parserVersion,
        pageOrSlideCount: parseResult.data.pageOrSlideCount ?? null,
      })
      if (!indexResult.ok) return indexResult

      let finalStatus: 'indexed' | 'processed' | 'processed_with_warnings' = 'indexed'
      const warnings: string[] = []

      if (this.factPipeline) {
        const existingFactsResult = await this.repo.listContextFacts({
          workspaceId: params.workspaceId,
          businessId: params.businessId,
        })
        if (!existingFactsResult.ok) {
          await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
            processingStatus: 'failed',
          })
          return existingFactsResult
        }
        const existingFacts: ContextFact[] = existingFactsResult.data.items

        const pipelineDoc: SourceFactPipelineDocument = {
          sourceDocumentId: doc.id,
          contentText: markdown,
          parserName: parseResult.data.parserName,
        }

        const pipelineResult = await this.factPipeline.process({
          workspaceId: params.workspaceId,
          businessId: params.businessId,
          sourceId: params.sourceId,
          sourceType: 'upload' as SourceType,
          existingFacts,
          runId: params.runId ?? null,
          sessionId: params.sessionId ?? null,
          documents: [pipelineDoc],
        })

        if (pipelineResult.ok) {
          warnings.push(...pipelineResult.data.warnings)
          finalStatus = warnings.length > 0 ? 'processed_with_warnings' : 'processed'
        } else {
          await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
            processingStatus: 'failed',
          })
          return pipelineResult
        }
      }

      // DB constraint only allows document statuses through 'indexed'; store fact completion in metadata.
      if (finalStatus === 'processed' || finalStatus === 'processed_with_warnings') {
        const completedResult = await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
          metadata: {
            ...doc.metadata,
            uploadFactProcessingCompleted: true,
          },
        })
        if (!completedResult.ok) {
          // Best-effort mark failed; fact pipeline already ran — do not rerun.
          await this.repo.updateSourceDocument(params.workspaceId, doc.id, {
            processingStatus: 'failed',
          })
          return completedResult
        }
      }

      return { ok: true, data: { status: finalStatus, warnings } }
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
