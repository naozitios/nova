import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { ParsedDocument } from '@/core/business-context/document-parser.port'

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('./supabase-client', () => ({
  getSupabaseServiceClient: vi.fn(),
}))

vi.mock('@/infrastructure/config', () => ({
  config: {
    businessContext: {
      storageSourceBucket: 'business-context-source',
      paddleocrWorkerMode: 'cpu',
      paddleocrVlEnabled: false,
    },
  },
}))

import { PaddleOcrDocumentParserAdapter } from './paddleocr-document-parser.adapter'
import { getSupabaseServiceClient } from './supabase-client'

const mockStorage = () => {
  const uploadSpy = vi.fn().mockResolvedValue({ error: null })
  const downloadSpy = vi.fn()
  const fromSpy = vi.fn().mockReturnValue({ upload: uploadSpy, download: downloadSpy })
  const client = { storage: { from: fromSpy } }
  vi.mocked(getSupabaseServiceClient).mockReturnValue(client as unknown as ReturnType<typeof getSupabaseServiceClient>)
  return { uploadSpy, downloadSpy, fromSpy }
}

const mockFetchSuccess = (ocrResult: Record<string, unknown>) => {
  // POST /jobs → jobId
  // GET /jobs/:id → completed on second call
  const fetchSpy = vi.fn()
  fetchSpy.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ jobId: 'job-123' }),
  })
  fetchSpy.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ status: 'completed', result: ocrResult }),
  })
  return fetchSpy
}

// ─── Test data ─────────────────────────────────────────────────────────────

