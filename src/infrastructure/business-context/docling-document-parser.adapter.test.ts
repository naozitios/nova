import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { UploadStoragePort } from '@/core/business-context/upload-storage.port'
import { DoclingDocumentParserAdapter } from './docling-document-parser.adapter'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockExecFile = vi.fn()
vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}))

const mockMkdtemp = vi.fn()
const mockWriteFile = vi.fn()
const mockReadFile = vi.fn()
const mockRm = vi.fn()
vi.mock('node:fs/promises', () => ({
  mkdtemp: (...args: unknown[]) => mockMkdtemp(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  rm: (...args: unknown[]) => mockRm(...args),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUploadStorage(): UploadStoragePort {
  return {
    upload: vi.fn(),
    download: vi.fn(),
    delete: vi.fn(),
    getSignedUrl: vi.fn(),
  }
}

function makeDoclingOutput(overrides?: Partial<Record<string, unknown>>): string {
  return JSON.stringify({
    contentText: '# Hello\n\nThis is parsed content.',
    parserName: 'docling',
    parserVersion: '1.0.0',
    warnings: [],
    metadata: {},
    ...overrides,
  })
}

function setupExecFileSuccess(stdout?: string, stderr = ''): void {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (error: Error | null, stdout: string, stderr: string) => void,
    ) => {
      cb(null, stdout ?? makeDoclingOutput(), stderr)
    },
  )
}

function setupExecFileTimeout(): void {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (error: Error & { killed?: boolean } | null, stdout: string, stderr: string) => void,
    ) => {
      const err = new Error('killed') as Error & { killed: boolean }
      err.killed = true
      cb(err, '', '')
    },
  )
}

