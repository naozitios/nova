import type { JsonValue } from '@/core/business-context/types'

export interface OnboardingReview {
  profile: Record<string, JsonValue>
  unresolvedFields: string[]
  warnings: string[]
  sources: { id: string; name: string; type: string; status: string; sourceType: string; sourceName: string; externalReference: string | null; currentStage: string | null; progress: number }[]
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
  } | null
  sources: {
    id: string
    name: string
    type: string
    status: string
    sourceType: string
    sourceName: string
    externalReference: string | null
    currentStage: string | null
    progress: number
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

type OnboardingSourceResponse = {
  id: string
  source_type?: string
  source_name?: string
  external_reference?: string | null
  status: string
  current_stage?: string | null
  progress?: number
}

export interface OnboardingSourceInput {
  sourceType: 'website' | 'upload' | 'manual_note'
  sourceName: string
  externalReference?: string | null
}

export interface OnboardingSourceResult {
  id: string
  sourceType: string
  sourceName: string
  externalReference: string | null
  status: string
  currentStage: string | null
  progress: number
}

export interface OnboardingUploadIntentInput {
  sourceName: string
  fileName: string
  mimeType: string
  sizeBytes: number
  documentClass: 'brand_deck' | 'product_document' | 'research_document' | 'campaign_brief' | 'website_content' | 'other'
}

export interface OnboardingUploadIntentResult {
  id: string
  sourceType: string
  documentClass: string
  classificationSource: string
  uploadUrl: string
  storagePath: string
  expiresAt: string
  status: string
  malwareScanStatus: string
  malwareScanCode: number | null
}

export interface CompleteOnboardingUploadInput {
  uploadId: string
  uploadUrl: string
  storagePath: string
  file: File
}

export interface SubmitOnboardingAnswersInput {
  answers: Array<{
    factKey: string
    answer: JsonValue
  }>
}

function idempotencyKey(prefix: string, businessId: string, suffix?: string): string {
  const normalizedSuffix = suffix ? `-${suffix}` : ''
  return `${prefix}-${businessId}${normalizedSuffix}-${Date.now()}`
}

function mapOnboardingSource(source: OnboardingSourceResponse): OnboardingSourceResult {
  return {
    id: source.id,
    sourceType: source.source_type ?? '',
    sourceName: source.source_name ?? '',
    externalReference: source.external_reference ?? null,
    status: source.status,
    currentStage: source.current_stage ?? null,
    progress: source.progress ?? 0,
  }
}

export async function registerOnboardingSource(
  businessId: string,
  input: OnboardingSourceInput,
): Promise<OnboardingSourceResult> {
  const res = await fetch(`/api/businesses/${businessId}/context/sources`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey('onboarding-source', businessId, input.sourceType),
      'x-user-id': '10000000-0000-0000-0000-000000000010',
    },
    body: JSON.stringify({
      source_type: input.sourceType,
      source_name: input.sourceName,
      ...(input.externalReference ? { external_reference: input.externalReference } : {}),
    }),
  })

  if (!res.ok) {
    let code: string | undefined
    try {
      const body = await res.json()
      code = body.code
    } catch {}
    throw new OnboardingApiError(`Failed to register onboarding source: ${res.status}`, res.status, code)
  }

  return mapOnboardingSource(await res.json())
}

export async function createOnboardingUploadIntent(
  businessId: string,
  input: OnboardingUploadIntentInput,
): Promise<OnboardingUploadIntentResult> {
  const res = await fetch(`/api/businesses/${businessId}/context/uploads`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey('onboarding-upload', businessId, input.fileName),
      'x-user-id': '10000000-0000-0000-0000-000000000010',
    },
    body: JSON.stringify({
      source_type: 'upload',
      source_name: input.sourceName,
      file_name: input.fileName,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      document_class: input.documentClass,
    }),
  })

  if (!res.ok) {
    let code: string | undefined
    try {
      const body = await res.json()
      code = body.code
    } catch {}
    throw new OnboardingApiError(`Failed to create onboarding upload: ${res.status}`, res.status, code)
  }

  const body = await res.json()
  return {
    id: body.id,
    sourceType: body.source_type ?? 'upload',
    documentClass: body.document_class ?? input.documentClass,
    classificationSource: body.classification_source ?? 'user_selected',
    uploadUrl: body.upload_url,
    storagePath: body.storage_path,
    expiresAt: body.expires_at,
    status: body.status,
    malwareScanStatus: body.malware_scan_status,
    malwareScanCode: body.malware_scan_code ?? null,
  }
}

