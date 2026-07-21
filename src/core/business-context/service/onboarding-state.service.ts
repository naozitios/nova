import type { RepositoryPort } from '../repository.port'
import type { JsonValue } from '../types'
import { getReadiness } from './onboarding.service'

export type OnboardingState = {
  business: {
    id: string
    workspaceId: string
    name: string
    websiteUrl: string | null
    status: string
  }
  session: null | {
    id: string
    businessId: string
    workspaceId: string
    status: string
    currentStep: string | null
    startedBy: string
    startedAt: Date
    completedAt: Date | null
    error: JsonValue | null
  }
  sources: Array<{
    id: string
    sourceType: string
    sourceName: string
    externalReference: string | null
    status: string
    currentStage: string | null
    terminalOutcome: string | null
    metadata: Record<string, JsonValue>
    collectedAt: Date
  }>
  questions: Array<{
    id: string
    factKey: string
    questionType: string
    question: string
    options: JsonValue | null
    reason: string
    priority: number
    status: string
    answer: JsonValue | null
  }>
  readiness: null | {
    routeStage: string
    blockers: unknown[]
    approvalReady: boolean
  }
  profile: null | {
    id: string
    version: number
    status: string
    profile: Record<string, JsonValue>
  }
  meta: {
    status: 'not_configured' | 'not_connected'
  }
  permissions: {
    canApprove: boolean
    role: 'viewer' | 'editor' | 'admin'
  }
}

export async function getOnboardingState(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<{ ok: true; data: OnboardingState } | { ok: false; error: { code: string; message: string; details?: unknown } }> {
  const businessResult = await repo.getBusiness(workspaceId, businessId)
  if (!businessResult.ok) return businessResult
  if (!businessResult.data) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Business not found' } }
  }

  const [sessionsResult, sourcesResult, profileResult, readinessResult] = await Promise.all([
    repo.listOnboardingSessions({ workspaceId, businessId }),
    repo.listContextSources({ workspaceId, businessId }),
    repo.getCurrentProfileVersion(workspaceId, businessId),
    getReadiness(repo, businessId, workspaceId),
  ])

  if (!sessionsResult.ok) return sessionsResult
  if (!sourcesResult.ok) return sourcesResult
  if (!profileResult.ok) return profileResult
  if (!readinessResult.ok) return readinessResult

  const session = sessionsResult.data.items[0] ?? null
  const questionsResult = session
    ? await repo.listOnboardingQuestions({ workspaceId, sessionId: session.id })
    : { ok: true as const, data: { items: [], total: 0 } }

  if (!questionsResult.ok) return questionsResult

  const business = businessResult.data
  const profile = profileResult.data

  return {
    ok: true,
    data: {
      business: {
        id: business.id,
        workspaceId: business.workspaceId,
        name: business.name,
        websiteUrl: business.websiteUrl,
        status: business.status,
      },
      session: session
        ? {
            id: session.id,
            businessId: session.businessId,
            workspaceId: session.workspaceId,
            status: session.status,
            currentStep: session.currentStep,
            startedBy: session.startedBy,
            startedAt: session.startedAt,
            completedAt: session.completedAt,
            error: session.error,
          }
        : null,
      sources: sourcesResult.data.items.map((source) => ({
        id: source.id,
        sourceType: source.sourceType,
        sourceName: source.sourceName,
        externalReference: source.externalReference,
        status: source.status,
        currentStage: source.currentStage,
        terminalOutcome: source.terminalOutcome,
        metadata: source.metadata,
        collectedAt: source.collectedAt,
      })),
      questions: questionsResult.data.items.map((question) => ({
        id: question.id,
        factKey: question.factKey,
        questionType: question.questionType,
        question: question.question,
        options: question.options,
        reason: question.reason,
        priority: question.priority,
        status: question.status,
        answer: question.answer,
      })),
      readiness: readinessResult.data
        ? {
            routeStage: readinessResult.data.routeStage,
            blockers: readinessResult.data.blockers,
            approvalReady: readinessResult.data.approvalReady,
          }
        : null,
      profile: profile
        ? {
            id: profile.id,
            version: profile.version,
            status: profile.status,
            profile: profile.profile,
          }
        : null,
      meta: {
        status: hasMetaEnv() ? 'not_connected' : 'not_configured',
      },
      permissions: {
        canApprove: false,
        role: 'viewer',
      },
    },
  }
}

function hasMetaEnv(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI)
}
