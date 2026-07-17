// Facade class — exposes every user-story workflow as a method.
// The standalone functions in the sibling files remain the public API and are
// re-exported through ./index.ts. This class is sugar for callers that want
// a single bound handle on the service.

import type { RepositoryPort } from '../repository.port'
import type {
  Business,
  BusinessProfileVersion,
  ContextFact,
  ContextJob,
  ContextPurpose,
  ContextSource,
  OnboardingSession,
  JsonValue,
} from '../types'
import type { OnboardingReadinessResult } from '../onboarding-readiness'
import type { CompiledContext } from '../context-purpose-compiler'

import {
  createBusiness,
  createSession,
  getSession,
  submitAnswers,
  compileOnboardingDraft,
  approveV1,
  getReadiness,
  type CreateBusinessInput,
  type SubmitAnswersInput,
} from './onboarding.service'

import {
  registerSource,
  listSources,
  getSource,
  processSource,
  archiveSource,
  queueScan,
  type RegisterSourceInput,
} from './source.service'

import {
  addCorrection,
  compileDraft,
  computeDiff,
  approveContext,
  listVersions,
  restoreContextVersion,
  type AddCorrectionInput,
  type ApproveContextInput,
  type CompiledDraftResult,
  type DiffResult,
  type RestoreContextInput,
} from './context.service'

import { compileContextForPurpose } from './compile.service'

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } }

export class BusinessContextService {
  constructor(private readonly repo: RepositoryPort) {}

  // US1 — Onboarding
  createBusiness(input: CreateBusinessInput): Promise<ServiceResult<Business>> {
    return createBusiness(this.repo, input)
  }
  createSession(
    businessId: string,
    workspaceId: string,
    userId: string,
  ): Promise<ServiceResult<OnboardingSession>> {
    return createSession(this.repo, businessId, workspaceId, userId)
  }
  getSession(
    businessId: string,
    workspaceId: string,
  ): Promise<ServiceResult<OnboardingSession | null>> {
    return getSession(this.repo, businessId, workspaceId)
  }
  submitAnswers(
    businessId: string,
    workspaceId: string,
    userId: string,
    input: SubmitAnswersInput,
  ): Promise<ServiceResult<void>> {
    return submitAnswers(this.repo, businessId, workspaceId, userId, input)
  }
  compileOnboardingDraft(
    businessId: string,
    workspaceId: string,
  ): Promise<ServiceResult<Record<string, JsonValue>>> {
    return compileOnboardingDraft(this.repo, businessId, workspaceId)
  }
  approveV1(
    businessId: string,
    workspaceId: string,
    approverId: string,
  ): Promise<ServiceResult<BusinessProfileVersion>> {
    return approveV1(this.repo, businessId, workspaceId, approverId)
  }
  getReadiness(
    businessId: string,
    workspaceId: string,
  ): Promise<ServiceResult<OnboardingReadinessResult | null>> {
    return getReadiness(this.repo, businessId, workspaceId)
  }

  // US2 — Source management
  registerSource(
    businessId: string,
    workspaceId: string,
    input: RegisterSourceInput,
  ): Promise<ServiceResult<ContextSource>> {
    return registerSource(this.repo, businessId, workspaceId, input)
  }
  listSources(
    businessId: string,
    workspaceId: string,
  ): Promise<ServiceResult<{ items: ContextSource[]; total: number }>> {
    return listSources(this.repo, businessId, workspaceId)
  }
  getSource(
    businessId: string,
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextSource | null>> {
    return getSource(this.repo, businessId, workspaceId, sourceId)
  }
  processSource(
    businessId: string,
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextJob>> {
    return processSource(this.repo, businessId, workspaceId, sourceId)
  }
  archiveSource(
    businessId: string,
    workspaceId: string,
    sourceId: string,
  ): Promise<ServiceResult<ContextSource>> {
    return archiveSource(this.repo, businessId, workspaceId, sourceId)
  }
  queueScan(
    businessId: string,
    workspaceId: string,
  ): Promise<ServiceResult<ContextJob[]>> {
    return queueScan(this.repo, businessId, workspaceId)
  }

  // US3 — Extraction
  extractFacts = extractFacts
  reconcileFacts = reconcileFacts
  resolveConflict = resolveConflict

  // US4 — Context management
  addCorrection(input: AddCorrectionInput): Promise<ServiceResult<ContextFact>> {
    return addCorrection(this.repo, input)
  }
  compileDraft(
    businessId: string,
    workspaceId: string,
  ): Promise<ServiceResult<CompiledDraftResult>> {
    return compileDraft(this.repo, businessId, workspaceId)
  }
  getDiff(
    businessId: string,
    workspaceId: string,
    draft: Record<string, JsonValue>,
  ): Promise<ServiceResult<DiffResult>> {
    return computeDiff(this.repo, businessId, workspaceId, draft)
  }
  approveDraft(
    input: ApproveContextInput,
  ): Promise<ServiceResult<BusinessProfileVersion>> {
    return approveContext(this.repo, input)
  }
  listVersions(
    businessId: string,
    workspaceId: string,
  ): Promise<ServiceResult<{ items: BusinessProfileVersion[]; total: number }>> {
    return listVersions(this.repo, businessId, workspaceId)
  }
  restoreVersion(
    input: RestoreContextInput,
  ): Promise<ServiceResult<BusinessProfileVersion>> {
    return restoreContextVersion(this.repo, input)
  }

  // US5 — Compile for purpose
  compileContextForPurpose(
    businessId: string,
    workspaceId: string,
    purpose: ContextPurpose,
  ): Promise<ServiceResult<CompiledContext>> {
    return compileContextForPurpose(this.repo, businessId, workspaceId, purpose)
  }
}

import {
  extractFacts,
  reconcileFacts,
  resolveConflict,
} from './extraction.service'
