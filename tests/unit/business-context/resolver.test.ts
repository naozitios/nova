import { describe, expect, it } from 'vitest'
import {
  normalizeFactKey,
  deduplicateFacts,
  resolveFacts,
  detectConflicts,
  generateQuestionsForGaps,
  SOURCE_PRECEDENCE,
} from '../../../src/core/business-context/resolver'
import type { ContextFact } from '../../../src/core/business-context/types'
import type { ExtractedFact } from '../../../src/core/business-context/extraction.port'

// ─── normalizeFactKey ──────────────────────────────────────────────────────

describe('resolver.normalizeFactKey', () => {
  it('lowercases', () => {
    expect(normalizeFactKey('Business.Name')).toBe('business.name')
  })

  it('trims whitespace', () => {
    expect(normalizeFactKey('  business.name  ')).toBe('business.name')
  })

  it('collapses multiple dots', () => {
    expect(normalizeFactKey('business..name')).toBe('business.name')
  })

  it('strips leading/trailing dots', () => {
    expect(normalizeFactKey('.business.name.')).toBe('business.name')
  })

  it('normalizes underscores to dots', () => {
    expect(normalizeFactKey('business_name')).toBe('business.name')
  })
})

// ─── deduplicateFacts ──────────────────────────────────────────────────────

describe('resolver.deduplicateFacts', () => {
  it('deduplicates by normalized key, keeping highest confidence', () => {
    const facts: ExtractedFact[] = [
      { factKey: 'business.name', value: 'Acme', confidence: 0.6, sourceExcerpt: null, evidenceLocator: null },
      { factKey: 'Business.Name', value: 'Acme Corp', confidence: 0.9, sourceExcerpt: null, evidenceLocator: null },
    ]
    const result = deduplicateFacts(facts)
    expect(result).toHaveLength(1)
    expect(result[0].factKey).toBe('Business.Name')
    expect(result[0].confidence).toBe(0.9)
  })

  it('preserves order of first occurrence for equal confidence', () => {
    const facts: ExtractedFact[] = [
      { factKey: 'a.b', value: 'first', confidence: 0.8, sourceExcerpt: null, evidenceLocator: null },
      { factKey: 'A.B', value: 'second', confidence: 0.8, sourceExcerpt: null, evidenceLocator: null },
    ]
    const result = deduplicateFacts(facts)
    expect(result).toHaveLength(1)
    expect(result[0].value).toBe('first')
  })

  it('returns empty array for empty input', () => {
    expect(deduplicateFacts([])).toEqual([])
  })
})

// ─── SOURCE_PRECEDENCE ─────────────────────────────────────────────────────

describe('resolver.SOURCE_PRECEDENCE', () => {
  it('user_verified > authoritative > operational > website > meta > llm', () => {
    expect(SOURCE_PRECEDENCE.user_verified).toBeLessThan(SOURCE_PRECEDENCE.authoritative)
    expect(SOURCE_PRECEDENCE.authoritative).toBeLessThan(SOURCE_PRECEDENCE.operational)
    expect(SOURCE_PRECEDENCE.operational).toBeLessThan(SOURCE_PRECEDENCE.website)
    expect(SOURCE_PRECEDENCE.website).toBeLessThan(SOURCE_PRECEDENCE.meta)
    expect(SOURCE_PRECEDENCE.meta).toBeLessThan(SOURCE_PRECEDENCE.llm)
  })
})

// ─── resolveFacts ──────────────────────────────────────────────────────────

describe('resolver.resolveFacts', () => {
  function makeFact(overrides: Partial<ContextFact>): ContextFact {
    return {
      id: 'f-1',
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      factKey: 'business.name',
      value: 'Acme',
      sourceId: 'src-1',
      sourceDocumentId: null,
      sourceExcerpt: null,
      evidenceLocator: null,
      confidence: 0.8,
      verificationStatus: 'extracted',
      supersedesFactId: null,
      validFrom: new Date('2024-01-01'),
      validTo: null,
      createdAt: new Date('2024-01-01'),
      createdBy: 'system',
      ...overrides,
    }
  }

  it('returns empty resolution when no existing facts', () => {
    const incoming: ExtractedFact[] = [
      { factKey: 'business.name', value: 'Acme', confidence: 0.8, sourceExcerpt: null, evidenceLocator: null },
    ]
    const result = resolveFacts([], incoming)
    expect(result.toCreate).toHaveLength(1)
    expect(result.superseded).toHaveLength(0)
    expect(result.conflicts).toHaveLength(0)
  })

  it('supersedes existing when incoming has higher precedence', () => {
    const existing = makeFact({
      id: 'f-old',
      verificationStatus: 'extracted',
      confidence: 0.7,
    })
    const incoming: ExtractedFact[] = [
      { factKey: 'business.name', value: 'Acme Corp', confidence: 0.9, sourceExcerpt: null, evidenceLocator: null },
    ]
    const result = resolveFacts([existing], incoming)
    expect(result.superseded).toHaveLength(1)
    expect(result.superseded[0].oldFactId).toBe('f-old')
  })

  it('bumps confidence when same value already exists', () => {
    const existing = makeFact({
      id: 'f-same',
      value: 'Acme',
      confidence: 0.5,
      verificationStatus: 'extracted',
    })
    const incoming: ExtractedFact[] = [
      { factKey: 'business.name', value: 'Acme', confidence: 0.9, sourceExcerpt: null, evidenceLocator: null },
    ]
    const result = resolveFacts([existing], incoming)
    expect(result.toUpdate).toHaveLength(1)
    expect(result.toUpdate[0].factId).toBe('f-same')
    expect(result.toUpdate[0].confidence).toBe(0.9)
  })

  it('detects conflict when material values differ', () => {
    const existing = makeFact({
      id: 'f-diff',
      value: 'Acme Corp',
      confidence: 0.8,
    })
    const incoming: ExtractedFact[] = [
      { factKey: 'business.name', value: 'MegaCorp', confidence: 0.8, sourceExcerpt: null, evidenceLocator: null },
    ]
    const result = resolveFacts([existing], incoming)
    expect(result.conflicts).toHaveLength(1)
    expect(result.conflicts[0].factKey).toBe('business.name')
  })

  it('user_verified facts are never superseded', () => {
    const existing = makeFact({
      id: 'f-verified',
      value: 'Acme',
      verificationStatus: 'user_verified',
    })
    const incoming: ExtractedFact[] = [
      { factKey: 'business.name', value: 'MegaCorp', confidence: 1.0, sourceExcerpt: null, evidenceLocator: null },
    ]
    const result = resolveFacts([existing], incoming)
    expect(result.superseded).toHaveLength(0)
    expect(result.conflicts).toHaveLength(1)
  })
})

