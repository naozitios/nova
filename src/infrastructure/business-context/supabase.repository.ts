import type { SupabaseClient } from '@supabase/supabase-js'
import type { RepositoryPort } from '@/core/business-context/repository.port'
import { getSupabaseServiceClient } from './supabase-client'
import {
  AuditRepository,
  BusinessRepository,
  FactRepository,
  JobRepository,
  ProfileRepository,
  QualityRepository,
  SourceRepository,
} from './repository'

// ─── Facade ─────────────────────────────────────────────────────────────────
//
// `SupabaseRepository` keeps the legacy public API (class implementing
// `RepositoryPort`) by delegating each method to an entity-specific
// repository in `./repository/`. No behavior change vs. the monolithic
// implementation; this split is purely structural.

export class SupabaseRepository implements RepositoryPort {
  private business: BusinessRepository
  private source: SourceRepository
  private fact: FactRepository
  private profile: ProfileRepository
  private job: JobRepository
  private quality: QualityRepository
  private audit: AuditRepository

  constructor(client?: SupabaseClient) {
    const db = client ?? getSupabaseServiceClient()
    this.business = new BusinessRepository(db)
    this.source = new SourceRepository(db)
    this.fact = new FactRepository(db)
    this.profile = new ProfileRepository(db)
    this.job = new JobRepository(db)
    this.quality = new QualityRepository(db)
    this.audit = new AuditRepository(db)
  }

  // ── Businesses ───────────────────────────────────────────────────────────
  createBusiness = (data: Parameters<BusinessRepository['createBusiness']>[0]) =>
    this.business.createBusiness(data)
  getBusiness = (
    workspaceId: string,
    businessId: string,
  ) => this.business.getBusiness(workspaceId, businessId)
  listBusinesses = (
    filter: Parameters<BusinessRepository['listBusinesses']>[0],
    pagination?: Parameters<BusinessRepository['listBusinesses']>[1],
    sort?: Parameters<BusinessRepository['listBusinesses']>[2],
  ) => this.business.listBusinesses(filter, pagination, sort)
  updateBusiness = (
    workspaceId: string,
    businessId: string,
    data: Parameters<BusinessRepository['updateBusiness']>[2],
  ) => this.business.updateBusiness(workspaceId, businessId, data)

  // ── Onboarding sessions ──────────────────────────────────────────────────
  createOnboardingSession = (
    data: Parameters<BusinessRepository['createOnboardingSession']>[0],
  ) => this.business.createOnboardingSession(data)
  getOnboardingSession = (workspaceId: string, sessionId: string) =>
    this.business.getOnboardingSession(workspaceId, sessionId)
  listOnboardingSessions = (
    filter: Parameters<BusinessRepository['listOnboardingSessions']>[0],
    pagination?: Parameters<BusinessRepository['listOnboardingSessions']>[1],
  ) => this.business.listOnboardingSessions(filter, pagination)
  updateOnboardingSession = (
    workspaceId: string,
    sessionId: string,
    data: Parameters<BusinessRepository['updateOnboardingSession']>[2],
  ) => this.business.updateOnboardingSession(workspaceId, sessionId, data)

  approveOnboardingV1 = (
    workspaceId: string,
    businessId: string,
    approverId: string,
  ) => this.business.approveOnboardingV1(workspaceId, businessId, approverId)

  // ── Context sources ──────────────────────────────────────────────────────
  createContextSource = (
    data: Parameters<SourceRepository['createContextSource']>[0],
  ) => this.source.createContextSource(data)
  getContextSource = (workspaceId: string, sourceId: string) =>
    this.source.getContextSource(workspaceId, sourceId)
  listContextSources = (
    filter: Parameters<SourceRepository['listContextSources']>[0],
    pagination?: Parameters<SourceRepository['listContextSources']>[1],
  ) => this.source.listContextSources(filter, pagination)
  updateContextSource = (
    workspaceId: string,
    sourceId: string,
    data: Parameters<SourceRepository['updateContextSource']>[2],
  ) => this.source.updateContextSource(workspaceId, sourceId, data)

