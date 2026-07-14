import type { RepositoryPort } from './repository.port'
import type {
  Business,
  OnboardingSession,
  BusinessProfileVersion,
  ServiceResult,
  JsonValue,
} from './types'
import { OnboardingStatus } from './types'

// ─── Input types ────────────────────────────────────────────────────────────

export interface CreateBusinessInput {
  workspaceId: string
  name: string
  primaryMarket: string
  primaryAdvertisingObjective: string
  primaryBusinessOutcome: string
  approximateMonthlyMetaBudget: number
  initialSources: Array<{
    sourceType: string
    sourceName: string
    externalReference?: string
  }>
}

export interface SubmitAnswersInput {
  answers: Array<{
    factKey: string
    answer: JsonValue
  }>
}

// ─── Onboarding lifecycle ────────────────────────────────────────────────────

export async function createBusiness(
  repo: RepositoryPort,
  input: CreateBusinessInput,
): Promise<ServiceResult<Business>> {
  const result = await repo.createBusiness({
    workspaceId: input.workspaceId,
    name: input.name,
    websiteUrl: null,
    status: 'active',
  })

  if (!result.ok) return result

  for (const source of input.initialSources) {
    await repo.createContextSource({
      workspaceId: input.workspaceId,
      businessId: result.data.id,
      sourceType: source.sourceType as any,
      sourceName: source.sourceName,
      externalReference: source.externalReference ?? null,
      status: 'registered',
      currentStage: null,
      terminalOutcome: null,
      metadata: {},
      collectedAt: new Date(),
    })
  }

  return result
}

export async function createSession(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  userId: string,
): Promise<ServiceResult<OnboardingSession>> {
  const business = await repo.getBusiness(workspaceId, businessId)
  if (!business.ok) return business
  if (!business.data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Business not found' } }
  }

  return repo.createOnboardingSession({
    workspaceId,
    businessId,
    status: OnboardingStatus.CREATED,
    currentStep: null,
    startedBy: userId,
    startedAt: new Date(),
    completedAt: null,
    error: null,
  })
}

export async function getSession(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<ServiceResult<OnboardingSession | null>> {
  const result = await repo.listOnboardingSessions({
    workspaceId,
    businessId,
  })

  if (!result.ok) return result
  if (result.data.items.length === 0) {
    return { ok: true, data: null }
  }

  return { ok: true, data: result.data.items[0] }
}

export async function submitAnswers(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  userId: string,
  input: SubmitAnswersInput,
): Promise<ServiceResult<void>> {
  const sessionResult = await getSession(repo, businessId, workspaceId)
  if (!sessionResult.ok) return sessionResult

  let session = sessionResult.data
  if (!session) {
    const createResult = await createSession(repo, businessId, workspaceId, userId)
    if (!createResult.ok) return createResult
    session = createResult.data
  }

  for (const item of input.answers) {
    await repo.createOnboardingQuestion({
      workspaceId,
      sessionId: session.id,
      businessId,
      factKey: item.factKey,
      questionType: 'user_answer',
      question: '',
      options: null,
      reason: 'User provided answer',
      priority: 0,
      status: 'answered',
      answer: item.answer,
      answeredBy: userId,
      answeredAt: new Date(),
    })
  }

  return { ok: true, data: undefined }
}

export async function compileOnboardingDraft(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<ServiceResult<Record<string, JsonValue>>> {
  const sessionResult = await getSession(repo, businessId, workspaceId)
  if (!sessionResult.ok) return sessionResult
  if (!sessionResult.data) {
    return { ok: false, error: { code: 'NO_SESSION', message: 'No onboarding session found' } }
  }

  const questionsResult = await repo.listOnboardingQuestions({
    workspaceId,
    sessionId: sessionResult.data.id,
  })
  if (!questionsResult.ok) return questionsResult

  const profile: Record<string, JsonValue> = {}
  for (const q of questionsResult.data.items) {
    if (q.status === 'answered' && q.answer !== null) {
      profile[q.factKey] = q.answer
    }
  }

  return { ok: true, data: profile }
}

export async function approveV1(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  approverId: string,
): Promise<ServiceResult<BusinessProfileVersion>> {
  const sessionResult = await getSession(repo, businessId, workspaceId)
  if (!sessionResult.ok) return sessionResult
  if (!sessionResult.data) {
    return { ok: false, error: { code: 'NO_SESSION', message: 'No onboarding session found' } }
  }

  const compileResult = await compileOnboardingDraft(repo, businessId, workspaceId)
  if (!compileResult.ok) return compileResult

  const { validateProfile } = await import('./compiler')
  const validation = await validateProfile(repo, businessId, workspaceId, compileResult.data)
  if (!validation.ok) return validation
  if (!validation.data.valid) {
    return {
      ok: false,
      error: {
        code: 'PROFILE_INCOMPLETE',
        message: `Missing required sections: ${validation.data.missingSections.join(', ')}`,
        details: {
          missingSections: validation.data.missingSections as any,
          unresolvedConflicts: validation.data.unresolvedConflicts.length as any,
        },
      },
    }
  }

  const { approveBusinessProfile } = await import('./versioning')
  return approveBusinessProfile(repo, businessId, workspaceId, compileResult.data, approverId)
}
