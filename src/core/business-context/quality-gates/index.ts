import type { JsonValue, QualityGateScope, QualityGateStatus } from '../types'

// ─── Gate evaluation result ──────────────────────────────────────────────────

export interface GateResult {
  gateScope: QualityGateScope
  gateName: string
  status: QualityGateStatus
  measuredValue: JsonValue | null
  threshold: JsonValue | null
  reason: string | null
}

export {
  checkConflictBlocking,
  checkConfidenceThreshold,
  checkSourceMetadata,
  checkSupersessionMetadata,
  runFactGates,
  type FactQualityInput,
} from './fact'

export {
  checkContentHashPresent,
  checkEvidenceLocators,
  checkMimeAllowlist,
  checkNonEmptyContent,
  checkOcrConfidence,
  checkPageCoverage,
  checkTruncation,
  runDocumentGates,
  type DocumentQualityInput,
} from './document'

export { hasBlockingFailures, hasWarnings, overallGateStatus } from './aggregate'
