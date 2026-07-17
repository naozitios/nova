// US1: Onboarding lifecycle — create business, session, submit answers, compile draft, approve v1.

import type { RepositoryPort } from '../repository.port'
import type {
  Business,
  OnboardingSession,
  BusinessProfileVersion,
  JsonValue,
} from '../types'
import {
  JobStatus,
  OnboardingStatus,
  SourceProcessingStage,
  SourceType,
  VerificationStatus,
} from '../types'
import type { OnboardingReadinessResult } from '../onboarding-readiness'
import { computeOnboardingReadiness } from '../onboarding-readiness'

export interface CreateBusinessInput {
  workspaceId: string
  name: string
  primaryMarket: string
  primaryAdvertisingObjective: string
  primaryBusinessOutcome: string
  approximateMonthlyMetaBudget: number
  websiteUrl?: string | null
  initialSources: Array<{
    sourceType: SourceType
    sourceName: string
    externalReference?: string
  }>
  createdBy?: string
}

export interface SubmitAnswersInput {
  answers: Array<{
    factKey: string
    answer: JsonValue
  }>
}

export async function createBusiness(
  repo: RepositoryPort,
  input: CreateBusinessInput,
): Promise<{ ok: true; data: Business } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const result = await repo.createBusiness({
    workspaceId: input.workspaceId,
    name: input.name,
    websiteUrl: input.websiteUrl ?? null,
    status: 'active',
  })

  if (!result.ok) return result

  if (input.websiteUrl) {
    const sourceResult = await repo.createContextSource({
      workspaceId: input.workspaceId,
      businessId: result.data.id,
      sourceType: SourceType.WEBSITE,
      sourceName: 'Business website',
      externalReference: input.websiteUrl,
      status: 'queued',
      currentStage: SourceProcessingStage.QUEUED,
      terminalOutcome: null,
      metadata: {},
      collectedAt: new Date(),
    })
    if (!sourceResult.ok) return sourceResult

    const jobResult = await repo.createContextJob({
      workspaceId: input.workspaceId,
      businessId: result.data.id,
      sessionId: null,
      jobType: 'source_processing',
      status: JobStatus.QUEUED,
      attemptCount: 0,
      maxAttempts: 3,
      idempotencyKey: `onboarding-website-${result.data.id}`,
      stage: SourceProcessingStage.QUEUED,
      input: { sourceId: sourceResult.data.id, sourceType: SourceType.WEBSITE },
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
  }

  for (const source of input.initialSources) {
    const sourceResult = await repo.createContextSource({
      workspaceId: input.workspaceId,
      businessId: result.data.id,
      sourceType: source.sourceType,
      sourceName: source.sourceName,
      externalReference: source.externalReference ?? null,
      status: 'registered',
      currentStage: null,
      terminalOutcome: null,
      metadata: {},
      collectedAt: new Date(),
    })
    if (!sourceResult.ok) return sourceResult
  }

  // When createdBy is provided, persist provenance source and user-verified facts
  if (input.createdBy) {
    const sourceResult = await repo.createContextSource({
      workspaceId: input.workspaceId,
      businessId: result.data.id,
      sourceType: SourceType.USER_ANSWER,
      sourceName: 'Onboarding provenance',
      externalReference: null,
      status: 'registered',
      currentStage: null,
      terminalOutcome: null,
      metadata: {},
      collectedAt: new Date(),
    })
    if (!sourceResult.ok) return sourceResult

    const provenanceSourceId = sourceResult.data.id
    const factMappings: Array<{ key: string; value: JsonValue }> = [
      { key: 'business.name', value: input.name },
      { key: 'market.primary', value: input.primaryMarket },
      { key: 'advertising.primary_objective', value: input.primaryAdvertisingObjective },
      { key: 'business.primary_outcome', value: input.primaryBusinessOutcome },
      { key: 'economics.monthly_meta_budget', value: input.approximateMonthlyMetaBudget },
    ]

    for (const mapping of factMappings) {
      const factResult = await repo.createContextFact({
        workspaceId: input.workspaceId,
        businessId: result.data.id,
        factKey: mapping.key,
        value: mapping.value,
        sourceId: provenanceSourceId,
        sourceDocumentId: null,
        sourceExcerpt: null,
        evidenceLocator: null,
        confidence: 1.0,
        verificationStatus: VerificationStatus.USER_VERIFIED,
        supersedesFactId: null,
        validFrom: new Date(),
        validTo: null,
        createdBy: input.createdBy,
      })
      if (!factResult.ok) return factResult
    }
  }

  return result
}

export async function createSession(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  userId: string,
): Promise<{ ok: true; data: OnboardingSession } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const business = await repo.getBusiness(workspaceId, businessId)
  if (!business.ok) return business
  if (!business.data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Business not found' } }
  }

  const existing = await getSession(repo, businessId, workspaceId)
  if (!existing.ok) return existing
  if (existing.data) return { ok: true, data: existing.data }

  const createResult = await repo.createOnboardingSession({
    workspaceId,
    businessId,
    status: OnboardingStatus.CREATED,
    currentStep: null,
    startedBy: userId,
    startedAt: new Date(),
    completedAt: null,
    error: null,
  })
  if (!createResult.ok) return createResult

  // Compute readiness; promote to ready_for_approval when approval-ready
  const readiness = await getReadiness(repo, businessId, workspaceId)
  if (readiness.ok && readiness.data?.approvalReady) {
    const updateResult = await repo.updateOnboardingSession(workspaceId, createResult.data.id, {
      status: OnboardingStatus.READY_FOR_APPROVAL,
      currentStep: 'approval',
    })
    if (!updateResult.ok) return updateResult
    return { ok: true, data: updateResult.data }
  }

  return createResult
}

