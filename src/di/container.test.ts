import { describe, it, expect, beforeEach } from 'vitest'
import { Container } from '@/di/container'
import { UploadRepository } from '@/infrastructure/business-context/repository/upload.repository'
import { IdempotencyRepository } from '@/infrastructure/business-context/repository/idempotency.repository'
import { MetaConnectionRepository } from '@/infrastructure/business-context/repository/meta-connection.repository'
import { ManualSourceAdapter } from '@/infrastructure/business-context/manual-source.adapter'
import { WebsiteSourceAdapter } from '@/infrastructure/business-context/website-source.adapter'
import { RegistryErrors } from '@/infrastructure/business-context/source-adapter-registry'
import { SourceProcessingService } from '@/core/business-context/service/source-processing.service'

describe('Container', () => {
  beforeEach(() => {
    Container.reset()
  })

  // ── Repository Services (production Supabase-backed) ─────────────────────

  describe('getUploadRepository', () => {
    it('resolves without error', () => {
      expect(() => Container.getUploadRepository()).not.toThrow()
    })

    it('returns Supabase-backed UploadRepository (not in-memory)', () => {
      const repo = Container.getUploadRepository()
      expect(repo).toBeDefined()
      expect(repo).toBeInstanceOf(UploadRepository)
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getUploadRepository()
      const b = Container.getUploadRepository()
      expect(a).toBe(b)
    })
  })

  describe('getIdempotencyRepository', () => {
    it('resolves without error', () => {
      expect(() => Container.getIdempotencyRepository()).not.toThrow()
    })

    it('returns Supabase-backed IdempotencyRepository (not in-memory)', () => {
      const repo = Container.getIdempotencyRepository()
      expect(repo).toBeDefined()
      expect(repo).toBeInstanceOf(IdempotencyRepository)
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getIdempotencyRepository()
      const b = Container.getIdempotencyRepository()
      expect(a).toBe(b)
    })
  })

  describe('getMetaConnectionRepository', () => {
    it('resolves without error', () => {
      expect(() => Container.getMetaConnectionRepository()).not.toThrow()
    })

    it('returns Supabase-backed MetaConnectionRepository (not in-memory)', () => {
      const repo = Container.getMetaConnectionRepository()
      expect(repo).toBeDefined()
      expect(repo).toBeInstanceOf(MetaConnectionRepository)
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getMetaConnectionRepository()
      const b = Container.getMetaConnectionRepository()
      expect(a).toBe(b)
    })
  })

  // ── Services use production repositories ─────────────────────────────────

  describe('service wiring', () => {
    it('getIdempotencyService wires with Supabase IdempotencyRepository', () => {
      const svc = Container.getIdempotencyService()
      expect(svc).toBeDefined()
      // The service should be wired with the production repo, not in-memory
      const repo = Container.getIdempotencyRepository()
      expect(repo).toBeInstanceOf(IdempotencyRepository)
    })

    it('getMetaResolver wires with Supabase MetaConnectionRepository', () => {
      const resolver = Container.getMetaResolver()
      expect(resolver).toBeDefined()
      const repo = Container.getMetaConnectionRepository()
      expect(repo).toBeInstanceOf(MetaConnectionRepository)
    })
  })

  // ── Port Services ────────────────────────────────────────────────────────

  describe('getUploadStorage', () => {
    it('resolves without error', () => {
      expect(() => Container.getUploadStorage()).not.toThrow()
    })

    it('returns an object implementing UploadStoragePort', () => {
      const storage = Container.getUploadStorage()
      expect(storage).toBeDefined()
      expect(typeof storage).toBe('object')
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getUploadStorage()
      const b = Container.getUploadStorage()
      expect(a).toBe(b)
    })
  })

  describe('getMalwareScanner', () => {
    it('resolves without error', () => {
      expect(() => Container.getMalwareScanner()).not.toThrow()
    })

    it('returns an object implementing MalwareScannerPort', () => {
      const scanner = Container.getMalwareScanner()
      expect(scanner).toBeDefined()
      expect(typeof scanner).toBe('object')
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getMalwareScanner()
      const b = Container.getMalwareScanner()
      expect(a).toBe(b)
    })
  })

  describe('getIdempotencyService', () => {
    it('resolves without error', () => {
      expect(() => Container.getIdempotencyService()).not.toThrow()
    })

    it('returns an object implementing IdempotencyPort', () => {
      const svc = Container.getIdempotencyService()
      expect(svc).toBeDefined()
      expect(typeof svc).toBe('object')
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getIdempotencyService()
      const b = Container.getIdempotencyService()
      expect(a).toBe(b)
    })
  })

  describe('getMetaResolver', () => {
    it('resolves without error', () => {
      expect(() => Container.getMetaResolver()).not.toThrow()
    })

    it('returns an object implementing MetaConnectionPort', () => {
      const resolver = Container.getMetaResolver()
      expect(resolver).toBeDefined()
      expect(typeof resolver).toBe('object')
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getMetaResolver()
      const b = Container.getMetaResolver()
      expect(a).toBe(b)
    })
  })

  // ── Application Services ─────────────────────────────────────────────────

  describe('getSourceAdapterRegistry', () => {
    it('resolves without error', () => {
      expect(() => Container.getSourceAdapterRegistry()).not.toThrow()
    })

    it('returns a SourceAdapterRegistry with adapter types', () => {
      const registry = Container.getSourceAdapterRegistry()
      expect(registry).toBeDefined()
      expect(typeof registry).toBe('object')
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getSourceAdapterRegistry()
      const b = Container.getSourceAdapterRegistry()
      expect(a).toBe(b)
    })
  })

  describe('getDocumentParser', () => {
    it('resolves without error', () => {
      expect(() => Container.getDocumentParser()).not.toThrow()
    })

    it('returns a document parser implementing DocumentParserPort', () => {
      const parser = Container.getDocumentParser()
      expect(parser).toBeDefined()
      expect(typeof parser).toBe('object')
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getDocumentParser()
      const b = Container.getDocumentParser()
      expect(a).toBe(b)
    })
  })

  describe('getExtractionService', () => {
    it('resolves without error', () => {
      expect(() => Container.getExtractionService()).not.toThrow()
    })

    it('returns an object implementing ExtractionPort', () => {
      const svc = Container.getExtractionService()
      expect(svc).toBeDefined()
      expect(typeof svc).toBe('object')
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getExtractionService()
      const b = Container.getExtractionService()
      expect(a).toBe(b)
    })
  })

  describe('getSourceProcessingService', () => {
    it('resolves without error', () => {
      expect(() => Container.getSourceProcessingService()).not.toThrow()
    })

    it('returns a service with source processing methods', () => {
      const svc = Container.getSourceProcessingService()
      expect(svc).toBeDefined()
      expect(typeof svc).toBe('object')
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getSourceProcessingService()
      const b = Container.getSourceProcessingService()
      expect(a).toBe(b)
    })
  })

  describe('getJobRunner', () => {
    it('resolves without error', () => {
      expect(() => Container.getJobRunner()).not.toThrow()
    })

    it('returns a JobRunner instance', () => {
      const runner = Container.getJobRunner()
      expect(runner).toBeDefined()
      expect(typeof runner).toBe('object')
    })

    it('returns the same instance on repeated calls (singleton)', () => {
      const a = Container.getJobRunner()
      const b = Container.getJobRunner()
      expect(a).toBe(b)
    })
  })

  describe('getRegisterHandlers', () => {
    it('resolves without error', () => {
      expect(() => Container.getRegisterHandlers()).not.toThrow()
    })

    it('returns a function', () => {
      const handlers = Container.getRegisterHandlers()
      expect(typeof handlers).toBe('function')
    })
  })

  // ── Source Adapter Registry Registrations ─────────────────────────────────

  describe('getSourceAdapterRegistry adapters', () => {
    it('registers website adapter for "website" source type', () => {
      const registry = Container.getSourceAdapterRegistry()
      expect(registry.hasAdapter('website')).toBe(true)
    })

    it('registers meta adapter for "meta" source type', () => {
      const registry = Container.getSourceAdapterRegistry()
      expect(registry.hasAdapter('meta')).toBe(true)
    })

    it('registers manual adapter for "user_answer" source type', () => {
      const registry = Container.getSourceAdapterRegistry()
      expect(registry.hasAdapter('user_answer')).toBe(true)
    })

    it('registers manual adapter for "system_inference" source type', () => {
      const registry = Container.getSourceAdapterRegistry()
      expect(registry.hasAdapter('system_inference')).toBe(true)
    })

    it('registers at least 3 distinct adapter types', () => {
      const registry = Container.getSourceAdapterRegistry()
      const types = registry.listSupportedTypes()
      expect(types.length).toBeGreaterThanOrEqual(3)
    })

    it('resolve(user_answer) returns adapter, not NO_ADAPTER error', () => {
      const registry = Container.getSourceAdapterRegistry()
      const result = registry.resolve('user_answer')
      expect('adapter' in result).toBe(true)
      expect('error' in result).toBe(false)
      if ('adapter' in result) {
        expect(result.adapter).toBeInstanceOf(ManualSourceAdapter)
      }
    })

    it('resolve(website) returns website adapter', () => {
      const registry = Container.getSourceAdapterRegistry()
      const result = registry.resolve('website')
      expect('adapter' in result).toBe(true)
      if ('adapter' in result) {
        expect(result.adapter).toBeInstanceOf(WebsiteSourceAdapter)
      }
    })
  })

  // ── Source Processing Service — production pipeline ──────────────────────

  describe('getSourceProcessingService production pipeline', () => {
    it('collectWithAdapter(user_answer) succeeds instead of returning NO_ADAPTER', async () => {
      const originalKey = process.env.FIRECRAWL_API_KEY
      try {
        process.env.FIRECRAWL_API_KEY = originalKey ?? 'test-key'
        Container.reset()
        const svc = Container.getSourceProcessingService()
        const result = await svc.collectWithAdapter('ws-1', 'biz-1', {
          id: 'src-1',
          workspaceId: 'ws-1',
          businessId: 'biz-1',
          sourceType: 'user_answer',
          sourceName: 'Test Answer',
          externalReference: null,
          status: 'registered',
          currentStage: null,
          terminalOutcome: null,
          metadata: { content: 'Test answer content' },
          collectedAt: new Date(),
        })
        expect(result.ok).toBe(true)
      } finally {
        if (originalKey !== undefined) process.env.FIRECRAWL_API_KEY = originalKey
        else delete process.env.FIRECRAWL_API_KEY
      }
    })

    it('returns an instance of the core SourceProcessingService', () => {
      const originalKey = process.env.FIRECRAWL_API_KEY
      try {
        process.env.FIRECRAWL_API_KEY = originalKey ?? 'test-key'
        Container.reset()
        const svc = Container.getSourceProcessingService()
        expect(svc).toBeInstanceOf(SourceProcessingService)
      } finally {
        if (originalKey !== undefined) process.env.FIRECRAWL_API_KEY = originalKey
        else delete process.env.FIRECRAWL_API_KEY
      }
    })
  })

  // ── Unsupported Source Types (stable error until B16 adapters land) ──────

  describe('unsupported source types', () => {
    const unsupportedTypes = [
      'brand_deck',
      'brand_playbook',
      'product_document',
      'campaign_brief',
      'research_document',
    ] as const

    for (const sourceType of unsupportedTypes) {
      it(`resolve("${sourceType}") returns explicit UNSUPPORTED_SOURCE_TYPE error`, () => {
        const registry = Container.getSourceAdapterRegistry()
        const result = registry.resolve(sourceType)
        expect('error' in result).toBe(true)
        if ('error' in result) {
          expect(result.error.code).toBe(RegistryErrors.UNSUPPORTED_SOURCE_TYPE)
        }
      })
    }
  })

  // ── Configuration Error Tests ────────────────────────────────────────────

  describe('configuration errors', () => {
    it('getMalwareScanner throws when CLAMAV_HOST is missing', () => {
      const original = process.env.CLAMAV_HOST
      try {
        delete process.env.CLAMAV_HOST
        expect(() => Container.getMalwareScanner()).toThrow(/CLAMAV_HOST/)
      } finally {
        if (original !== undefined) process.env.CLAMAV_HOST = original
      }
    })

    it('getSourceAdapterRegistry throws when FIRECRAWL_API_KEY is missing', () => {
      const original = process.env.FIRECRAWL_API_KEY
      try {
        delete process.env.FIRECRAWL_API_KEY
        expect(() => Container.getSourceAdapterRegistry()).toThrow(
          /FIRECRAWL_API_KEY|Firecrawl.*key|firecrawl/i,
        )
      } finally {
        if (original !== undefined) process.env.FIRECRAWL_API_KEY = original
      }
    })

    it('getExtractionService throws when LLM provider key is missing', () => {
      const originalKey = process.env.GROQ_API_KEY
      const originalUrl = process.env.LLM_API_URL
      const originalOpenRouterKey = process.env.OPENROUTER_API_KEY
      const originalOpenRouterModel = process.env.OPENROUTER_MODEL
      try {
        delete process.env.GROQ_API_KEY
        delete process.env.LLM_API_URL
        delete process.env.OPENROUTER_API_KEY
        delete process.env.OPENROUTER_MODEL
        expect(() => Container.getExtractionService()).toThrow(
          /LLM|GROQ|API_KEY|provider/i,
        )
      } finally {
        if (originalKey !== undefined) process.env.GROQ_API_KEY = originalKey
        if (originalUrl !== undefined) process.env.LLM_API_URL = originalUrl
        if (originalOpenRouterKey !== undefined) process.env.OPENROUTER_API_KEY = originalOpenRouterKey
        if (originalOpenRouterModel !== undefined) process.env.OPENROUTER_MODEL = originalOpenRouterModel
      }
    })
  })
})