  // ── Source documents ─────────────────────────────────────────────────────
  createSourceDocument = (
    data: Parameters<SourceRepository['createSourceDocument']>[0],
  ) => this.source.createSourceDocument(data)
  getSourceDocument = (workspaceId: string, documentId: string) =>
    this.source.getSourceDocument(workspaceId, documentId)
  listSourceDocuments = (
    filter: Parameters<SourceRepository['listSourceDocuments']>[0],
    pagination?: Parameters<SourceRepository['listSourceDocuments']>[1],
  ) => this.source.listSourceDocuments(filter, pagination)
  getSourceDocumentByHash = (businessId: string, contentHash: string) =>
    this.source.getSourceDocumentByHash(businessId, contentHash)
  updateSourceDocument = (
    workspaceId: string,
    documentId: string,
    data: Parameters<SourceRepository['updateSourceDocument']>[2],
  ) => this.source.updateSourceDocument(workspaceId, documentId, data)

  archiveSource = (workspaceId: string, sourceId: string) =>
    this.source.archiveSource(workspaceId, sourceId)

  // ── Context facts ────────────────────────────────────────────────────────
  createContextFact = (
    data: Parameters<FactRepository['createContextFact']>[0],
  ) => this.fact.createContextFact(data)
  getContextFact = (workspaceId: string, factId: string) =>
    this.fact.getContextFact(workspaceId, factId)
  listContextFacts = (
    filter: Parameters<FactRepository['listContextFacts']>[0],
    pagination?: Parameters<FactRepository['listContextFacts']>[1],
  ) => this.fact.listContextFacts(filter, pagination)
  updateContextFact = (
    workspaceId: string,
    factId: string,
    data: Parameters<FactRepository['updateContextFact']>[2],
  ) => this.fact.updateContextFact(workspaceId, factId, data)

  // ── Context conflicts ────────────────────────────────────────────────────
  createContextConflict = (
    data: Parameters<FactRepository['createContextConflict']>[0],
  ) => this.fact.createContextConflict(data)
  getContextConflict = (workspaceId: string, conflictId: string) =>
    this.fact.getContextConflict(workspaceId, conflictId)
  listContextConflicts = (
    filter: Parameters<FactRepository['listContextConflicts']>[0],
    pagination?: Parameters<FactRepository['listContextConflicts']>[1],
  ) => this.fact.listContextConflicts(filter, pagination)
  resolveContextConflict = (
    workspaceId: string,
    conflictId: string,
    resolutionFactId: string,
    resolvedBy: string,
    note?: string,
  ) =>
    this.fact.resolveContextConflict(workspaceId, conflictId, resolutionFactId, resolvedBy, note)

  // ── Onboarding questions ─────────────────────────────────────────────────
  createOnboardingQuestion = (
    data: Parameters<FactRepository['createOnboardingQuestion']>[0],
  ) => this.fact.createOnboardingQuestion(data)
  getOnboardingQuestion = (workspaceId: string, questionId: string) =>
    this.fact.getOnboardingQuestion(workspaceId, questionId)
  listOnboardingQuestions = (
    filter: Parameters<FactRepository['listOnboardingQuestions']>[0],
    pagination?: Parameters<FactRepository['listOnboardingQuestions']>[1],
  ) => this.fact.listOnboardingQuestions(filter, pagination)
  answerOnboardingQuestion = (
    workspaceId: string,
    questionId: string,
    answer: unknown,
    answeredBy: string,
  ) => this.fact.answerOnboardingQuestion(workspaceId, questionId, answer, answeredBy)
  dismissOnboardingQuestion = (
    workspaceId: string,
    questionId: string,
  ) => this.fact.dismissOnboardingQuestion(workspaceId, questionId)

  // ── Fact reconciliation ─────────────────────────────────────────────────
  persistFactReconciliation = (
    workspaceId: string,
    businessId: string,
    supersessionUpdates: Parameters<FactRepository['persistFactReconciliation']>[2],
    factCreations: Parameters<FactRepository['persistFactReconciliation']>[3],
    conflicts?: Parameters<FactRepository['persistFactReconciliation']>[4],
  ) => this.fact.persistFactReconciliation(workspaceId, businessId, supersessionUpdates, factCreations, conflicts)