// ─── detectConflicts ───────────────────────────────────────────────────────

describe('resolver.detectConflicts', () => {
  it('detects material contradiction', () => {
    const facts: ContextFact[] = [
      {
        id: 'f-1', workspaceId: 'ws-1', businessId: 'biz-1', factKey: 'business.name',
        value: 'Acme', sourceId: 's-1', sourceDocumentId: null, sourceExcerpt: null,
        evidenceLocator: null, confidence: 0.8, verificationStatus: 'extracted',
        supersedesFactId: null, validFrom: new Date(), validTo: null, createdAt: new Date(), createdBy: 'system',
      },
      {
        id: 'f-2', workspaceId: 'ws-1', businessId: 'biz-1', factKey: 'business.name',
        value: 'MegaCorp', sourceId: 's-2', sourceDocumentId: null, sourceExcerpt: null,
        evidenceLocator: null, confidence: 0.8, verificationStatus: 'extracted',
        supersedesFactId: null, validFrom: new Date(), validTo: null, createdAt: new Date(), createdBy: 'system',
      },
    ]
    const conflicts = detectConflicts(facts)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].factKey).toBe('business.name')
    expect(conflicts[0].factIds).toContain('f-1')
    expect(conflicts[0].factIds).toContain('f-2')
  })

  it('returns empty when all values agree', () => {
    const facts: ContextFact[] = [
      {
        id: 'f-1', workspaceId: 'ws-1', businessId: 'biz-1', factKey: 'business.name',
        value: 'Acme', sourceId: 's-1', sourceDocumentId: null, sourceExcerpt: null,
        evidenceLocator: null, confidence: 0.8, verificationStatus: 'extracted',
        supersedesFactId: null, validFrom: new Date(), validTo: null, createdAt: new Date(), createdBy: 'system',
      },
      {
        id: 'f-2', workspaceId: 'ws-1', businessId: 'biz-1', factKey: 'business.name',
        value: 'Acme', sourceId: 's-2', sourceDocumentId: null, sourceExcerpt: null,
        evidenceLocator: null, confidence: 0.8, verificationStatus: 'extracted',
        supersedesFactId: null, validFrom: new Date(), validTo: null, createdAt: new Date(), createdBy: 'system',
      },
    ]
    expect(detectConflicts(facts)).toHaveLength(0)
  })

  it('ignores superseded facts', () => {
    const facts: ContextFact[] = [
      {
        id: 'f-1', workspaceId: 'ws-1', businessId: 'biz-1', factKey: 'business.name',
        value: 'Old', sourceId: 's-1', sourceDocumentId: null, sourceExcerpt: null,
        evidenceLocator: null, confidence: 0.8, verificationStatus: 'superseded',
        supersedesFactId: 'f-2', validFrom: new Date(), validTo: new Date(), createdAt: new Date(), createdBy: 'system',
      },
      {
        id: 'f-2', workspaceId: 'ws-1', businessId: 'biz-1', factKey: 'business.name',
        value: 'New', sourceId: 's-2', sourceDocumentId: null, sourceExcerpt: null,
        evidenceLocator: null, confidence: 0.8, verificationStatus: 'extracted',
        supersedesFactId: null, validFrom: new Date(), validTo: null, createdAt: new Date(), createdBy: 'system',
      },
    ]
    expect(detectConflicts(facts)).toHaveLength(0)
  })
})

// ─── generateQuestionsForGaps ──────────────────────────────────────────────

describe('resolver.generateQuestionsForGaps', () => {
  it('generates questions for missing required fields', () => {
    const gaps = ['business.name', 'offers.primary']
    const questions = generateQuestionsForGaps(gaps, 'biz-1', 'ws-1', 'sess-1')
    expect(questions).toHaveLength(2)
    expect(questions[0].factKey).toBe('business.name')
    expect(questions[0].status).toBe('open')
    expect(questions[0].businessId).toBe('biz-1')
  })

  it('returns empty for no gaps', () => {
    expect(generateQuestionsForGaps([], 'biz-1', 'ws-1', 'sess-1')).toHaveLength(0)
  })
})
