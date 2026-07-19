import type { ServiceResult } from '@/core/business-context/types'
import type { ParsedDocument } from '@/core/business-context/document-parser.port'

const PARSER_NAME = 'native'
const PARSER_VERSION = '1.0.0'

export async function parseHtml(buffer: Buffer): Promise<ServiceResult<ParsedDocument>> {
  try {
    const { convert: htmlToText } = (await import('html-to-text')) as {
      convert: (html: string, opts?: Record<string, unknown>) => string
    }
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

export async function parsePlainText(
  buffer: Buffer,
): Promise<ServiceResult<ParsedDocument>> {
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
