import { describe, expect, it } from 'vitest'
import { ManualSourceAdapter } from './manual-source.adapter'
import type { ContextSource, JsonValue } from '@/core/business-context/types'
import type { ManualAnswer, ManualCorrection } from './manual-source.adapter'

function asJson(value: unknown): JsonValue {
  return value as JsonValue
}

function makeSource(overrides: Partial<ContextSource> = {}): ContextSource {
  return {
    id: 'src-manual-1',
    workspaceId: 'ws-1',
    businessId: 'biz-1',
    sourceType: 'user_answer',
    sourceName: 'User Questionnaire',
    externalReference: null,
    status: 'registered',
    currentStage: null,
    terminalOutcome: null,
    metadata: {},
    collectedAt: new Date('2026-07-15T10:00:00Z'),
    ...overrides,
  }
}

describe('ManualSourceAdapter.supports', () => {
  const adapter = new ManualSourceAdapter()

  it('accepts user_answer', () => {
    expect(adapter.supports('user_answer')).toBe(true)
  })

  it('accepts system_inference', () => {
    expect(adapter.supports('system_inference')).toBe(true)
  })

  it('rejects website', () => {
    expect(adapter.supports('website')).toBe(false)
  })

  it('rejects meta', () => {
    expect(adapter.supports('meta')).toBe(false)
  })

  it('rejects upload', () => {
    expect(adapter.supports('upload')).toBe(false)
  })
})

describe('ManualSourceAdapter.collect — user answers', () => {
  const adapter = new ManualSourceAdapter()

  it('formats answers into document contentText', async () => {
    const answers: ManualAnswer[] = [
      { factKey: 'brand_name', value: 'Acme Corp' },
      { factKey: 'target_audience', value: 'SMB owners', confidence: 0.9 },
      { factKey: 'budget_range', value: '$10k-$50k', note: 'Q3 budget' },
    ]
    const source = makeSource({
      metadata: { answers: asJson(answers), questionId: 'q-brand-1' },
    })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const doc = result.data.documents[0]
    expect(doc.contentText).toContain('## User Answer (Question: q-brand-1)')
    expect(doc.contentText).toContain('- **brand_name**: "Acme Corp"')
    expect(doc.contentText).toContain('- **target_audience**: "SMB owners" (confidence: 90%)')
    expect(doc.contentText).toContain('- **budget_range**: "$10k-$50k"')
    expect(doc.contentText).toContain('_Note: Q3 budget_')
  })

  it('formats answers without questionId header', async () => {
    const answers: ManualAnswer[] = [
      { factKey: 'industry', value: 'Technology' },
    ]
    const source = makeSource({
      metadata: { answers: asJson(answers) },
    })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const doc = result.data.documents[0]
    expect(doc.contentText).toContain('## User Answer')
    expect(doc.contentText).not.toContain('(Question:')
  })
})

describe('ManualSourceAdapter.collect — corrections', () => {
  const adapter = new ManualSourceAdapter()

  it('formats corrections into document contentText', async () => {
    const corrections: ManualCorrection[] = [
      {
        factKey: 'annual_revenue',
        previousValue: '$5M',
        newValue: '$12M',
        reason: 'Updated per 10-K filing',
      },
    ]
    const source = makeSource({
      sourceType: 'user_answer',
      metadata: { corrections: asJson(corrections) },
    })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const doc = result.data.documents[0]
    expect(doc.contentText).toContain('## Manual Corrections')
    expect(doc.contentText).toContain('- **annual_revenue**:')
    expect(doc.contentText).toContain('- Previous: "$5M"')
    expect(doc.contentText).toContain('- Corrected: "$12M"')
    expect(doc.contentText).toContain('- Reason: Updated per 10-K filing')
  })

  it('joins answers and corrections with separator', async () => {
    const answers: ManualAnswer[] = [
      { factKey: 'industry', value: 'Healthcare' },
    ]
    const corrections: ManualCorrection[] = [
      {
        factKey: 'old_fact',
        previousValue: 'old',
        newValue: 'new',
        reason: 'Outdated',
      },
    ]
    const source = makeSource({
      metadata: { answers: asJson(answers), corrections: asJson(corrections) },
    })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const doc = result.data.documents[0]
    expect(doc.contentText).toContain('## User Answer')
    expect(doc.contentText).toContain('## Manual Corrections')
    expect(doc.contentText).toContain('\n\n---\n\n')
  })
})
