// Re-export shim — preserves the original `./_shared` import path for existing
// consumers (audit, business, fact, job, profile, quality, source repositories).
// New code should import directly from `./mappers`.
export {
  err,
  type Row,
  mapBusiness,
  mapOnboardingSession,
  mapContextSource,
  mapSourceDocument,
  mapContextFact,
  mapContextConflict,
  mapOnboardingQuestion,
  mapProfileVersion,
  mapContextJob,
  mapProcessingRun,
  mapStageEvent,
  mapQualityGateResult,
  mapCircuitBreaker,
  mapAuditLog,
  mapUploadIntent,
  mapIdempotencyRecord,
  mapMetaConnection,
  mapMetaConnectionStatus,
  mapMetaOAuthState,
  mapMetaProviderCodeHash,
} from './mappers'