function setupExecFileError(stderr: string, exitCode = 1): void {
  mockExecFile.mockImplementation(
    (
      _cmd: string,
      _args: string[],
      _opts: unknown,
      cb: (error: Error & { code?: number } | null, stdout: string, stderr: string) => void,
    ) => {
      const err = new Error(`exit code ${exitCode}`) as Error & { code: number }
      err.code = exitCode
      cb(err, '', stderr)
    },
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DoclingDocumentParserAdapter', () => {
  let uploadStorage: UploadStoragePort
  let adapter: DoclingDocumentParserAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    uploadStorage = makeUploadStorage()
    adapter = new DoclingDocumentParserAdapter(uploadStorage, { storageBucket: 'business-context-sources' })
    mockMkdtemp.mockResolvedValue('/tmp/nova-docling-abc123')
    mockWriteFile.mockResolvedValue(undefined)
    mockRm.mockResolvedValue(undefined)
  })

  it('parse() downloads, creates temp dir, spawns Python, parses JSON, cleans up', async () => {
    const fileContent = Buffer.from('fake pdf content')
    vi.mocked(uploadStorage.download).mockResolvedValue({ ok: true, data: fileContent })
    setupExecFileSuccess()

    const result = await adapter.parse({
      storagePath: 'uploads/doc.pdf',
      mimeType: 'application/pdf',
      fileName: 'report.pdf',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.contentText).toBe('# Hello\n\nThis is parsed content.')
      expect(result.data.parserName).toBe('docling')
      expect(result.data.mimeType).toBe('application/pdf')
    }

    expect(uploadStorage.download).toHaveBeenCalledWith({
      bucket: 'business-context-sources',
      path: 'uploads/doc.pdf',
    })
    expect(mockMkdtemp).toHaveBeenCalledWith(expect.stringContaining('nova-docling-'))
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('report'),
      fileContent,
    )
    expect(mockExecFile).toHaveBeenCalledWith(
      'python3',
      ['workers/document-processing/convert.py', expect.stringContaining('report')],
      expect.objectContaining({ timeout: 180_000 }),
      expect.any(Function),
    )
    expect(mockRm).toHaveBeenCalledWith(expect.stringContaining('nova-docling-'), {
      recursive: true,
      force: true,
    })
  })

  it('parseContent() writes buffer to temp file, same flow', async () => {
    const content = Buffer.from('<html><body>Hello</body></html>')
    setupExecFileSuccess()

    const result = await adapter.parseContent({
      content,
      mimeType: 'text/html',
      fileName: 'page.html',
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.parserName).toBe('docling')
    }

    expect(uploadStorage.download).not.toHaveBeenCalled()
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('page'),
      content,
    )
    expect(mockRm).toHaveBeenCalledWith(expect.stringContaining('nova-docling-'), {
      recursive: true,
      force: true,
    })
  })

  it('timeout maps to DOCLING_TIMEOUT error', async () => {
    vi.mocked(uploadStorage.download).mockResolvedValue({
      ok: true,
      data: Buffer.from('content'),
    })
    setupExecFileTimeout()

    const result = await adapter.parse({
      storagePath: 'uploads/doc.pdf',
      mimeType: 'application/pdf',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DOCLING_TIMEOUT')
      expect(result.error.message).toContain('timed out')
    }
  })

  it('non-zero exit maps to DOCLING_FAILED error', async () => {
    vi.mocked(uploadStorage.download).mockResolvedValue({
      ok: true,
      data: Buffer.from('content'),
    })
    setupExecFileError('Python module not found')

    const result = await adapter.parse({
      storagePath: 'uploads/doc.pdf',
      mimeType: 'application/pdf',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DOCLING_FAILED')
      expect(result.error.message).toBe('Python module not found')
    }
  })

  it('falls back to plain text in development when Docling is not installed', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    setupExecFileError("Missing dependency: No module named 'docling'\n")

    try {
      const result = await adapter.parseContent({
        content: Buffer.from('Nova paid ads onboarding facts'),
        mimeType: 'application/pdf',
        fileName: 'facts.pdf',
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.contentText).toContain('Nova paid ads onboarding facts')
        expect(result.data.parserName).toBe('docling-dev-fallback')
      }
    } finally {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it('fails in production when Docling is not installed', async () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    setupExecFileError("Missing dependency: No module named 'docling'\n")

    try {
      const result = await adapter.parseContent({
        content: Buffer.from('Nova paid ads onboarding facts'),
        mimeType: 'application/pdf',
        fileName: 'facts.pdf',
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('DOCLING_FAILED')
      }
    } finally {
      process.env.NODE_ENV = originalNodeEnv
    }
  })

  it('malformed JSON maps to DOCLING_OUTPUT_INVALID error', async () => {
    vi.mocked(uploadStorage.download).mockResolvedValue({
      ok: true,
      data: Buffer.from('content'),
    })
    setupExecFileSuccess('not json at all {{{')

    const result = await adapter.parse({
      storagePath: 'uploads/doc.pdf',
      mimeType: 'application/pdf',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DOCLING_OUTPUT_INVALID')
      expect(result.error.message).toContain('invalid JSON')
    }
  })

  it('cleanup happens even on error (rm called in finally)', async () => {
    vi.mocked(uploadStorage.download).mockResolvedValue({
      ok: true,
      data: Buffer.from('content'),
    })
    setupExecFileError('something broke')

    await adapter.parse({
      storagePath: 'uploads/doc.pdf',
      mimeType: 'application/pdf',
    })

    expect(mockRm).toHaveBeenCalledWith(expect.stringContaining('nova-docling-'), {
      recursive: true,
      force: true,
    })
  })

  it('supports() returns true for PDF/DOCX/HTML/PNG, false for unsupported', () => {
    expect(adapter.supports('application/pdf')).toBe(true)
    expect(adapter.supports('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe(true)
    expect(adapter.supports('text/html')).toBe(true)
    expect(adapter.supports('image/png')).toBe(true)
    expect(adapter.supports('image/jpeg')).toBe(true)
    expect(adapter.supports('image/webp')).toBe(true)
    expect(adapter.supports('image/tiff')).toBe(true)
    expect(adapter.supports('application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe(true)
    expect(adapter.supports('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(true)

    expect(adapter.supports('text/plain')).toBe(false)
    expect(adapter.supports('application/json')).toBe(false)
    expect(adapter.supports('video/mp4')).toBe(false)
  })

  it('temp directory name contains nova-docling-', async () => {
    vi.mocked(uploadStorage.download).mockResolvedValue({
      ok: true,
      data: Buffer.from('content'),
    })
    setupExecFileSuccess()

    await adapter.parse({
      storagePath: 'uploads/doc.pdf',
      mimeType: 'application/pdf',
    })

    expect(mockMkdtemp).toHaveBeenCalledWith(
      expect.stringMatching(/nova-docling-/),
    )
  })
})
