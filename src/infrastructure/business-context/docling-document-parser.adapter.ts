import type { DocumentParserPort, ParsedDocument } from '@/core/business-context/document-parser.port'
import type { UploadStoragePort } from '@/core/business-context/upload-storage.port'
import type { ServiceResult } from '@/core/business-context/types'

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/html',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/tiff',
])

const DEFAULT_TIMEOUT_MS = 180_000
const MAX_STDOUT_BYTES = 20 * 1024 * 1024 // 20 MB

interface DoclingAdapterConfig {
  timeoutMs?: number
  pythonPath?: string
}

function sanitizeFileName(fileName: string): string {
  // Remove special characters, keep alphanumerics, dots, hyphens, underscores
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  // Ensure we don't end up with just an extension or empty name
  return sanitized || 'document'
}

function getExtension(fileName?: string): string {
  if (!fileName) return ''
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot) : ''
}

export class DoclingDocumentParserAdapter implements DocumentParserPort {
  private readonly uploadStorage: UploadStoragePort
  private readonly timeoutMs: number
  private readonly pythonPath: string

  constructor(uploadStorage: UploadStoragePort, config?: DoclingAdapterConfig) {
    this.uploadStorage = uploadStorage
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.pythonPath = config?.pythonPath ?? 'python3'
  }

  supports(mimeType: string): boolean {
    return SUPPORTED_MIME_TYPES.has(mimeType)
  }

  async parse(params: {
    storagePath: string
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    const downloadResult = await this.uploadStorage.download({
      bucket: 'documents',
      path: params.storagePath,
    })
    if (!downloadResult.ok) {
      return { ok: false, error: downloadResult.error }
    }
    return this.runDocling(downloadResult.data, params.mimeType, params.fileName)
  }

  async parseContent(params: {
    content: Buffer
    mimeType: string
    fileName?: string
  }): Promise<ServiceResult<ParsedDocument>> {
    return this.runDocling(params.content, params.mimeType, params.fileName)
  }

  private async runDocling(
    content: Buffer,
    mimeType: string,
    fileName?: string,
  ): Promise<ServiceResult<ParsedDocument>> {
    let tempDir: string | undefined

    const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const { tmpdir } = await import('node:os')

    try {
      tempDir = await mkdtemp(join(tmpdir(), 'nova-docling-'))
      const ext = getExtension(fileName)
      const baseName = sanitizeFileName(fileName?.slice(0, fileName.lastIndexOf('.')) || 'document')
      const filePath = join(tempDir, `${baseName}${ext}`)

      await writeFile(filePath, content)

      const result = await this.execPython(filePath)
      if (!result.ok) {
        return result
      }

      const stdout = result.data.stdout
      if (stdout.length > MAX_STDOUT_BYTES) {
        return {
          ok: false,
          error: {
            code: 'DOCLING_OUTPUT_INVALID',
            message: `Docling stdout exceeded maximum size: ${stdout.length} bytes (max ${MAX_STDOUT_BYTES})`,
          },
        }
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(stdout)
      } catch {
        return {
          ok: false,
          error: {
            code: 'DOCLING_OUTPUT_INVALID',
            message: `Docling produced invalid JSON: ${stdout.slice(0, 500)}`,
          },
        }
      }

      if (typeof parsed !== 'object' || parsed === null) {
        return {
          ok: false,
          error: {
            code: 'DOCLING_OUTPUT_INVALID',
            message: 'Docling output is not an object',
          },
        }
      }

      const obj = parsed as Record<string, unknown>

      if (typeof obj.contentText !== 'string') {
        return {
          ok: false,
          error: {
            code: 'DOCLING_OUTPUT_INVALID',
            message: 'Docling output missing contentText string',
          },
        }
      }

      if (obj.parserName !== 'docling') {
        return {
          ok: false,
          error: {
            code: 'DOCLING_OUTPUT_INVALID',
            message: `Expected parserName 'docling', got '${obj.parserName}'`,
          },
        }
      }

      const doc: ParsedDocument = {
        contentText: obj.contentText as string,
        title: typeof obj.title === 'string' ? obj.title : undefined,
        mimeType,
        pageOrSlideCount: typeof obj.pageOrSlideCount === 'number' ? obj.pageOrSlideCount : undefined,
        parserName: 'docling',
        parserVersion: typeof obj.parserVersion === 'string' ? obj.parserVersion : 'unknown',
        warnings: Array.isArray(obj.warnings) ? (obj.warnings as string[]) : [],
        metadata: typeof obj.metadata === 'object' && obj.metadata !== null ? (obj.metadata as Record<string, unknown>) : {},
      }

      return { ok: true, data: doc }
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'DOCLING_FAILED',
          message: err instanceof Error ? err.message : String(err),
        },
      }
    } finally {
      if (tempDir) {
        await rm(tempDir, { recursive: true, force: true })
      }
    }
  }

  private async execPython(
    filePath: string,
  ): Promise<ServiceResult<{ stdout: string; stderr: string }>> {
    const { execFile } = await import('node:child_process')
    return new Promise((resolve) => {
      const child = execFile(
        this.pythonPath,
        ['workers/document-processing/convert.py', filePath],
        { timeout: this.timeoutMs, maxBuffer: MAX_STDOUT_BYTES },
        (error, stdout, stderr) => {
          if (error) {
            if ('killed' in error && error.killed) {
              resolve({
                ok: false,
                error: {
                  code: 'DOCLING_TIMEOUT',
                  message: `Docling process timed out after ${this.timeoutMs}ms`,
                },
              })
              return
            }
            resolve({
              ok: false,
              error: {
                code: 'DOCLING_FAILED',
                message: stderr || error.message,
              },
            })
            return
          }
          resolve({ ok: true, data: { stdout: stdout as string, stderr: stderr as string } })
        },
      )
      // Ensure child is not kept alive if promise resolves early
      child.unref()
    })
  }
}
