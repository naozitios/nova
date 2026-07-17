import { describe, expect, it, vi } from 'vitest'
import { SourceProcessingService } from '@/core/business-context/service/source-processing.service'
import { makeAdapter, makeJob, makeSource } from '@/core/business-context/service/source-processing.fixture'
import { createFakeRepository } from '../../harness/test-repository'
import type { ContextFact } from '@/core/business-context/types'

function existingFact(): ContextFact {
  return {
    id: 'fact-website-20',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    factKey: 'offers.discount',
    value: '20%',
    sourceId: 'src-website',
    sourceDocumentId: 'doc-website',
    sourceExcerpt: '20% off',
    evidenceLocator: null,
    confidence: 0.8,
    verificationStatus: 'extracted',
    supersedesFactId: null,
    validFrom: new Date(),
    validTo: null,
    createdAt: new Date(),
    createdBy: 'system',
  }
}

describe('Meta conflict reconciliation', () => {
  it('keeps existing website fact and records conflict instead of letting Meta overwrite it', async () => {
    const persistFactReconciliation = vi.fn().mockResolvedValue({ ok: true, data: { created_fact_ids: [], conflict_ids: ['conflict-1'] } })
    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({ ok: true, data: makeSource({ sourceType: 'meta' }) }),
      updateContextSource: vi.fn().mockResolvedValue({ ok: true, data: null }),
      listProcessingRuns: vi.fn().mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
      createProcessingRun: vi.fn().mockResolvedValue({ ok: true, data: { id: 'run-1' } }),
      updateProcessingRun: vi.fn().mockResolvedValue({ ok: true, data: null }),
      createStageEvent: vi.fn().mockResolvedValue({ ok: true, data: null }),
      listContextFacts: vi
        .fn()
        .mockResolvedValueOnce({ ok: true, data: { items: [existingFact()], total: 1 } })
        .mockResolvedValue({ ok: true, data: { items: [], total: 0 } }),
      createSourceDocument: vi.fn().mockResolvedValue({ ok: true, data: { id: 'doc-meta' } }),
      createQualityGateResult: vi.fn().mockResolvedValue({ ok: true, data: null }),
      persistFactReconciliation,
    })
    const extractionPort = {
      extractFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          facts: [
            {
              factKey: 'offers.discount',
              value: '50%',
              confidence: 0.99,
              sourceExcerpt: '50% off',
              evidenceLocator: null,
            },
          ],
          conflicts: [],
          warnings: [],
        },
      }),
      reconcileFacts: vi.fn(),
    }
    const service = new SourceProcessingService(repo, extractionPort)
    service.registerAdapter(makeAdapter({ supports: (t) => t === 'meta' }))

    const result = await service.processSource('biz-1', 'ws-1', 'src-1', { job: makeJob() })

    expect(result.ok).toBe(true)
    expect(persistFactReconciliation).toHaveBeenCalledWith(
      'ws-1',
      'biz-1',
      [],
      [],
      [{ factKey: 'offers.discount', factIds: ['fact-website-20'] }],
    )
  })
})
