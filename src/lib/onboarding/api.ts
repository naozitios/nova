import type { JsonValue } from '@/core/business-context/types'

export interface OnboardingReview {
  profile: Record<string, JsonValue>
  unresolvedFields: string[]
  warnings: string[]
  sources: { id: string; name: string; type: string; status: string }[]
  questions: { factKey: string; question: string; answer: unknown }[]
}

export class OnboardingApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message)
    this.name = 'OnboardingApiError'
  }
}

export function createOnboardingReviewRequest(businessId: string) {
  const controller = new AbortController()
  const promise = fetchOnboardingReview(businessId, controller.signal)
  return {
    promise,
    abort: () => controller.abort(),
  }
}

export async function fetchOnboardingReview(
  businessId: string,
  signal?: AbortSignal,
): Promise<OnboardingReview> {
  const res = await fetch(`/api/businesses/${businessId}/onboarding/review`, {
    signal,
  })

  if (!res.ok) {
    let code: string | undefined
    try {
      const body = await res.json()
      code = body.code
    } catch {}
    throw new OnboardingApiError(
      `Failed to fetch onboarding review: ${res.status}`,
      res.status,
      code,
    )
  }

  const body = await res.json()

  return {
    profile: body.profile ?? {},
    unresolvedFields: body.unresolved_fields ?? [],
    warnings: body.warnings ?? [],
    sources: (body.sources ?? []).map(
      (s: { id: string; name: string; type: string; status: string }) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        status: s.status,
      }),
    ),
    questions: (body.questions ?? []).map(
      (q: { fact_key: string; question: string; answer: unknown }) => ({
        factKey: q.fact_key,
        question: q.question,
        answer: q.answer,
      }),
    ),
  }
}