export async function completeOnboardingUpload(
  businessId: string,
  input: CompleteOnboardingUploadInput,
): Promise<OnboardingSourceResult> {
  const uploadRes = await fetch(input.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': input.file.type || 'application/octet-stream' },
    body: input.file,
  })

  if (!uploadRes.ok) {
    throw new OnboardingApiError(`Failed to upload onboarding file: ${uploadRes.status}`, uploadRes.status)
  }

  const res = await fetch(`/api/businesses/${businessId}/context/uploads/${input.uploadId}/complete`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey('onboarding-upload-complete', businessId, input.uploadId),
      'x-user-id': '10000000-0000-0000-0000-000000000010',
    },
    body: JSON.stringify({ storage_path: input.storagePath }),
  })

  if (!res.ok) {
    let code: string | undefined
    try {
      const body = await res.json()
      code = body.code
    } catch {}
    throw new OnboardingApiError(`Failed to complete onboarding upload: ${res.status}`, res.status, code)
  }

  const body = await res.json()
  return mapOnboardingSource(body.source)
}

export async function submitOnboardingAnswers(
  businessId: string,
  input: SubmitOnboardingAnswersInput,
): Promise<void> {
  const res = await fetch(`/api/businesses/${businessId}/onboarding/answers`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Idempotency-Key': idempotencyKey('onboarding-answers', businessId),
      'x-user-id': '10000000-0000-0000-0000-000000000010',
    },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    let code: string | undefined
    try {
      const body = await res.json()
      code = body.code
    } catch {}
    throw new OnboardingApiError(`Failed to submit onboarding answers: ${res.status}`, res.status, code)
  }
}

export async function startOnboardingSession(
  businessId: string,
): Promise<{ id: string; status: string }> {
  const res = await fetch(`/api/businesses/${businessId}/onboarding`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey('onboarding-session', businessId),
      'x-user-id': '10000000-0000-0000-0000-000000000010',
    },
  })

  if (!res.ok) {
    let code: string | undefined
    try {
      const body = await res.json()
      code = body.code
    } catch {}
    throw new OnboardingApiError(`Failed to start onboarding session: ${res.status}`, res.status, code)
  }

  const body = await res.json()
  return { id: body.id, status: body.status }
}

export async function queueOnboardingScan(
  businessId: string,
): Promise<{ jobsQueued: number }> {
  const res = await fetch(`/api/businesses/${businessId}/onboarding/scan`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey('onboarding-scan', businessId),
      'x-user-id': '10000000-0000-0000-0000-000000000010',
    },
  })

  if (!res.ok) {
    let code: string | undefined
    try {
      const body = await res.json()
      code = body.code
    } catch {}
    throw new OnboardingApiError(`Failed to queue onboarding scan: ${res.status}`, res.status, code)
  }

  const body = await res.json()
  return { jobsQueued: body.jobs_queued ?? 0 }
}

export async function compileOnboardingDraft(
  businessId: string,
): Promise<{ profile: Record<string, JsonValue> }> {
  const res = await fetch(`/api/businesses/${businessId}/onboarding/compile`, {
    method: 'POST',
    headers: {
      'Idempotency-Key': idempotencyKey('onboarding-compile', businessId),
      'x-user-id': '10000000-0000-0000-0000-000000000010',
    },
  })

  if (!res.ok) {
    let code: string | undefined
    try {
      const body = await res.json()
      code = body.code
    } catch {}
    throw new OnboardingApiError(`Failed to compile onboarding draft: ${res.status}`, res.status, code)
  }

  const body = await res.json()
  return { profile: body.profile ?? {} }
}

export async function getOnboardingState(
  businessId: string,
  signal?: AbortSignal,
): Promise<OnboardingStateResponse> {
  const res = await fetch(`/api/businesses/${businessId}/onboarding/state`, {
    signal,
    headers: {
      'x-user-id': '10000000-0000-0000-0000-000000000010',
    },
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
    session: body.session ? {
      id: body.session.id,
      businessId: body.session.business_id,
      workspaceId: body.session.workspace_id,
      status: body.session.status,
      currentStep: body.session.current_step ?? null
    } : null,
    sources: (body.sources ?? []).map(
      (s: { id: string; name: string; type: string; status: string; source_type?: string; source_name?: string; external_reference?: string | null; current_stage?: string | null; progress?: number }) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        sourceType: s.source_type ?? s.type,
        sourceName: s.source_name ?? s.name,
        externalReference: s.external_reference ?? null,
        currentStage: s.current_stage ?? null,
        progress: s.progress ?? 0,
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
    headers: {
      'x-user-id': '10000000-0000-0000-0000-000000000010',
    },
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
      (s: { id: string; name: string; type: string; status: string; source_type?: string; source_name?: string; external_reference?: string | null; current_stage?: string | null; progress?: number }) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        sourceType: s.source_type ?? s.type,
        sourceName: s.source_name ?? s.name,
        externalReference: s.external_reference ?? null,
        currentStage: s.current_stage ?? null,
        progress: s.progress ?? 0,
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
