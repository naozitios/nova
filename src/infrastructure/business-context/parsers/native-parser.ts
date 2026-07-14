import type { ServiceResult } from '@/core/business-context/types'
import type { ParsedDocument } from '@/core/business-context/document-parser.port'
import { parsePdf } from './pdf'
import { parseDocx } from './docx'
import { parseXlsx } from './xlsx'
import { parsePptx } from './pptx'
import { parseHtml, parsePlainText } from './html'

// ─── Supported MIME types ───────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/html',
  'text/plain',
])

// ─── Facade ─────────────────────────────────────────────────────────────────

export class NativeDocumentParser {
  supports(mimeType: string): boolean {
    return SUPPORTED_MIME_TYPES.has(mimeType)
  }

  async route(params: {
    content: Buffer
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    const { content, mimeType, fileName } = params

    try {
      switch (mimeType) {
        case 'application/pdf':
          return await parsePdf(content)
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return await parseDocx(content, fileName)
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          return await parseXlsx(content, fileName)
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          return await parsePptx(content, fileName)
        case 'text/html':
          return await parseHtml(content)
        case 'text/plain':
          return await parsePlainText(content)
        default:
          return {
            ok: false,
            error: {
              code: 'UNSUPPORTED_MIME',
              message: `Native parser does not support MIME type: ${mimeType}`,
            },
          }
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'PARSE_FAILED',
          message: `Parse error for ${mimeType}: ${error instanceof Error ? error.message : String(error)}`,
        },
      }
    }
  }
}
