import type {
  ContextSource,
  JsonValue,
  ServiceResult,
  SourceDocument,
} from '../types'
import type { PaginationParams } from './repository.port'

export interface SourceFilter {
  workspaceId: string
  businessId: string
  sourceType?: string
  status?: string
  currentStage?: string
}

export interface SourceDocumentFilter {
  workspaceId: string
  businessId: string
  sourceId?: string
  contentHash?: string
}

export interface SourceRepositoryPort {
  createContextSource(
    data: Omit<ContextSource, 'id'>,
  ): Promise<ServiceResult<ContextSource>>

  getContextSource(
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextSource | null>>

  listContextSources(
    filter: SourceFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextSource[]; total: number }>>

  updateContextSource(
    workspaceId: string,
    sourceId: string,
    data: Partial<
      Pick<
        ContextSource,
        | 'status'
        | 'currentStage'
        | 'terminalOutcome'
        | 'metadata'
        | 'sourceName'
      >
    >,
  ): Promise<ServiceResult<ContextSource>>

  createSourceDocument(
    data: Omit<SourceDocument, 'id'>,
  ): Promise<ServiceResult<SourceDocument>>

  getSourceDocument(
    workspaceId: string,
    documentId: string,
  ): Promise<ServiceResult<SourceDocument | null>>

  listSourceDocuments(
    filter: SourceDocumentFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: SourceDocument[]; total: number }>>

  getSourceDocumentByHash(
    businessId: string,
    contentHash: string,
  ): Promise<ServiceResult<SourceDocument | null>>

  updateSourceDocument(
    workspaceId: string,
    documentId: string,
    data: Partial<Pick<SourceDocument,
      | 'metadata'
      | 'storagePath'
      | 'processedStoragePath'
      | 'processingStatus'
      | 'embeddingModel'
      | 'indexedAt'
      | 'contentText'
      | 'pageOrSlideCount'
      | 'parserName'
      | 'parserVersion'
    >>,
  ): Promise<ServiceResult<SourceDocument>>

  replaceDocumentChunks(
    workspaceId: string,
    businessId: string,
    documentId: string,
    chunks: Array<{
      chunkIndex: number
      headingPath: string[]
      content: string
      locator: Record<string, JsonValue>
      embedding: number[]
      embeddingModel: string
    }>,
  ): Promise<ServiceResult<void>>

  archiveSource(
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextSource | null>>
}
