// ─── Deterministic onboarding question lifecycle ────────────────────────────

import type { OnboardingQuestion } from '../types'
import { normalizeFactKey } from './normalize'
import { generateQuestionsForGaps } from './questions'

export interface QuestionLifecycleInput {
  gaps: string[]
  existingQuestions: OnboardingQuestion[]
  businessId: string
  workspaceId: string
  sessionId: string
}

export interface QuestionLifecycleResult {
  toCreate: Omit<OnboardingQuestion, 'id'>[]
  toDismiss: string[]
  history: OnboardingQuestion[]
}

export function computeQuestionLifecycle(
  input: QuestionLifecycleInput,
): QuestionLifecycleResult {
  const { gaps, existingQuestions, businessId, workspaceId, sessionId } = input

  const answered = existingQuestions.filter((q) => q.status === 'answered')
  const open = existingQuestions.filter((q) => q.status === 'open')

  const answeredKeys = new Set(answered.map((q) => normalizeFactKey(q.factKey)))
  const openKeys = new Set(open.map((q) => normalizeFactKey(q.factKey)))

  const normalizedGaps = gaps.map((g) => normalizeFactKey(g))
  const openKeySet = new Set(normalizedGaps)

  const dismissed = open.filter(
    (q) => !openKeySet.has(normalizeFactKey(q.factKey)),
  )
  const toDismiss = dismissed.map((q) => q.id)

  const uncovered = gaps.filter((g) => {
    const norm = normalizeFactKey(g)
    return !answeredKeys.has(norm) && !openKeys.has(norm)
  })

  const toCreate = generateQuestionsForGaps(uncovered, businessId, workspaceId, sessionId)

  return { toCreate, toDismiss, history: [...answered, ...dismissed] }
}
