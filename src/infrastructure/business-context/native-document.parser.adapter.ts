import type { ServiceResult } from '@/core/business-context/types'
import type {
  DocumentParserPort,
  ParsedDocument,
} from '@/core/business-context/document-parser.port'
import { getSupabaseServiceClient } from './supabase-client'
import { config } from '@/infrastructure/config'
import { NativeDocumentParser } from './parsers'

export class NativeDocumentParserAdapter implements DocumentParserPort {
  private readonly parser = new NativeDocumentParser()

  supports(mimeType: string): boolean {
    return this.parser.supports(mimeType)
  }

  async parse(params: {
    storagePath: string
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    const { storagePath, mimeType, fileName } = params

    try {
      const buffer = await this.downloadFromStorage(storagePath)
      return this.parser.route({ content: buffer, mimeType, fileName })
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

  parseContent(params: {
    content: Buffer
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    return this.parser.route(params)
  }

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
