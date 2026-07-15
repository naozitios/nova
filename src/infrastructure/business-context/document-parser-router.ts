import type { ServiceResult } from '@/core/business-context/types'
import type {
  DocumentParserPort,
  ParsedDocument,
} from '@/core/business-context/document-parser.port'

// ─── MIME type classification ───────────────────────────────────────────────

type MimeCategory = 'text' | 'image' | 'scanned' | 'unknown'

const MIME_CATEGORY_MAP: Record<string, MimeCategory> = {
  // Text-based (native parser handles)
  'application/pdf': 'text', // could be scanned, but try native first
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'text',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'text',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'text',
  'text/html': 'text',
  'text/plain': 'text',
  // Image-based (OCR required)
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/tiff': 'image',
  'image/bmp': 'image',
}

function classifyMime(mimeType: string): MimeCategory {
  return MIME_CATEGORY_MAP[mimeType] ?? 'unknown'
}

// ─── Router ─────────────────────────────────────────────────────────────────

export interface DocumentParserRouterConfig {
  /** Skip native parser and go straight to OCR for these MIME types */
  forceOcrMimeTypes?: Set<string>
  /** Skip OCR and use only native parser for these MIME types */
  nativeOnlyMimeTypes?: Set<string>
}

export class DocumentParserRouter {
  private nativeParser: DocumentParserPort
  private ocrParser: DocumentParserPort
  private config: DocumentParserRouterConfig

  constructor(
    nativeParser: DocumentParserPort,
    ocrParser: DocumentParserPort,
    config?: DocumentParserRouterConfig,
  ) {
    this.nativeParser = nativeParser
    this.ocrParser = ocrParser
    this.config = {
      forceOcrMimeTypes: config?.forceOcrMimeTypes ?? new Set(['image/png', 'image/jpeg', 'image/webp', 'image/tiff']),
      nativeOnlyMimeTypes: config?.nativeOnlyMimeTypes ?? new Set(['text/html', 'text/plain']),
      ...config,
    }
  }

  /** Returns true if at least one sub-parser can handle this MIME type. */
  supports(mimeType: string): boolean {
    return this.nativeParser.supports(mimeType) || this.ocrParser.supports(mimeType)
  }

  /**
   * Route parsing: native-first, OCR fallback, image-default-OCR.
   * Merges results without duplicate text when both parsers run.
   */
  async parse(params: {
    storagePath: string
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    const { storagePath, mimeType, fileName } = params

    // Check if native parser supports this MIME type
    const nativeSupported = this.nativeParser.supports(mimeType)
    const ocrSupported = this.ocrParser.supports(mimeType)
    const category = classifyMime(mimeType)

    // Force OCR for image types and explicitly forced MIME types
    if (this.config.forceOcrMimeTypes?.has(mimeType) || category === 'image') {
      if (!ocrSupported) {
        return {
          ok: false,
          error: {
            code: 'UNSUPPORTED_MIME',
            message: `No parser available for MIME type: ${mimeType}`,
          },
        }
      }
      return this.ocrParser.parse({ storagePath, mimeType, fileName })
    }

    // Native-only for text types
    if (this.config.nativeOnlyMimeTypes?.has(mimeType) || (!ocrSupported && nativeSupported)) {
      return this.nativeParser.parse({ storagePath, mimeType, fileName })
    }

    // Try native first
    if (nativeSupported) {
      const nativeResult = await this.nativeParser.parse({ storagePath, mimeType, fileName })

      if (nativeResult.ok) {
        // Check if native result is empty or has low content - might need OCR fallback
        const hasContent = nativeResult.data.contentText.trim().length > 0
        const hasWarnings = nativeResult.data.warnings.some((w) =>
          w.includes('needs OCR') || w.includes('no extractable text'),
        )

        if (!hasContent || hasWarnings) {
          // Fallback to OCR
          if (ocrSupported) {
            const ocrResult = await this.ocrParser.parse({ storagePath, mimeType, fileName })
            if (ocrResult.ok) {
              return { ok: true, data: this.mergeResults(nativeResult.data, ocrResult.data) }
            }
          }
        }

        return nativeResult
      }
    }

    // Native not supported or failed, try OCR
    if (ocrSupported) {
      return this.ocrParser.parse({ storagePath, mimeType, fileName })
    }

    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_MIME',
        message: `No parser available for MIME type: ${mimeType}`,
      },
    }
  }

  /**
   * Parse content already in memory (e.g., crawled HTML).
   * Only routes to native parser since OCR needs file storage.
   */
  async parseContent(params: {
    content: Buffer
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    const { content, mimeType, fileName } = params

    if (this.nativeParser.supports(mimeType)) {
      return this.nativeParser.parseContent({ content, mimeType, fileName })
    }

    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_MIME',
        message: `No parser available for in-memory content with MIME type: ${mimeType}`,
      },
    }
  }

  /**
   * Merge native and OCR results. Native content takes priority,
   * OCR fills gaps. Deduplicates overlapping text.
   */
  private mergeResults(
    native: ParsedDocument,
    ocr: ParsedDocument,
  ): ParsedDocument {
    // Use native content if it has substantial text, supplement with OCR
    const nativeText = native.contentText.trim()
    const ocrText = ocr.contentText.trim()

    let mergedText: string
    if (nativeText.length > 0 && ocrText.length > 0) {
      // Both have content - use native as primary, append OCR for missing pages
      mergedText = nativeText
      // Only append OCR text if it contains unique content not in native
      const ocrUniqueLines = ocrText
        .split('\n')
        .filter((line) => line.trim().length > 0 && !nativeText.includes(line.trim()))

      if (ocrUniqueLines.length > 0) {
        mergedText += '\n\n---\n\n### OCR Supplement\n\n' + ocrUniqueLines.join('\n')
      }
    } else {
      mergedText = nativeText || ocrText
    }

    // Merge warnings without duplicates
    const allWarnings = [...new Set([...native.warnings, ...ocr.warnings])]

    // Merge metadata
    const mergedMetadata: Record<string, unknown> = {
      ...native.metadata,
      ...ocr.metadata,
      mergedFrom: ['native', 'ocr'],
    }

    return {
      contentText: mergedText,
      title: native.title ?? ocr.title,
      mimeType: native.mimeType ?? ocr.mimeType,
      pageOrSlideCount: native.pageOrSlideCount ?? ocr.pageOrSlideCount,
      parserName: 'router',
      parserVersion: '1.0.0',
      warnings: allWarnings,
      metadata: mergedMetadata,
    }
  }
}
