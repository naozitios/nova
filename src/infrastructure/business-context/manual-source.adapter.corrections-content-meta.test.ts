import { describe, expect, it, vi } from 'vitest'
import { ManualSourceAdapter } from './manual-source.adapter'
import type { ContextSource, JsonValue } from '@/core/business-context/types'
import type { ManualAnswer } from './manual-source.adapter'

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

describe('ManualSourceAdapter.collect — default content', () => {
  const adapter = new ManualSourceAdapter()

  it('creates default content when no answers, corrections, or content', async () => {
    const source = makeSource({
      sourceType: 'system_inference',
      sourceName: 'AI Inference',
      metadata: {},
    })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const doc = result.data.documents[0]
    expect(doc.contentText).toContain('## System Inference')
    expect(doc.contentText).toContain('- **Source**: AI Inference')
    expect(doc.contentText).toContain('- **Type**: system_inference')
    expect(doc.contentText).toContain('- **Submitted**: 2026-07-15T10:00:00.000Z')
  })

  it('creates default content for user_answer type', async () => {
    const source = makeSource({
      sourceType: 'user_answer',
      sourceName: 'Empty Response',
      externalReference: 'ref-123',
      metadata: {},
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
    expect(doc.contentText).toContain('- **Reference**: ref-123')
  })

  it('omits reference line when externalReference is null', async () => {
    const source = makeSource({
      sourceType: 'user_answer',
      sourceName: 'No Ref',
      externalReference: null,
      metadata: {},
    })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.documents[0].contentText).not.toContain('**Reference**')
  })
})

describe('ManualSourceAdapter.collect — raw content', () => {
  const adapter = new ManualSourceAdapter()

  it('includes raw content string in document', async () => {
    const source = makeSource({
      metadata: { content: 'Freeform user text about the business.' },
    })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.documents[0].contentText).toContain(
      'Freeform user text about the business.',
    )
  })
})

describe('ManualSourceAdapter.collect — metadata provenance', () => {
  const adapter = new ManualSourceAdapter()

  it('sets answeredAt as ISO string', async () => {
    const source = makeSource()
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(typeof result.data.metadata.answeredAt).toBe('string')
    expect(() => new Date(result.data.metadata.answeredAt as string)).not.toThrow()
  })

  it('includes questionId from metadata', async () => {
    const source = makeSource({
      metadata: { questionId: 'q-setup-3' },
    })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.metadata.questionId).toBe('q-setup-3')
  })

  it('defaults questionId to null', async () => {
    const source = makeSource({ metadata: {} })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.metadata.questionId).toBeNull()
  })

  it('counts answers and corrections', async () => {
    const answers: ManualAnswer[] = [
      { factKey: 'a', value: 1 },
      { factKey: 'b', value: 2 },
      { factKey: 'c', value: 3 },
    ]
    const source = makeSource({ metadata: { answers: asJson(answers) } })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.metadata.answerCount).toBe(3)
    expect(result.data.metadata.correctionCount).toBe(0)
  })

  it('sets isUserVerified true for user_answer', async () => {
    const source = makeSource({ sourceType: 'user_answer' })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.metadata.isUserVerified).toBe(true)
  })

  it('sets isUserVerified false for system_inference', async () => {
    const source = makeSource({ sourceType: 'system_inference' })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.metadata.isUserVerified).toBe(false)
  })
})

describe('ManualSourceAdapter.collect — document provenance', () => {
  const adapter = new ManualSourceAdapter()

  it('includes sourceType and questionId in document metadata', async () => {
    const source = makeSource({
      sourceType: 'user_answer',
      metadata: { questionId: 'q-7' },
    })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const doc = result.data.documents[0]
    expect(doc.metadata?.sourceType).toBe('user_answer')
    expect(doc.metadata?.questionId).toBe('q-7')
  })

  it('sets mimeType to text/markdown', async () => {
    const source = makeSource()
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.documents[0].mimeType).toBe('text/markdown')
  })

  it('sets document title from sourceName', async () => {
    const source = makeSource({ sourceName: 'My Survey' })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.documents[0].title).toBe('My Survey')
  })

  it('carries sourceType and sourceName at top level', async () => {
    const source = makeSource({
      sourceType: 'user_answer',
      sourceName: 'Q1 Response',
      externalReference: 'ref-42',
    })
    const result = await adapter.collect({
      workspaceId: 'ws-1',
      businessId: 'biz-1',
      source,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.sourceType).toBe('user_answer')
    expect(result.data.sourceName).toBe('Q1 Response')
    expect(result.data.externalReference).toBe('ref-42')
  })
})

describe('ManualSourceAdapter.collect — no external calls', () => {
  it('never invokes fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    try {
      const adapter = new ManualSourceAdapter()
      const source = makeSource({
        metadata: {
          answers: asJson([{ factKey: 'k', value: 'v' }]),
        },
      })
      await adapter.collect({
        workspaceId: 'ws-1',
        businessId: 'biz-1',
        source,
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      vi.restoreAllMocks()
    }
  })
})
