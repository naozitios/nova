import type { RepositoryPort } from '../repository.port'
import type { JsonValue } from '../types'
import { compileDraftFromFacts } from '../compiler'

export interface OnboardingReview {
  profile: Record<string, JsonValue>
  unresolvedFields: string[]
  warnings: string[]
  sources: {
    id: string
    name: string
    type: string
    status: string
  }[]
  questions: {
    factKey: string
    question: string
    answer: JsonValue | null
  }[]
}

export async function getOnboardingReview(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<{ ok: true; data: OnboardingReview } | { ok: false; error: { code: string; message: string } }> {
  const sessionResult = await repo.listOnboardingSessions({ workspaceId, businessId })
  if (!sessionResult.ok) return sessionResult
  if (sessionResult.data.items.length === 0) {
    return { ok: false, error: { code: 'NO_SESSION', message: 'No onboarding session found' } }
  }
  const session = sessionResult.data.items[0]

  const draftResult = await compileDraftFromFacts(repo, businessId, workspaceId)
  if (!draftResult.ok) return draftResult

  const questionsResult = await repo.listOnboardingQuestions({
    workspaceId,
    sessionId: session.id,
  })
  if (!questionsResult.ok) return questionsResult

  const openQuestions = questionsResult.data.items
    .filter((q) => q.status === 'open')
    .map((q) => ({
      factKey: q.factKey,
      question: q.question,
      answer: q.answer as JsonValue | null,
    }))

  const sourcesResult = await repo.listContextSources({ workspaceId, businessId })
  if (!sourcesResult.ok) return sourcesResult

  const sources = sourcesResult.data.items.map((s) => ({
    id: s.id,
    name: s.sourceName,
    type: s.sourceType,
    status: s.status,
  }))

  return {
    ok: true,
    data: {
      profile: draftResult.data.profile,
      unresolvedFields: draftResult.data.unresolvedFields,
      warnings: draftResult.data.warnings,
      sources,
      questions: openQuestions,
    },
  }
}
