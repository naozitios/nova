import type { ServiceResult } from '@/core/business-context/types'
import type {
  DocumentParserPort,
  ParsedDocument,
} from '@/core/business-context/document-parser.port'
import { getSupabaseServiceClient } from './supabase-client'
import { config } from '@/infrastructure/config'

// ─── OCR MIME types that need PaddleOCR ─────────────────────────────────────

const OCR_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/tiff',
  'application/pdf', // scanned PDFs
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

// ─── Parser version ─────────────────────────────────────────────────────────

const PARSER_NAME = 'paddleocr'
const PARSER_VERSION = '1.0.0'

// ─── OCR result types ───────────────────────────────────────────────────────

interface OcrPage {
  pageNumber: number
  text: string
  confidence: number
  boundingBoxes?: Array<{
    text: string
    x: number
    y: number
    width: number
    height: number
  }>
}

interface OcrResult {
  success: boolean
  pages: OcrPage[]
  totalConfidence: number
  warnings: string[]
  error?: string
}

// ─── Adapter ────────────────────────────────────────────────────────────────

export class PaddleOcrDocumentParserAdapter implements DocumentParserPort {
  private workerUrl: string

  constructor(workerUrl?: string) {
    this.workerUrl = workerUrl ?? this.resolveWorkerUrl()
  }

  supports(mimeType: string): boolean {
    return OCR_MIME_TYPES.has(mimeType)
  }

  async parse(params: {
    storagePath: string
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    const { storagePath, mimeType, fileName } = params

    // Download from Supabase storage
    let buffer: Buffer
    try {
      buffer = await this.downloadFromStorage(storagePath)
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'DOWNLOAD_FAILED',
          message: `Failed to download file: ${error instanceof Error ? error.message : String(error)}`,
        },
      }
    }

    return this.parseContent({ content: buffer, mimeType, fileName })
  }

  async parseContent(params: {
    content: Buffer
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    const { content, mimeType, fileName } = params

    try {
      // Submit OCR job to worker boundary
      const jobId = await this.submitOcrJob(content, mimeType, fileName)
      if (!jobId.ok) return jobId

      // Poll for result
      const result = await this.pollForResult(jobId.data)
      if (!result.ok) return result

      const ocrResult = result.data

      // Build content text from pages
      const pageTexts = ocrResult.pages.map(
        (p) => `### Page ${p.pageNumber} (confidence: ${(p.confidence * 100).toFixed(1)}%)\n\n${p.text}`,
      )

      const contentText = pageTexts.join('\n\n---\n\n')

      return {
        ok: true,
        data: {
          contentText,
          title: fileName?.replace(/\.[^.]+$/, '') ?? undefined,
          mimeType,
          pageOrSlideCount: ocrResult.pages.length || undefined,
          parserName: PARSER_NAME,
          parserVersion: PARSER_VERSION,
          warnings: ocrResult.warnings,
          metadata: {
            totalConfidence: ocrResult.totalConfidence,
            pageCount: ocrResult.pages.length,
            mode: config.businessContext.paddleocrWorkerMode,
            vlEnabled: config.businessContext.paddleocrVlEnabled,
          },
        },
      }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'OCR_FAILED',
          message: `PaddleOCR failed: ${error instanceof Error ? error.message : String(error)}`,
        },
      }
    }
  }

  // ─── Worker boundary communication ────────────────────────────────────

  private async submitOcrJob(
    content: Buffer,
    mimeType: string,
    fileName?: string,
  ): Promise<ServiceResult<string>> {
    try {
      // Upload file to storage for worker to read
      const client = getSupabaseServiceClient()
      const tempPath = `ocr-temp/${Date.now()}-${fileName ?? 'upload'}`

      const { error: uploadError } = await client.storage
        .from(config.businessContext.storageSourceBucket)
        .upload(tempPath, content, {
          contentType: mimeType,
          upsert: false,
        })

      if (uploadError) {
        return {
          ok: false,
          error: {
            code: 'UPLOAD_FAILED',
            message: `Failed to upload for OCR: ${uploadError.message}`,
          },
        }
      }

      // Submit job to worker
      const response = await fetch(`${this.workerUrl}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storagePath: tempPath,
          mimeType,
          fileName,
          sourceBucket: config.businessContext.storageSourceBucket,
        }),
        signal: AbortSignal.timeout(30000),
      })

      if (!response.ok) {
        const text = await response.text()
        return {
          ok: false,
          error: {
            code: 'WORKER_ERROR',
            message: `Worker submission failed: ${response.status} ${text.slice(0, 200)}`,
          },
        }
      }

      const body = await response.json()
      return { ok: true, data: body.jobId }
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'WORKER_UNREACHABLE',
          message: `Cannot reach PaddleOCR worker: ${error instanceof Error ? error.message : String(error)}`,
        },
      }
    }
  }

  private async pollForResult(
    jobId: string,
    maxAttempts = 60,
    intervalMs = 5000,
  ): Promise<ServiceResult<OcrResult>> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await fetch(`${this.workerUrl}/jobs/${jobId}`, {
          signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
          if (attempt < maxAttempts - 1) {
            await sleep(intervalMs)
            continue
          }
          return {
            ok: false,
            error: {
              code: 'POLL_FAILED',
              message: `Worker status check failed: ${response.status}`,
            },
          }
        }

        const body = await response.json()

        if (body.status === 'completed') {
          return { ok: true, data: body.result as OcrResult }
        }

        if (body.status === 'failed') {
          return {
            ok: false,
            error: {
              code: 'OCR_FAILED',
              message: body.error ?? 'OCR job failed',
            },
          }
        }

        // Still running
        await sleep(intervalMs)
      } catch {
        if (attempt < maxAttempts - 1) {
          await sleep(intervalMs)
          continue
        }
        return {
          ok: false,
          error: {
            code: 'POLL_TIMEOUT',
            message: 'OCR job polling timed out',
          },
        }
      }
    }

    return {
      ok: false,
      error: {
        code: 'OCR_TIMEOUT',
        message: `OCR job did not complete within ${maxAttempts * intervalMs / 1000}s`,
      },
    }
  }

  private resolveWorkerUrl(): string {
    return process.env.PADDLEOCR_WORKER_URL ?? 'http://localhost:8000'
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
