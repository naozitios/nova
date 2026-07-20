// Public entry point for the split business-context service.
// Re-exports the standalone functions and types in their original names so the
// rest of the codebase (routes, tests) keeps importing from
// `@/core/business-context/service` unchanged.

export {
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

export {
  registerSource,
  listSources,
  getSource,
  processSource,
  archiveSource,
  queueScan,
  type RegisterSourceInput,
} from './source.service'

export {
  extractFacts,
  reconcileFacts,
  resolveConflict,
  normalizeFacts,
  type ConflictGroup,
  type ResolutionResult,
} from './extraction.service'

export {
  addCorrection,
  compileDraft,
  computeDiff,
  approveContext,
  listVersions,
  getVersion,
  compareVersions,
  restoreContextVersion,
  type AddCorrectionInput,
  type ApproveContextInput,
  type CompiledDraftResult,
  type DiffResult,
  type VersionCompareResult,
  type RestoreContextInput,
} from './context.service'

export { compileContextForPurpose } from './compile.service'

export { getOnboardingReview, type OnboardingReview } from './onboarding-review'

export { BusinessContextService } from './service'