const SAMPLE_OCR_RESULT = {
  success: true,
  pages: [
    {
      pageNumber: 1,
      text: 'Hello from OCR',
      confidence: 0.95,
      boundingBoxes: [{ text: 'Hello', x: 0, y: 0, width: 100, height: 20 }],
    },
  ],
  totalConfidence: 0.95,
  warnings: ['minor-blur'],
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('PaddleOcrDocumentParserAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── supports ──────────────────────────────────────────────────────

  describe('supports', () => {
    const adapter = new PaddleOcrDocumentParserAdapter('http://localhost:8000')

    it('returns true for image/png', () => {
      expect(adapter.supports('image/png')).toBe(true)
    })

    it('returns true for image/jpeg', () => {
      expect(adapter.supports('image/jpeg')).toBe(true)
    })

    it('returns true for application/pdf', () => {
      expect(adapter.supports('application/pdf')).toBe(true)
    })

    it('returns false for text/html', () => {
      expect(adapter.supports('text/html')).toBe(false)
    })

    it('returns false for text/plain', () => {
      expect(adapter.supports('text/plain')).toBe(false)
    })

    it('returns false for application/json', () => {
      expect(adapter.supports('application/json')).toBe(false)
    })
  })

  // ─── worker boundary round-trip ────────────────────────────────────

  describe('worker boundary round-trip', () => {
    it('submits job to worker, polls, and returns parsed document', async () => {
      const { uploadSpy } = mockStorage()
      const fetchSpy = mockFetchSuccess(SAMPLE_OCR_RESULT)
      vi.stubGlobal('fetch', fetchSpy)

      const adapter = new PaddleOcrDocumentParserAdapter('http://worker:8000')
      const result = await adapter.parseContent({
        content: Buffer.from('fake-image'),
        mimeType: 'image/png',
        fileName: 'invoice.png',
      })

      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')

      // Worker received upload then POST
      expect(uploadSpy).toHaveBeenCalledOnce()
      expect(fetchSpy).toHaveBeenNthCalledWith(
        1,
        'http://worker:8000/jobs',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      // Then polled for result
      expect(fetchSpy).toHaveBeenNthCalledWith(
        2,
        'http://worker:8000/jobs/job-123',
        expect.any(Object),
      )

      const data = result.data as ParsedDocument
      expect(data.contentText).toContain('Hello from OCR')
      expect(data.contentText).toContain('### Page 1')
      expect(data.contentText).toContain('confidence: 95.0%')
    })

    it('returns error when upload to storage fails', async () => {
      const { uploadSpy } = mockStorage()
      uploadSpy.mockResolvedValue({ error: { message: 'bucket not found' } })
      vi.stubGlobal('fetch', vi.fn())

      const adapter = new PaddleOcrDocumentParserAdapter('http://worker:8000')
      const result = await adapter.parseContent({
        content: Buffer.from('data'),
        mimeType: 'image/png',
      })

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected error')
      expect(result.error.code).toBe('UPLOAD_FAILED')
    })

    it('returns error when worker is unreachable', async () => {
      mockStorage()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')))

      const adapter = new PaddleOcrDocumentParserAdapter('http://worker:8000')
      const result = await adapter.parseContent({
        content: Buffer.from('data'),
        mimeType: 'image/png',
      })

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected error')
      expect(result.error.code).toBe('WORKER_UNREACHABLE')
    })

    it('returns error when worker job submission returns non-200', async () => {
      mockStorage()
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve('internal') }),
      )

      const adapter = new PaddleOcrDocumentParserAdapter('http://worker:8000')
      const result = await adapter.parseContent({
        content: Buffer.from('data'),
        mimeType: 'image/png',
      })

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected error')
      expect(result.error.code).toBe('WORKER_ERROR')
    })

    it('returns error when worker job fails', async () => {
      mockStorage()
      const fetchSpy = vi.fn()
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ jobId: 'job-456' }),
      })
      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'failed', error: 'model crashed' }),
      })
      vi.stubGlobal('fetch', fetchSpy)

      const adapter = new PaddleOcrDocumentParserAdapter('http://worker:8000')
      const result = await adapter.parseContent({
        content: Buffer.from('data'),
        mimeType: 'image/png',
      })

      expect(result.ok).toBe(false)
      if (result.ok) throw new Error('expected error')
      expect(result.error.code).toBe('OCR_FAILED')
      expect(result.error.message).toContain('model crashed')
    })
  })

  // ─── parser metadata ───────────────────────────────────────────────

  describe('parser metadata', () => {
    it('preserves parserName, parserVersion, and metadata fields', async () => {
      mockStorage()
      vi.stubGlobal('fetch', mockFetchSuccess(SAMPLE_OCR_RESULT))

      const adapter = new PaddleOcrDocumentParserAdapter('http://worker:8000')
      const result = await adapter.parseContent({
        content: Buffer.from('img'),
        mimeType: 'image/png',
        fileName: 'scan.tiff',
      })

      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')

      const data = result.data as ParsedDocument
      expect(data.parserName).toBe('paddleocr')
      expect(data.parserVersion).toBe('1.0.0')
      expect(data.mimeType).toBe('image/png')
      expect(data.pageOrSlideCount).toBe(1)
      expect(data.title).toBe('scan') // strips extension
      expect(data.warnings).toEqual(['minor-blur'])

      const meta = data.metadata as Record<string, unknown>
      expect(meta.totalConfidence).toBe(0.95)
      expect(meta.pageCount).toBe(1)
      expect(meta.mode).toBe('cpu')
      expect(meta.vlEnabled).toBe(false)
    })

    it('handles multiple pages in OCR result', async () => {
      const multiPage = {
        ...SAMPLE_OCR_RESULT,
        pages: [
          { pageNumber: 1, text: 'Page one', confidence: 0.92, boundingBoxes: [] },
          { pageNumber: 2, text: 'Page two', confidence: 0.88, boundingBoxes: [] },
        ],
        totalConfidence: 0.90,
      }
      mockStorage()
      vi.stubGlobal('fetch', mockFetchSuccess(multiPage))

      const adapter = new PaddleOcrDocumentParserAdapter('http://worker:8000')
      const result = await adapter.parseContent({
        content: Buffer.from('pdf'),
        mimeType: 'application/pdf',
        fileName: 'report.pdf',
      })

      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')

      const data = result.data as ParsedDocument
      expect(data.pageOrSlideCount).toBe(2)
      expect(data.contentText).toContain('### Page 1')
      expect(data.contentText).toContain('### Page 2')
      expect(data.contentText).toContain('---') // page separator

      const meta = data.metadata as Record<string, unknown>
      expect(meta.pageCount).toBe(2)
      expect(meta.totalConfidence).toBe(0.90)
    })

    it('strips extension from title, keeps undefined when no fileName', async () => {
      mockStorage()
      vi.stubGlobal('fetch', mockFetchSuccess(SAMPLE_OCR_RESULT))

      const adapter = new PaddleOcrDocumentParserAdapter('http://worker:8000')
      const result = await adapter.parseContent({
        content: Buffer.from('img'),
        mimeType: 'image/png',
      })

      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('expected ok')
      expect(result.data.title).toBeUndefined()
    })
  })
})
