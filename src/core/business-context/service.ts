import type { RepositoryPort } from './repository.port'
import type {
  Business,
  OnboardingSession,
  BusinessProfileVersion,
  ContextSource,
  ContextJob,
  ServiceResult,
  JsonValue,
} from './types'
import { OnboardingStatus, SourceProcessingStage, JobStatus } from './types'

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

// ─── Source management ─────────────────────────────────────────────────────

export interface RegisterSourceInput {
  sourceType: string
  sourceName: string
  externalReference?: string
}

export async function registerSource(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  input: RegisterSourceInput,
): Promise<ServiceResult<ContextSource>> {
  const business = await repo.getBusiness(workspaceId, businessId)
  if (!business.ok) return business
  if (!business.data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Business not found' } }
  }

  return repo.createContextSource({
    workspaceId,
    businessId,
    sourceType: input.sourceType as any,
    sourceName: input.sourceName,
    externalReference: input.externalReference ?? null,
    status: 'registered',
    currentStage: null,
    terminalOutcome: null,
    metadata: {},
    collectedAt: new Date(),
  })
}

export async function listSources(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<ServiceResult<{ items: ContextSource[]; total: number }>> {
  return repo.listContextSources({
    workspaceId,
    businessId,
  })
}

export async function getSource(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  sourceId: string,
): Promise<ServiceResult<ContextSource | null>> {
  return repo.getContextSource(workspaceId, sourceId)
}

export async function processSource(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  sourceId: string,
): Promise<ServiceResult<ContextJob>> {
  const source = await repo.getContextSource(workspaceId, sourceId)
  if (!source.ok) return source
  if (!source.data || source.data.businessId !== businessId) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Source not found' } }
  }

  const idempotencyKey = `process-${sourceId}-${Date.now()}`
  
  const jobResult = await repo.createContextJob({
    workspaceId,
    businessId,
    sessionId: null,
    jobType: 'source_processing',
    status: JobStatus.QUEUED,
    attemptCount: 0,
    maxAttempts: 3,
    idempotencyKey,
    stage: SourceProcessingStage.QUEUED,
    input: { sourceId, sourceType: source.data.sourceType },
    output: null,
    error: null,
    errorClass: null,
    retryPolicy: {},
    nextRunAt: null,
    lockedBy: null,
    lockedAt: null,
    heartbeatAt: null,
    stageTimeoutSeconds: null,
    startedAt: null,
    completedAt: null,
  })

  if (!jobResult.ok) return jobResult

  await repo.updateContextSource(workspaceId, sourceId, {
    status: 'queued',
    currentStage: SourceProcessingStage.QUEUED,
  })

  return jobResult
}

export async function archiveSource(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  sourceId: string,
): Promise<ServiceResult<ContextSource>> {
  const source = await repo.getContextSource(workspaceId, sourceId)
  if (!source.ok) return source
  if (!source.data || source.data.businessId !== businessId) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Source not found' } }
  }

  return repo.updateContextSource(workspaceId, sourceId, {
    status: 'archived',
    terminalOutcome: 'archived' as any,
  })
}

export async function queueScan(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<ServiceResult<ContextJob[]>> {
  const sourcesResult = await repo.listContextSources({
    workspaceId,
    businessId,
    status: 'registered',
  })
  if (!sourcesResult.ok) return sourcesResult

  const jobs: ContextJob[] = []
  for (const source of sourcesResult.data.items) {
    const idempotencyKey = `scan-${source.id}-${Date.now()}`
    
    const jobResult = await repo.createContextJob({
      workspaceId,
      businessId,
      sessionId: null,
      jobType: 'source_processing',
      status: JobStatus.QUEUED,
      attemptCount: 0,
      maxAttempts: 3,
      idempotencyKey,
      stage: SourceProcessingStage.QUEUED,
      input: { sourceId: source.id, sourceType: source.sourceType },
      output: null,
      error: null,
      errorClass: null,
      retryPolicy: {},
      nextRunAt: null,
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
      stageTimeoutSeconds: null,
      startedAt: null,
      completedAt: null,
    })

    if (jobResult.ok) {
      jobs.push(jobResult.data)
      await repo.updateContextSource(workspaceId, source.id, {
        status: 'queued',
        currentStage: SourceProcessingStage.QUEUED,
      })
    }
  }

  return { ok: true, data: jobs }
}
