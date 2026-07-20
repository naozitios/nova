import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ContextSource,
  JsonValue,
  ServiceResult,
  SourceDocument,
} from '@/core/business-context/types'
import type {
  PaginationParams,
  SourceDocumentFilter,
  SourceFilter,
} from '@/core/business-context/repository.port'
import {
  err,
  mapContextSource,
  mapSourceDocument,
} from './_shared'

// ─── ContextSource + SourceDocument ─────────────────────────────────────────

export class SourceRepository {
  constructor(private db: SupabaseClient) {}

  // ── Context sources ──────────────────────────────────────────────────────

  async createContextSource(
    data: Omit<ContextSource, 'id'>,
  ): Promise<ServiceResult<ContextSource>> {
    const { data: row, error } = await this.db
      .from('context_sources')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        source_type: data.sourceType,
        source_name: data.sourceName,
        external_reference: data.externalReference,
        status: data.status,
        current_stage: data.currentStage,
        terminal_outcome: data.terminalOutcome,
        metadata: data.metadata,
        collected_at: data.collectedAt.toISOString(),
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapContextSource(row) }
  }

  async getContextSource(
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextSource | null>> {
    const { data, error } = await this.db
      .from('context_sources')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', sourceId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapContextSource(data) : null }
  }

  async listContextSources(
    filter: SourceFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: ContextSource[]; total: number }>> {
    let query = this.db
      .from('context_sources')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.sourceType) query = query.eq('source_type', filter.sourceType)
    if (filter.status) query = query.eq('status', filter.status)
    if (filter.currentStage) query = query.eq('current_stage', filter.currentStage)

    query = query.order('collected_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapContextSource), total: count ?? 0 },
    }
  }

  async updateContextSource(
    workspaceId: string,
    sourceId: string,
    data: Partial<Pick<ContextSource, 'status' | 'currentStage' | 'terminalOutcome' | 'metadata' | 'sourceName'>>,
  ): Promise<ServiceResult<ContextSource>> {
    const update: Record<string, unknown> = {}
    if (data.status !== undefined) update.status = data.status
    if (data.currentStage !== undefined) update.current_stage = data.currentStage
    if (data.terminalOutcome !== undefined) update.terminal_outcome = data.terminalOutcome
    if (data.metadata !== undefined) update.metadata = data.metadata
    if (data.sourceName !== undefined) update.source_name = data.sourceName

    const { data: row, error } = await this.db
      .from('context_sources')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', sourceId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapContextSource(row) }
  }

  // ── Source documents ─────────────────────────────────────────────────────

  async createSourceDocument(
    data: Omit<SourceDocument, 'id'>,
  ): Promise<ServiceResult<SourceDocument>> {
    const { data: row, error } = await this.db
      .from('source_documents')
      .insert({
        workspace_id: data.workspaceId,
        business_id: data.businessId,
        source_id: data.sourceId,
        url: data.url,
        title: data.title,
        document_type: data.documentType,
        mime_type: data.mimeType,
        file_name: data.fileName,
        file_size_bytes: data.fileSizeBytes,
        content_text: data.contentText,
        storage_path: data.storagePath,
        content_hash: data.contentHash,
        http_status: data.httpStatus,
        page_or_slide_count: data.pageOrSlideCount,
        parser_name: data.parserName,
        parser_version: data.parserVersion,
        effective_at: data.effectiveAt?.toISOString() ?? null,
        supersedes_document_id: data.supersedesDocumentId,
        metadata: data.metadata,
        retrieved_at: data.retrievedAt.toISOString(),
      })
      .select()
      .single()

    if (error) return err('CREATE_FAILED', error.message)
    return { ok: true, data: mapSourceDocument(row) }
  }

  async getSourceDocument(
    workspaceId: string,
    documentId: string,
  ): Promise<ServiceResult<SourceDocument | null>> {
    const { data, error } = await this.db
      .from('source_documents')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('id', documentId)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapSourceDocument(data) : null }
  }

  async listSourceDocuments(
    filter: SourceDocumentFilter,
    pagination?: PaginationParams,
  ): Promise<ServiceResult<{ items: SourceDocument[]; total: number }>> {
    let query = this.db
      .from('source_documents')
      .select('*', { count: 'exact' })
      .eq('workspace_id', filter.workspaceId)
      .eq('business_id', filter.businessId)

    if (filter.sourceId) query = query.eq('source_id', filter.sourceId)
    if (filter.contentHash) query = query.eq('content_hash', filter.contentHash)

    query = query.order('retrieved_at', { ascending: false })

    if (pagination) {
      query = query.range(pagination.offset, pagination.offset + pagination.limit - 1)
    }

    const { data, error, count } = await query
    if (error) return err('LIST_FAILED', error.message)
    return {
      ok: true,
      data: { items: (data ?? []).map(mapSourceDocument), total: count ?? 0 },
    }
  }

  async getSourceDocumentByHash(
    businessId: string,
    contentHash: string,
  ): Promise<ServiceResult<SourceDocument | null>> {
    const { data, error } = await this.db
      .from('source_documents')
      .select('*')
      .eq('business_id', businessId)
      .eq('content_hash', contentHash)
      .single()

    if (error && error.code !== 'PGRST116') return err('READ_FAILED', error.message)
    return { ok: true, data: data ? mapSourceDocument(data) : null }
  }

  async updateSourceDocument(
    workspaceId: string,
    documentId: string,
    data: Partial<Pick<SourceDocument, 'metadata' | 'storagePath'>>,
  ): Promise<ServiceResult<SourceDocument>> {
    const update: Record<string, unknown> = {}
    if (data.metadata !== undefined) update.metadata = data.metadata
    if (data.storagePath !== undefined) update.storage_path = data.storagePath

    const { data: row, error } = await this.db
      .from('source_documents')
      .update(update)
      .eq('workspace_id', workspaceId)
      .eq('id', documentId)
      .select()
      .single()

    if (error) return err('UPDATE_FAILED', error.message)
    return { ok: true, data: mapSourceDocument(row) }
  }

  async archiveSource(
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextSource | null>> {
    const { data, error } = await this.db
      .from('context_sources')
      .update({ status: 'archived', terminal_outcome: 'archived' })
      .eq('workspace_id', workspaceId)
      .eq('id', sourceId)
      .neq('status', 'archived')
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return { ok: true, data: null }
      return err('ARCHIVE_FAILED', error.message)
    }
    return { ok: true, data: mapContextSource(data) }
  }

  async replaceDocumentChunks(
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
  ): Promise<ServiceResult<void>> {
    // Set processing status
    const { error: statusErr } = await this.db
      .from('source_documents')
      .update({ processing_status: 'processing' })
      .eq('workspace_id', workspaceId)
      .eq('id', documentId)

    if (statusErr) return err('UPDATE_FAILED', statusErr.message)

    // Delete existing chunks for this document
    const { error: deleteErr } = await this.db
      .from('document_chunks')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('source_document_id', documentId)

    if (deleteErr) return err('DELETE_FAILED', deleteErr.message)

    // Insert new chunks
    if (chunks.length > 0) {
      const rows = chunks.map((c) => ({
        workspace_id: workspaceId,
        business_id: businessId,
        source_document_id: documentId,
        chunk_index: c.chunkIndex,
        heading_path: c.headingPath,
        content: c.content,
        locator: c.locator,
        embedding: c.embedding,
        embedding_model: c.embeddingModel,
      }))

      const { error: insertErr } = await this.db
        .from('document_chunks')
        .insert(rows)

      if (insertErr) return err('INSERT_FAILED', insertErr.message)
    }

    return { ok: true, data: undefined }
  }
}
