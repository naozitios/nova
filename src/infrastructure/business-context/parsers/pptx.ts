import type { ServiceResult } from '@/core/business-context/types'
import type { ParsedDocument } from '@/core/business-context/document-parser.port'

const PARSER_NAME = 'native'
const PARSER_VERSION = '1.0.0'

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

export async function parsePptx(
  buffer: Buffer,
  fileName?: string,
): Promise<ServiceResult<ParsedDocument>> {
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

      const texts =
        slideXml
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
        mimeType: PPTX_MIME,
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
        mimeType: PPTX_MIME,
        parserName: PARSER_NAME,
        parserVersion: PARSER_VERSION,
        warnings: ['PPTX text extraction failed'],
        metadata: {},
      },
    }
  }
}
