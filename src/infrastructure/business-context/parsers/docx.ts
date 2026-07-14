import type { ServiceResult } from '@/core/business-context/types'
import type { ParsedDocument } from '@/core/business-context/document-parser.port'

const PARSER_NAME = 'native'
const PARSER_VERSION = '1.0.0'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export async function parseDocx(
  buffer: Buffer,
  fileName?: string,
): Promise<ServiceResult<ParsedDocument>> {
  try {
    const mammoth = (await import('mammoth'))
    const result = await mammoth.extractRawText({ buffer })

    const warnings: string[] = []
    if (result.messages.length > 0) {
      warnings.push(...result.messages.map((m) => `DOCX: ${m.message}`))
    }

    const contentText = result.value?.trim() ?? ''
    return {
      ok: true,
      data: {
        contentText,
        title: fileName?.replace(/\.docx$/i, '') ?? undefined,
        mimeType: DOCX_MIME,
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
        mimeType: DOCX_MIME,
        parserName: PARSER_NAME,
        parserVersion: PARSER_VERSION,
        warnings: ['DOCX text extraction failed'],
        metadata: {},
      },
    }
  }
}
