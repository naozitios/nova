import type { ServiceResult } from '@/core/business-context/types'
import type { ParsedDocument } from '@/core/business-context/document-parser.port'

const PARSER_NAME = 'native'
const PARSER_VERSION = '1.0.0'

export async function parsePdf(buffer: Buffer): Promise<ServiceResult<ParsedDocument>> {
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