  // ── Business profile versions ────────────────────────────────────────────
  createProfileVersion = (
    data: Parameters<ProfileRepository['createProfileVersion']>[0],
  ) => this.profile.createProfileVersion(data)
  getProfileVersion = (workspaceId: string, versionId: string) =>
    this.profile.getProfileVersion(workspaceId, versionId)
  listProfileVersions = (
    filter: Parameters<ProfileRepository['listProfileVersions']>[0],
    pagination?: Parameters<ProfileRepository['listProfileVersions']>[1],
  ) => this.profile.listProfileVersions(filter, pagination)
  getCurrentProfileVersion = (workspaceId: string, businessId: string) =>
    this.profile.getCurrentProfileVersion(workspaceId, businessId)
  supersedeProfileVersions = (workspaceId: string, businessId: string) =>
    this.profile.supersedeProfileVersions(workspaceId, businessId)
  approveProfileVersion = (
    workspaceId: string,
    versionId: string,
    approvedBy: string,
  ) => this.profile.approveProfileVersion(workspaceId, versionId, approvedBy)
  restoreProfileVersion = (
    workspaceId: string,
    versionId: string,
    restoredBy: string,
    note?: string,
  ) => this.profile.restoreProfileVersion(workspaceId, versionId, restoredBy, note)

  // ── Context jobs ─────────────────────────────────────────────────────────
  createContextJob = (
    data: Parameters<JobRepository['createContextJob']>[0],
  ) => this.job.createContextJob(data)
  getContextJob = (workspaceId: string, jobId: string) =>
    this.job.getContextJob(workspaceId, jobId)
  getContextJobByIdempotencyKey = (idempotencyKey: string) =>
    this.job.getContextJobByIdempotencyKey(idempotencyKey)
  listContextJobs = (
    filter: Parameters<JobRepository['listContextJobs']>[0],
    pagination?: Parameters<JobRepository['listContextJobs']>[1],
  ) => this.job.listContextJobs(filter, pagination)
  claimRunnableJobs = (
    filter: Parameters<JobRepository['claimRunnableJobs']>[0],
    workerId: string,
    limit: number,
  ) => this.job.claimRunnableJobs(filter, workerId, limit)
  updateContextJob = (
    workspaceId: string,
    jobId: string,
    data: Parameters<JobRepository['updateContextJob']>[2],
  ) => this.job.updateContextJob(workspaceId, jobId, data)

  // ── Processing runs ──────────────────────────────────────────────────────
  createProcessingRun = (
    data: Parameters<JobRepository['createProcessingRun']>[0],
  ) => this.job.createProcessingRun(data)
  getProcessingRun = (workspaceId: string, runId: string) =>
    this.job.getProcessingRun(workspaceId, runId)
  listProcessingRuns = (
    filter: Parameters<JobRepository['listProcessingRuns']>[0],
    pagination?: Parameters<JobRepository['listProcessingRuns']>[1],
    sort?: Parameters<JobRepository['listProcessingRuns']>[2],
  ) => this.job.listProcessingRuns(filter, pagination, sort)
  updateProcessingRun = (
    workspaceId: string,
    runId: string,
    data: Parameters<JobRepository['updateProcessingRun']>[2],
  ) => this.job.updateProcessingRun(workspaceId, runId, data)

  // ── Stage events ─────────────────────────────────────────────────────────
  createStageEvent = (
    data: Parameters<JobRepository['createStageEvent']>[0],
  ) => this.job.createStageEvent(data)
  listStageEvents = (
    filter: Parameters<JobRepository['listStageEvents']>[0],
    pagination?: Parameters<JobRepository['listStageEvents']>[1],
  ) => this.job.listStageEvents(filter, pagination)

  // ── Quality gate results ─────────────────────────────────────────────────
  createQualityGateResult = (
    data: Parameters<QualityRepository['createQualityGateResult']>[0],
  ) => this.quality.createQualityGateResult(data)
  listQualityGateResults = (
    filter: Parameters<QualityRepository['listQualityGateResults']>[0],
    pagination?: Parameters<QualityRepository['listQualityGateResults']>[1],
  ) => this.quality.listQualityGateResults(filter, pagination)

  // ── Circuit breakers ─────────────────────────────────────────────────────
  getCircuitBreaker = (workspaceId: string | null, provider: string) =>
    this.quality.getCircuitBreaker(workspaceId, provider)
  upsertCircuitBreaker = (
    data: Parameters<QualityRepository['upsertCircuitBreaker']>[0],
  ) => this.quality.upsertCircuitBreaker(data)

  // ── Audit log ────────────────────────────────────────────────────────────
  createAuditLog = (
    data: Parameters<AuditRepository['createAuditLog']>[0],
  ) => this.audit.createAuditLog(data)
  listAuditLogs = (
    filter: Parameters<AuditRepository['listAuditLogs']>[0],
    pagination?: Parameters<AuditRepository['listAuditLogs']>[1],
    sort?: Parameters<AuditRepository['listAuditLogs']>[2],
  ) => this.audit.listAuditLogs(filter, pagination, sort)
}
