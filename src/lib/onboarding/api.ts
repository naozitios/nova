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

export interface OnboardingStateResponse {
  business: {
    id: string
    workspaceId: string
    name: string
    websiteUrl: string | null
    status: string
  }
  session: {
    id: string
    businessId: string
    workspaceId: string
    status: string
    currentStep: string | null
  }
  sources: {
    id: string
    name: string
    type: string
    status: string
  }[]
  questions: {
    factKey: string
    question: string
    answer: unknown
  }[]
  readiness: {
    routeStage: string
    blockers: string[]
    approvalReady: boolean
  }
  profile: {
    id: string
    version: number
    status: string
    profile: Record<string, JsonValue>
  }
  meta: {
    status: string
  }
  permissions: {
    canApprove: boolean
    role: 'viewer' | 'editor' | 'admin'
  }
}

export async function getOnboardingState(
  businessId: string,
  signal?: AbortSignal,
): Promise<OnboardingStateResponse> {
  const res = await fetch(`/api/businesses/${businessId}/onboarding/state`, {
    signal,
  })

  if (!res.ok) {
    let code: string | undefined
    try {
      const body = await res.json()
      code = body.code
    } catch {}
    throw new OnboardingApiError(
      `Failed to fetch onboarding state: ${res.status}`,
      res.status,
      code,
    )
  }

  const body = await res.json()

  return {
    business: {
      id: body.business.id,
      workspaceId: body.business.workspace_id,
      name: body.business.name,
      websiteUrl: body.business.website_url ?? null,
      status: body.business.status,
    },
    session: {
      id: body.session.id,
      businessId: body.session.business_id,
      workspaceId: body.session.workspace_id,
      status: body.session.status,
      currentStep: body.session.current_step ?? null,
    },
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
    readiness: {
      routeStage: body.readiness?.route_stage ?? 'not_started',
      blockers: body.readiness?.blockers ?? [],
      approvalReady: body.readiness?.approval_ready ?? false,
    },
    profile: {
      id: body.profile?.id ?? '',
      version: body.profile?.version ?? 0,
      status: body.profile?.status ?? 'pending',
      profile: body.profile?.profile ?? {},
    },
    meta: {
      status: body.meta?.status ?? 'not_connected',
    },
    permissions: {
      canApprove: body.permissions?.can_approve ?? false,
      role: body.permissions?.role ?? 'viewer',
    },
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
