import type { ContextSource, SourceDocument } from '@/core/business-context/types'
import { asJsonRecord, type Row } from './helpers'

export function mapContextSource(r: Row): ContextSource {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    sourceType: r.source_type as ContextSource['sourceType'],
    sourceName: r.source_name as string,
    externalReference: (r.external_reference as string) ?? null,
    status: r.status as string,
    currentStage: (r.current_stage as ContextSource['currentStage']) ?? null,
    terminalOutcome: (r.terminal_outcome as ContextSource['terminalOutcome']) ?? null,
    metadata: asJsonRecord(r.metadata),
    collectedAt: new Date(r.collected_at as string),
  }
}

export function mapSourceDocument(r: Row): SourceDocument {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    businessId: r.business_id as string,
    sourceId: r.source_id as string,
    url: (r.url as string) ?? null,
    title: (r.title as string) ?? null,
    documentType: (r.document_type as string) ?? null,
    mimeType: (r.mime_type as string) ?? null,
    fileName: (r.file_name as string) ?? null,
    fileSizeBytes: r.file_size_bytes != null ? Number(r.file_size_bytes) : null,
    contentText: (r.content_text as string) ?? null,
    storagePath: (r.storage_path as string) ?? null,
    processedStoragePath: (r.processed_storage_path as string) ?? null,
    processingStatus: (r.processing_status as SourceDocument['processingStatus']) ?? 'pending',
    embeddingModel: (r.embedding_model as string) ?? null,
    indexedAt: r.indexed_at ? new Date(r.indexed_at as string) : null,
    contentHash: r.content_hash as string,
    httpStatus: r.http_status != null ? Number(r.http_status) : null,
    pageOrSlideCount: r.page_or_slide_count != null ? Number(r.page_or_slide_count) : null,
    parserName: (r.parser_name as string) ?? null,
    parserVersion: (r.parser_version as string) ?? null,
    effectiveAt: r.effective_at ? new Date(r.effective_at as string) : null,
    supersedesDocumentId: (r.supersedes_document_id as string) ?? null,
    processedStoragePath: (r.processed_storage_path as string) ?? null,
    processingStatus: (r.processing_status as SourceDocument['processingStatus']) ?? 'pending',
    embeddingModel: (r.embedding_model as string) ?? null,
    indexedAt: r.indexed_at ? new Date(r.indexed_at as string) : null,
    metadata: asJsonRecord(r.metadata),
    retrievedAt: new Date(r.retrieved_at as string),
  }
}
