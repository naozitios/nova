import { describe, expect, it } from 'vitest'
import { computeQuestionLifecycle, type QuestionLifecycleInput } from './question-lifecycle'
import type { OnboardingQuestion } from '../types'

function q(overrides: Partial<OnboardingQuestion>): OnboardingQuestion {
  return {
    id: 'q-1',
    workspaceId: 'ws-1',
    sessionId: 'sess-1',
    businessId: 'biz-1',
    factKey: 'business.name',
    questionType: 'text',
    question: 'What is your business name?',
    options: null,
    reason: 'Required for business profile',
    priority: 100,
    status: 'open',
    answer: null,
    answeredBy: null,
    answeredAt: null,
    ...overrides,
  }
}

function input(overrides: Partial<QuestionLifecycleInput> = {}): QuestionLifecycleInput {
  return {
    gaps: ['business.name', 'offers.primary'],
    existingQuestions: [],
    businessId: 'biz-1',
    workspaceId: 'ws-1',
    sessionId: 'sess-1',
    ...overrides,
  }
}

describe('computeQuestionLifecycle', () => {
  it('creates questions for all gaps when no existing questions', () => {
    const r = computeQuestionLifecycle(input())
    expect(r.toCreate).toHaveLength(2)
    expect(r.toCreate.map((c) => c.factKey)).toEqual(['business.name', 'offers.primary'])
    expect(r.toDismiss).toHaveLength(0)
    expect(r.history).toHaveLength(0)
  })

  it('preserves answered questions in history', () => {
    const answered = q({
      id: 'q-ans',
      factKey: 'business.name',
      status: 'answered',
      answer: 'Acme',
      answeredBy: 'user-1',
      answeredAt: new Date(),
    })
    const r = computeQuestionLifecycle(input({ existingQuestions: [answered] }))
    expect(r.history).toHaveLength(1)
    expect(r.history[0].id).toBe('q-ans')
    expect(r.toCreate).toHaveLength(1)
    expect(r.toCreate[0].factKey).toBe('offers.primary')
  })

  it('does not duplicate open questions for the same factKey', () => {
    const open = q({ id: 'q-open', factKey: 'business.name', status: 'open' })
    const r = computeQuestionLifecycle(input({ existingQuestions: [open] }))
    expect(r.toCreate).toHaveLength(1)
    expect(r.toCreate[0].factKey).toBe('offers.primary')
  })

  it('deduplicates repeated gaps for the same normalized factKey', () => {
    const r = computeQuestionLifecycle(input({
      gaps: ['customers.target_segment', ' Customers.Target_Segment '],
    }))
    expect(r.toCreate).toHaveLength(1)
    expect(r.toCreate[0].factKey).toBe('customers.target_segment')
  })

  it('dismisses obsolete open questions when gap is resolved', () => {
    const open = q({ id: 'q-obs', factKey: 'offers.pricing', status: 'open' })
    const r = computeQuestionLifecycle(input({ existingQuestions: [open] }))
    expect(r.toDismiss).toEqual(['q-obs'])
  })

  it('does not dismiss answered questions even when gap is resolved', () => {
    const answered = q({
      id: 'q-done',
      factKey: 'offers.pricing',
      status: 'answered',
      answer: '$10-50',
      answeredBy: 'user-1',
      answeredAt: new Date(),
    })
    const r = computeQuestionLifecycle(input({ existingQuestions: [answered] }))
    expect(r.toDismiss).toHaveLength(0)
    expect(r.history).toHaveLength(1)
  })

  it('produces stable priority ordering for same gaps', () => {
    const r1 = computeQuestionLifecycle(input({ gaps: ['brand.tone', 'business.name', 'offers.primary'] }))
    const r2 = computeQuestionLifecycle(input({ gaps: ['brand.tone', 'business.name', 'offers.primary'] }))
    expect(r1.toCreate.map((c) => c.factKey)).toEqual(r2.toCreate.map((c) => c.factKey))
    expect(r1.toCreate.map((c) => c.priority)).toEqual(r2.toCreate.map((c) => c.priority))
  })

  it('returns empty result when all gaps are covered by open or answered questions', () => {
    const open1 = q({ id: 'q-1', factKey: 'business.name', status: 'open' })
    const open2 = q({ id: 'q-2', factKey: 'offers.primary', status: 'open' })
    const r = computeQuestionLifecycle(input({ existingQuestions: [open1, open2] }))
    expect(r.toCreate).toHaveLength(0)
    expect(r.toDismiss).toHaveLength(0)
  })

  it('includes dismissed questions in history alongside answered ones', () => {
    const answered = q({
      id: 'q-ans',
      factKey: 'business.name',
      status: 'answered',
      answer: 'Acme',
      answeredBy: 'user-1',
      answeredAt: new Date(),
    })
    const dismissed = q({
      id: 'q-dis',
      factKey: 'offers.pricing',
      status: 'open',
    })
    const r = computeQuestionLifecycle(
      input({ existingQuestions: [answered, dismissed] }),
    )
    expect(r.history).toHaveLength(2)
    expect(r.history.map((h) => h.id).sort()).toEqual(['q-ans', 'q-dis'])
    expect(r.toDismiss).toEqual(['q-dis'])
  })

  it('generates fallback question for unknown factKey', () => {
    const r = computeQuestionLifecycle(input({ gaps: ['custom.unknown_key'] }))
    expect(r.toCreate).toHaveLength(1)
    expect(r.toCreate[0].question).toBe('Please provide: custom.unknown_key')
  })
})
