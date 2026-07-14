import type { ServiceResult } from '@/core/business-context/types'
import type {
  DocumentParserPort,
  ParsedDocument,
} from '@/core/business-context/document-parser.port'
import { getSupabaseServiceClient } from './supabase-client'
import { config } from '@/infrastructure/config'

// ─── Supported MIME types ───────────────────────────────────────────────────

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/html',
  'text/plain',
])

// ─── Parser version ─────────────────────────────────────────────────────────

const PARSER_NAME = 'native'
const PARSER_VERSION = '1.0.0'

// ─── Adapter ────────────────────────────────────────────────────────────────

export class NativeDocumentParserAdapter implements DocumentParserPort {
  supports(mimeType: string): boolean {
    return SUPPORTED_MIME_TYPES.has(mimeType)
  }

  async parse(params: {
    storagePath: string
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    const { storagePath, mimeType, fileName } = params

    try {
      const buffer = await this.downloadFromStorage(storagePath)
      return this.parseContent({ content: buffer, mimeType, fileName })
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'PARSE_FAILED',
          message: `Failed to download or parse file: ${error instanceof Error ? error.message : String(error)}`,
        },
      }
    }
  }

  async parseContent(params: {
    content: Buffer
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    const { content, mimeType, fileName } = params

    try {
      switch (mimeType) {
        case 'application/pdf':
          return this.parsePdf(content)
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          return this.parseDocx(content, fileName)
        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
          return this.parseXlsx(content, fileName)
        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
          return this.parsePptx(content, fileName)
        case 'text/html':
          return this.parseHtml(content)
        case 'text/plain':
          return this.parsePlainText(content)
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

  // ─── PDF parsing ──────────────────────────────────────────────────────

  private async parsePdf(buffer: Buffer): Promise<ServiceResult<ParsedDocument>> {
    // Use pdf-parse for text extraction
    try {
      const pdfParseModule = await import('pdf-parse')
      const pdfParse: (buffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }> =
        (pdfParseModule as any).default ?? (pdfParseModule as any)
      const result = await pdfParse(buffer)

      const warnings: string[] = []
      if (result.numpages === 0) {
        warnings.push('PDF has zero pages')
      }

      const contentText = result.text?.trim() ?? ''
      if (!contentText) {
        warnings.push('PDF extraction produced no text content - may need OCR')
      }

      return {
        ok: true,
        data: {
          contentText,
          title: (result.info?.Title as string) ?? undefined,
          mimeType: 'application/pdf',
          pageOrSlideCount: result.numpages,
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings,
          metadata: {
            pdfInfo: result.info ?? {},
          },
        },
      }
    } catch {
      // Fallback: return empty with warning
      return {
        ok: true,
        data: {
          contentText: '',
          mimeType: 'application/pdf',
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings: [
            'PDF text extraction failed - file may be scanned/image-based, needs OCR',
          ],
          metadata: {},
        },
      }
    }
  }

  // ─── DOCX parsing ────────────────────────────────────────────────────

  private async parseDocx(buffer: Buffer, fileName?: string): Promise<ServiceResult<ParsedDocument>> {
    try {
      const mammoth = (await import('mammoth'))
      const result = await mammoth.extractRawText({ buffer })

      const warnings: string[] = []
      if (result.messages.length > 0) {
        warnings.push(
          ...result.messages.map((m) => `DOCX: ${m.message}`),
        )
      }

      const contentText = result.value?.trim() ?? ''
      return {
        ok: true,
        data: {
          contentText,
          title: fileName?.replace(/\.docx$/i, '') ?? undefined,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings,
          metadata: {},
        },
      }
    } catch {
      return {
        ok: true,
        data: {
          contentText: '',
          title: fileName?.replace(/\.docx$/i, '') ?? undefined,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings: ['DOCX text extraction failed'],
          metadata: {},
        },
      }
    }
  }

  // ─── XLSX parsing ────────────────────────────────────────────────────

  private async parseXlsx(buffer: Buffer, fileName?: string): Promise<ServiceResult<ParsedDocument>> {
    try {
      const XLSX = (await import('xlsx'))
      const workbook = XLSX.read(buffer, { type: 'buffer' })

      const warnings: string[] = []
      const sheets: string[] = []

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) continue

        const csv = XLSX.utils.sheet_to_csv(sheet)
        if (csv.trim()) {
          sheets.push(`## ${sheetName}\n\n${csv}`)
        } else {
          warnings.push(`Sheet "${sheetName}" is empty`)
        }
      }

      const contentText = sheets.join('\n\n---\n\n')

      return {
        ok: true,
        data: {
          contentText,
          title: fileName?.replace(/\.xlsx$/i, '') ?? undefined,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings,
          metadata: {
            sheetNames: workbook.SheetNames,
          },
        },
      }
    } catch {
      return {
        ok: true,
        data: {
          contentText: '',
          title: fileName?.replace(/\.xlsx$/i, '') ?? undefined,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings: ['XLSX text extraction failed'],
          metadata: {},
        },
      }
    }
  }

  // ─── PPTX parsing ────────────────────────────────────────────────────

  private async parsePptx(buffer: Buffer, fileName?: string): Promise<ServiceResult<ParsedDocument>> {
    try {
      const JSZip = (await import('jszip'))
      const zip = await JSZip.loadAsync(buffer)

      const warnings: string[] = []
      const slides: string[] = []
      let slideCount = 0

      const slideFiles = Object.keys(zip.files)
        .filter((name) => name.match(/^ppt\/slides\/slide\d+\.xml$/))
        .sort()

      for (const slideFile of slideFiles) {
        slideCount++
        const slideXml = await zip.files[slideFile].async('string')

        // Extract text content from XML (simple extraction)
        const texts = slideXml
          .match(/<a:t[^>]*>([^<]*)<\/a:t>/g)
          ?.map((t) => t.replace(/<[^>]*>/g, '').trim())
          .filter(Boolean) ?? []

        if (texts.length > 0) {
          slides.push(`### Slide ${slideCount}\n\n${texts.join('\n')}`)
        } else {
          warnings.push(`Slide ${slideCount} has no extractable text - may need OCR`)
        }
      }

      const contentText = slides.join('\n\n')

      return {
        ok: true,
        data: {
          contentText,
          title: fileName?.replace(/\.pptx$/i, '') ?? undefined,
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          pageOrSlideCount: slideCount || undefined,
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings,
          metadata: {},
        },
      }
    } catch {
      return {
        ok: true,
        data: {
          contentText: '',
          title: fileName?.replace(/\.pptx$/i, '') ?? undefined,
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings: ['PPTX text extraction failed'],
          metadata: {},
        },
      }
    }
  }

  // ─── HTML parsing ────────────────────────────────────────────────────

  private async parseHtml(buffer: Buffer): Promise<ServiceResult<ParsedDocument>> {
    try {
      const htmlToTextModule = await import('html-to-text') as any
      const htmlToText: (html: string, opts?: Record<string, unknown>) => string = htmlToTextModule.convert
      const html = buffer.toString('utf-8')
      const text = htmlToText(html, {
        wordwrap: false,
        selectors: [
          { selector: 'script', options: { skipLength: true } },
          { selector: 'style', options: { skipLength: true } },
          { selector: 'nav', options: { skipLength: true } },
          { selector: 'footer', options: { skipLength: true } },
          { selector: 'header', options: { skipLength: true } },
        ],
      })

      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
      const title = titleMatch?.[1]?.trim()

      return {
        ok: true,
        data: {
          contentText: text.trim(),
          title: title ?? undefined,
          mimeType: 'text/html',
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings: [],
          metadata: {},
        },
      }
    } catch {
      return {
        ok: true,
        data: {
          contentText: buffer.toString('utf-8'),
          mimeType: 'text/html',
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings: ['HTML-to-text conversion failed, returned raw HTML'],
          metadata: {},
        },
      }
    }
  }

  // ─── Plain text parsing ───────────────────────────────────────────────

  private async parsePlainText(buffer: Buffer): Promise<ServiceResult<ParsedDocument>> {
    return {
      ok: true,
      data: {
        contentText: buffer.toString('utf-8').trim(),
        mimeType: 'text/plain',
        parserName: PARSER_NAME,
        parserVersion: PARSER_VERSION,
        warnings: [],
        metadata: {},
      },
    }
  }

  // ─── Storage download ─────────────────────────────────────────────────

  private async downloadFromStorage(storagePath: string): Promise<Buffer> {
    const client = getSupabaseServiceClient()
    const { data, error } = await client.storage
      .from(config.businessContext.storageSourceBucket)
      .download(storagePath)

    if (error) {
      throw new Error(`Storage download failed: ${error.message}`)
    }

    return Buffer.from(await data.arrayBuffer())
  }
}