export async function getSession(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<{ ok: true; data: OnboardingSession | null } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
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
): Promise<{ ok: true; data: void } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const sessionResult = await getSession(repo, businessId, workspaceId)
  if (!sessionResult.ok) return sessionResult

  let session = sessionResult.data
  if (!session) {
    const createResult = await createSession(repo, businessId, workspaceId, userId)
    if (!createResult.ok) return createResult
    session = createResult.data
  }

  if (input.answers.length === 0) {
    return { ok: true, data: undefined }
  }

  // Find or create session-bound user-answer provenance source
  const sourcesResult = await repo.listContextSources({ workspaceId, businessId })
  if (!sourcesResult.ok) return sourcesResult

  let provenanceSourceId: string
  const existing = sourcesResult.data.items.find(
    (s) => s.sourceType === SourceType.USER_ANSWER && s.metadata?.sessionId === session.id,
  )
  if (existing) {
    provenanceSourceId = existing.id
  } else {
    const provenanceResult = await repo.createContextSource({
      workspaceId,
      businessId,
      sourceType: SourceType.USER_ANSWER,
      sourceName: 'User answer provenance',
      externalReference: null,
      status: 'registered',
      currentStage: null,
      terminalOutcome: null,
      metadata: { sessionId: session.id },
      collectedAt: new Date(),
    })
    if (!provenanceResult.ok) return provenanceResult
    provenanceSourceId = provenanceResult.data.id
  }

  for (const item of input.answers) {
    const questionResult = await repo.createOnboardingQuestion({
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
    if (!questionResult.ok) return questionResult

    // Create user-verified fact linked to provenance source
    const factResult = await repo.createContextFact({
      workspaceId,
      businessId,
      factKey: item.factKey,
      value: item.answer,
      sourceId: provenanceSourceId,
      sourceDocumentId: null,
      sourceExcerpt: null,
      evidenceLocator: null,
      confidence: 1.0,
      verificationStatus: VerificationStatus.USER_VERIFIED,
      supersedesFactId: null,
      validFrom: new Date(),
      validTo: null,
      createdBy: userId,
    })
    if (!factResult.ok) return factResult
  }

  const readiness = await getReadiness(repo, businessId, workspaceId)
  if (!readiness.ok) return readiness

  const nextStatus = readiness.data?.approvalReady
    ? OnboardingStatus.READY_FOR_APPROVAL
    : OnboardingStatus.AWAITING_ANSWERS
  const currentStep = readiness.data?.approvalReady
    ? 'approval'
    : readiness.data?.routeStage ?? 'questions'

  const sessionUpdate = await repo.updateOnboardingSession(workspaceId, session.id, {
    status: nextStatus,
    currentStep,
  })
  if (!sessionUpdate.ok) return sessionUpdate

  return { ok: true, data: undefined }
}

export async function compileOnboardingDraft(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<{ ok: true; data: Record<string, JsonValue> } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
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

export async function getReadiness(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<{ ok: true; data: OnboardingReadinessResult | null } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const sessionResult = await repo.listOnboardingSessions({ workspaceId, businessId })
  if (!sessionResult.ok) return sessionResult

  const session = sessionResult.data.items[0]
  if (!session) return { ok: true, data: null }

  const [sourcesResult, factsResult, conflictsResult, jobsResult, questionsResult, versionResult, qualityResult] =
    await Promise.all([
      repo.listContextSources({ workspaceId, businessId }),
      repo.listContextFacts({ workspaceId, businessId }),
      repo.listContextConflicts({ workspaceId, businessId }),
      repo.listContextJobs({ workspaceId, businessId }),
      repo.listOnboardingQuestions({ workspaceId, sessionId: session.id }),
      repo.getCurrentProfileVersion(workspaceId, businessId),
      repo.listQualityGateResults({ workspaceId, businessId }),
    ])

  if (!sourcesResult.ok) return sourcesResult
  if (!factsResult.ok) return factsResult
  if (!conflictsResult.ok) return conflictsResult
  if (!jobsResult.ok) return jobsResult
  if (!questionsResult.ok) return questionsResult
  if (!versionResult.ok) return versionResult
  if (!qualityResult.ok) return qualityResult

  const readiness = computeOnboardingReadiness({
    session,
    sources: sourcesResult.data.items,
    facts: factsResult.data.items,
    conflicts: conflictsResult.data.items,
    activeJobs: jobsResult.data.items,
    questions: questionsResult.data.items,
    currentVersion: versionResult.data,
    qualityGateResults: qualityResult.data.items,
  })

  return { ok: true, data: readiness }
}

export async function approveV1(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  approverId: string,
): Promise<{ ok: true; data: BusinessProfileVersion } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  return repo.approveOnboardingV1(workspaceId, businessId, approverId)
}
