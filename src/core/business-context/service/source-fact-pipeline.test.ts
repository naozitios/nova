import { describe, expect, it, vi } from 'vitest'
import type { PersistFactReconciliationCreate } from '../repository/fact.port'
import type { RepositoryPort } from '../repository/repository.port'
import type { ExtractionPort } from '../extraction.port'
import type { ContextFact } from '../types'
import { SourceFactPipeline } from './source-fact-pipeline'

// ── Test double types ─────────────────────────────────────────────────────────

type FakeRepo = {
  persistFactReconciliation: ReturnType<typeof vi.fn>
  listContextFacts: ReturnType<typeof vi.fn>
  createQualityGateResult: ReturnType<typeof vi.fn>
  listOnboardingQuestions: ReturnType<typeof vi.fn>
  createOnboardingQuestion: ReturnType<typeof vi.fn>
  dismissOnboardingQuestion: ReturnType<typeof vi.fn>
}

type FakeExtractor = {
  extractFacts: ReturnType<typeof vi.fn>
}

// ── Factory helpers ───────────────────────────────────────────────────────────

function makeContextFact(
  overrides: Partial<ContextFact> & Pick<ContextFact, 'id' | 'factKey'>,
): ContextFact {
  return {
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    value: 'value',
    sourceId: 'src-1',
    sourceDocumentId: null,
    sourceExcerpt: null,
    evidenceLocator: null,
    confidence: 0.8,
    verificationStatus: 'extracted',
    supersedesFactId: null,
    validFrom: new Date(),
    validTo: null,
    createdAt: new Date(),
    createdBy: 'test',
    ...overrides,
  }
}

function makePipeline(repo: FakeRepo, extractor: FakeExtractor) {
  return new SourceFactPipeline(
    repo as unknown as RepositoryPort,
    extractor as unknown as ExtractionPort,
  )
}

function makeFakeRepo(overrides?: Partial<FakeRepo>): FakeRepo {
  return {
    persistFactReconciliation: vi.fn().mockResolvedValue({
      ok: true,
      data: { created_fact_ids: ['fact-1', 'fact-2'] },
    }),
    listContextFacts: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: [] },
    }),
    createQualityGateResult: vi.fn().mockResolvedValue({ ok: true }),
    listOnboardingQuestions: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: [] },
    }),
    createOnboardingQuestion: vi.fn().mockResolvedValue({ ok: true }),
    dismissOnboardingQuestion: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  }
}

function makeFakeExtractor(overrides?: Partial<FakeExtractor>): FakeExtractor {
  return {
    extractFacts: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        facts: [
          {
            factKey: 'business_name',
            value: 'Acme Corp',
            sourceExcerpt: 'Acme Corp',
            evidenceLocator: null,
            confidence: 0.9,
          },
        ],
      },
    }),
    ...overrides,
  }
}

