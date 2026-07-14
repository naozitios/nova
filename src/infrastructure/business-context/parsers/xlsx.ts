import type { ServiceResult } from '@/core/business-context/types'
import type { ParsedDocument } from '@/core/business-context/document-parser.port'

const PARSER_NAME = 'native'
const PARSER_VERSION = '1.0.0'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

export async function parseXlsx(
  buffer: Buffer,
  fileName?: string,
): Promise<ServiceResult<ParsedDocument>> {
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
        mimeType: XLSX_MIME,
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
        mimeType: XLSX_MIME,
        parserName: PARSER_NAME,
        parserVersion: PARSER_VERSION,
        warnings: ['XLSX text extraction failed'],
        metadata: {},
      },
    }
  }
}
