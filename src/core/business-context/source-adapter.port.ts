import type { ContextSource, ServiceResult, SourceType, JsonValue } from './types'

// ─── Collected source output ─────────────────────────────────────────────────

export interface CollectedSource {
  sourceType: SourceType
  sourceName: string
  externalReference: string | null
  metadata: Record<string, JsonValue>
  documents: CollectedDocument[]
}

export interface CollectedDocument {
  url?: string
  title?: string
  contentText: string
  mimeType?: string
  fileName?: string
  fileSizeBytes?: number
  pageOrSlideCount?: number
  httpStatus?: number
  metadata?: Record<string, JsonValue>
}

// ─── Source adapter port ─────────────────────────────────────────────────────

export interface SourceAdapterPort {
  /**
   * Returns true if this adapter handles the given source type.
   */
  supports(sourceType: SourceType): boolean

  /**
   * Collects evidence from the source. Called after a source is registered
   * and queued. Returns normalized documents ready for parsing/extraction.
   */
  collect(params: {
    workspaceId: string
    businessId: string
    source: ContextSource
  }): Promise<ServiceResult<CollectedSource>>
}
