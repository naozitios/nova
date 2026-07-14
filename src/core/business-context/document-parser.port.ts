import type { ServiceResult } from './types'

// ─── Parse result ────────────────────────────────────────────────────────────

export interface ParsedDocument {
  contentText: string
  title?: string
  mimeType?: string
  pageOrSlideCount?: number
  parserName: string
  parserVersion: string
  warnings: string[]
  metadata: Record<string, unknown>
}

// ─── Document parser port ────────────────────────────────────────────────────

export interface DocumentParserPort {
  /**
   * Returns true if this parser can handle the given MIME type.
   */
  supports(mimeType: string): boolean

  /**
   * Parse a stored source document into normalized markdown/text.
   * For files stored in Supabase Storage, the caller provides the storage path
   * and the parser reads from Storage internally (infrastructure concern).
   */
  parse(params: {
    storagePath: string
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>>

  /**
   * Parse content that is already in memory (e.g. crawled HTML from a website
   * source that was already fetched).
   */
  parseContent(params: {
    content: Buffer
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>>
}