describe('SourceFactPipeline', () => {
  it('extracts and reconciles facts from documents', async () => {
    const repo = makeFakeRepo()
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme Corp is a company', parserName: 'docling' }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.factsExtracted).toBe(2)
    }
    expect(extractor.extractFacts).toHaveBeenCalledTimes(1)
    expect(repo.persistFactReconciliation).toHaveBeenCalledTimes(1)
  })

  it('returns zero facts when no documents', async () => {
    const repo = makeFakeRepo()
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.factsExtracted).toBe(0)
    }
    expect(extractor.extractFacts).not.toHaveBeenCalled()
  })

  it('returns failure when extraction fails for any document', async () => {
    const repo = makeFakeRepo()
    const extractor = makeFakeExtractor({
      extractFacts: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'EXTRACTION_FAILED', message: 'API error' },
      }),
    })
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'text', parserName: 'docling' }],
    })

    // Extraction failure must be returned, not downgraded to warning
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EXTRACTION_FAILED')
    }
    expect(repo.persistFactReconciliation).not.toHaveBeenCalled()
  })

  it('creates conflicts for meta source type with differing facts', async () => {
    const repo = makeFakeRepo()
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'meta',
      existingFacts: [
        makeContextFact({ id: 'fact-existing', factKey: 'business_name', value: 'Old Corp' }),
      ],
      runId: 'run-1',
      sessionId: null,
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' }],
    })

    expect(result.ok).toBe(true)
    expect(repo.persistFactReconciliation).toHaveBeenCalledWith(
      'ws-1',
      'biz-1',
      expect.any(Array),
      expect.any(Array),
      expect.arrayContaining([
        expect.objectContaining({ factKey: 'business_name' }),
      ]),
    )
  })

  it('meta sourceType with same value as existing fact produces no conflict and reconciles normally', async () => {
    const repo = makeFakeRepo({
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            makeContextFact({
              id: 'fact-existing',
              factKey: 'business_name',
              value: 'Acme Corp',
              sourceId: 'src-1',
              sourceExcerpt: 'Acme Corp',
              confidence: 0.8,
            }),
          ],
        },
      }),
    })
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'meta',
      existingFacts: [
        makeContextFact({ id: 'fact-existing', factKey: 'business_name', value: 'Acme Corp' }),
      ],
      runId: 'run-1',
      sessionId: null,
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' }],
    })

    expect(result.ok).toBe(true)
    // No conflict — values match, so toConflicts is empty and nothing to persist
    expect(repo.persistFactReconciliation).not.toHaveBeenCalled()
    // Normal path continued: quality gates execute because runId is present
    expect(repo.createQualityGateResult).toHaveBeenCalled()
  })

  it('applies fact quality gates when runId is provided', async () => {
    const repo = makeFakeRepo({
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            makeContextFact({
              id: 'fact-1',
              factKey: 'business_name',
              value: 'Acme Corp',
              sourceExcerpt: 'Acme Corp',
              confidence: 0.5,
            }),
          ],
        },
      }),
    })
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' }],
    })

    expect(result.ok).toBe(true)
    expect(repo.createQualityGateResult).toHaveBeenCalled()
  })

  it('skips quality gates when runId is null', async () => {
    const repo = makeFakeRepo({
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            makeContextFact({
              id: 'fact-1',
              factKey: 'business_name',
              value: 'Acme Corp',
              sourceExcerpt: 'Acme Corp',
              confidence: 0.5,
            }),
          ],
        },
      }),
    })
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: null,
      sessionId: null,
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' }],
    })

    expect(result.ok).toBe(true)
    expect(repo.createQualityGateResult).not.toHaveBeenCalled()
  })

  it('runs question lifecycle when sessionId provided', async () => {
    const repo = makeFakeRepo({
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            makeContextFact({
              id: 'fact-1',
              factKey: 'business_name',
              value: 'Acme Corp',
              sourceExcerpt: 'Acme Corp',
              confidence: 0.5,
            }),
          ],
        },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            {
              id: 'q-stale',
              workspaceId: 'ws-1',
              sessionId: 'session-1',
              businessId: 'biz-1',
              factKey: 'brand_tone',
              questionType: 'confirm',
              question: 'What is your brand tone?',
              options: [],
              reason: 'low-confidence fact',
              priority: 1,
              status: 'open',
              answer: null,
              answeredBy: null,
              answeredAt: null,
            },
          ],
        },
      }),
    })
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: 'session-1',
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' }],
    })

    expect(result.ok).toBe(true)
    expect(repo.listOnboardingQuestions).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      sessionId: 'session-1',
    })
    expect(repo.createOnboardingQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ factKey: 'business_name' }),
    )
    expect(repo.dismissOnboardingQuestion).toHaveBeenCalledWith('ws-1', 'q-stale')
  })

  it('returns failure when listOnboardingQuestions fails with sessionId present', async () => {
    const repo = makeFakeRepo({
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [] },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'ONBOARDING_LIST_FAILED', message: 'db read error' },
      }),
    })
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: 'session-1',
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' }],
    })

    // Failure must be returned, not swallowed with empty questions
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('ONBOARDING_LIST_FAILED')
    }
  })

  it('returns failure when dismissOnboardingQuestion fails', async () => {
    const repo = makeFakeRepo({
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            makeContextFact({
              id: 'fact-low',
              factKey: 'business_name',
              value: 'Acme',
              sourceExcerpt: 'Acme',
              confidence: 0.3,
            }),
          ],
        },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            {
              id: 'q-stale',
              workspaceId: 'ws-1',
              sessionId: 'session-1',
              businessId: 'biz-1',
              factKey: 'brand_tone',
              questionType: 'confirm',
              question: 'What is your brand tone?',
              options: [],
              reason: 'low-confidence fact',
              priority: 1,
              status: 'open',
              answer: null,
              answeredBy: null,
              answeredAt: null,
            },
          ],
        },
      }),
      dismissOnboardingQuestion: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'DISMISS_FAILED', message: 'db write error' },
      }),
    })
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: 'session-1',
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('DISMISS_FAILED')
    }
  })

  it('produces gapKeys and questions when sessionId non-null but runId null', async () => {
    const repo = makeFakeRepo({
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            makeContextFact({
              id: 'fact-low',
              factKey: 'business_name',
              value: 'Acme',
              sourceExcerpt: 'Acme',
              confidence: 0.3,
            }),
          ],
        },
      }),
    })
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: null,
      sessionId: 'session-1',
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme', parserName: 'docling' }],
    })

    expect(result.ok).toBe(true)
    // Quality-gate rows must NOT be created (no runId)
    expect(repo.createQualityGateResult).not.toHaveBeenCalled()
    // But question lifecycle MUST see the gap and create a question
    expect(repo.listOnboardingQuestions).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      sessionId: 'session-1',
    })
    expect(repo.createOnboardingQuestion).toHaveBeenCalled()
  })

  // ── Task 2 new tests ──────────────────────────────────────────────────────

  it('forwards parserName from each document to extraction', async () => {
    const repo = makeFakeRepo()
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [
        { sourceDocumentId: 'doc-1', contentText: 'content A', parserName: 'docling' },
        { sourceDocumentId: 'doc-2', contentText: 'content B', parserName: 'firecrawl' },
      ],
    })

    expect(extractor.extractFacts).toHaveBeenCalledTimes(2)
    const calls = extractor.extractFacts.mock.calls
    expect(calls[0][0].parserName).toBe('docling')
    expect(calls[0][0].sourceDocumentId).toBe('doc-1')
    expect(calls[1][0].parserName).toBe('firecrawl')
    expect(calls[1][0].sourceDocumentId).toBe('doc-2')
  })

  it('two documents with different keys produce facts with correct sourceDocumentId', async () => {
    const repo = makeFakeRepo()
    const extractor = makeFakeExtractor({
      extractFacts: vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          data: {
            facts: [
              { factKey: 'business_name', value: 'Acme', sourceExcerpt: 'Acme', evidenceLocator: null, confidence: 0.9 },
            ],
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            facts: [
              { factKey: 'brand_tone', value: 'friendly', sourceExcerpt: 'friendly', evidenceLocator: null, confidence: 0.8 },
            ],
          },
        }),
    })
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [
        { sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' },
        { sourceDocumentId: 'doc-2', contentText: 'Our tone is friendly', parserName: 'docling' },
      ],
    })

    expect(result.ok).toBe(true)
    const creates = repo.persistFactReconciliation.mock.calls[0][3] as PersistFactReconciliationCreate[]
    expect(creates.length).toBe(2)

    const byKey = new Map(creates.map(c => [c.factKey, c]))
    expect(byKey.get('business_name')!.sourceDocumentId).toBe('doc-1')
    expect(byKey.get('brand_tone')!.sourceDocumentId).toBe('doc-2')
  })

  it('two documents sharing same key produce reconciled facts with sourceDocumentId from origin doc', async () => {
    const repo = makeFakeRepo()
    const extractor = makeFakeExtractor({
      extractFacts: vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          data: {
            facts: [
              { factKey: 'business_name', value: 'Acme Corp', sourceExcerpt: 'Acme Corp', evidenceLocator: null, confidence: 0.9 },
            ],
          },
        })
        .mockResolvedValueOnce({
          ok: true,
          data: {
            facts: [
              { factKey: 'business_name', value: 'Acme Corporation', sourceExcerpt: 'Acme Corporation', evidenceLocator: null, confidence: 0.95 },
            ],
          },
        }),
    })
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [
        { sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' },
        { sourceDocumentId: 'doc-2', contentText: 'Acme Corporation', parserName: 'firecrawl' },
      ],
    })

    expect(result.ok).toBe(true)
    const creates = repo.persistFactReconciliation.mock.calls[0][3]
    // Both facts should appear, each with its originating sourceDocumentId
    expect(creates.length).toBe(2)
    const docIds = creates.map((c: PersistFactReconciliationCreate) => c.sourceDocumentId)
    expect(docIds).toContain('doc-1')
    expect(docIds).toContain('doc-2')
  })

  it('sets sourceDocumentId on every PersistFactReconciliationCreate', async () => {
    const repo = makeFakeRepo()
    const extractor = makeFakeExtractor({
      extractFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          facts: [
            { factKey: 'business_name', value: 'Acme', sourceExcerpt: 'Acme', evidenceLocator: null, confidence: 0.9 },
            { factKey: 'brand_tone', value: 'bold', sourceExcerpt: 'bold', evidenceLocator: null, confidence: 0.85 },
          ],
        },
      }),
    })
    const pipeline = makePipeline(repo, extractor)

    await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [
        { sourceDocumentId: 'doc-1', contentText: 'content', parserName: 'docling' },
      ],
    })

    const creates = repo.persistFactReconciliation.mock.calls[0][3]
    for (const c of creates) {
      expect(c.sourceDocumentId).toBe('doc-1')
    }
  })

  it('returns failure immediately when createQualityGateResult fails with non-null runId', async () => {
    const repo = makeFakeRepo({
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            makeContextFact({
              id: 'fact-1',
              factKey: 'business_name',
              value: 'Acme Corp',
              sourceExcerpt: 'Acme Corp',
              confidence: 0.9,
            }),
          ],
        },
      }),
      createQualityGateResult: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'GATE_WRITE_FAILED', message: 'db write error' },
      }),
    })
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('GATE_WRITE_FAILED')
    }
  })

  it('propagates listContextFacts failure instead of treating facts as empty', async () => {
    const repo = makeFakeRepo({
      listContextFacts: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: 'LIST_FAILED', message: 'db read error' },
      }),
    })
    const extractor = makeFakeExtractor()
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [{ sourceDocumentId: 'doc-1', contentText: 'Acme Corp', parserName: 'docling' }],
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('LIST_FAILED')
    }
  })

  it('extraction failure for one document propagates as failure, not warning', async () => {
    const repo = makeFakeRepo()
    const extractor = makeFakeExtractor({
      extractFacts: vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          data: {
            facts: [
              { factKey: 'business_name', value: 'Acme', sourceExcerpt: 'Acme', evidenceLocator: null, confidence: 0.9 },
            ],
          },
        })
        .mockResolvedValueOnce({
          ok: false,
          error: { code: 'EXTRACTION_FAILED', message: 'LLM error on doc-2' },
        }),
    })
    const pipeline = makePipeline(repo, extractor)

    const result = await pipeline.process({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      sourceId: 'src-1',
      sourceType: 'website',
      existingFacts: [],
      runId: 'run-1',
      sessionId: null,
      documents: [
        { sourceDocumentId: 'doc-1', contentText: 'content A', parserName: 'docling' },
        { sourceDocumentId: 'doc-2', contentText: 'content B', parserName: 'docling' },
      ],
    })

    // Must fail, not degrade to ok with warnings
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('EXTRACTION_FAILED')
    }
  })
})
