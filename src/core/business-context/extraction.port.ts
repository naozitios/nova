import type {
  ContextFact,
  ServiceResult,
  SourceType,
  VerificationStatus,
} from './types'
import type { EvidenceLocator, JsonValue } from './types'

// ─── Extraction request ──────────────────────────────────────────────────────

export interface ExtractionRequest {
  sourceDocumentId: string
  sourceId: string
  businessId: string
  workspaceId: string
  contentText: string
  sourceType: SourceType
  parserName: string
}

// ─── Extracted fact (pre-persist) ────────────────────────────────────────────

export interface ExtractedFact {
  factKey: string
  value: JsonValue
  confidence: number
  sourceExcerpt: string | null
  evidenceLocator: EvidenceLocator | null
}

// ─── Extraction conflict (pre-persist) ───────────────────────────────────────

export interface ExtractionConflict {
  factKey: string
  values: JsonValue[]
}

// ─── Extraction result ───────────────────────────────────────────────────────

export interface ExtractionResult {
  facts: ExtractedFact[]
  conflicts: ExtractionConflict[]
  warnings: string[]
}

// ─── Reconciliation input ────────────────────────────────────────────────────

export interface ReconciliationRequest {
  businessId: string
  workspaceId: string
  factKey: string
  existingFacts: Pick<
    ContextFact,
    'id' | 'value' | 'confidence' | 'verificationStatus' | 'validFrom'
  >[]
  newFacts: ExtractedFact[]
}

// ─── Reconciliation result ───────────────────────────────────────────────────

export interface ReconciliationResult {
  /** Facts that supersede existing ones */
  superseded: { oldFactId: string; newFactId: string }[]
  /** New conflicts discovered */
  conflicts: ExtractionConflict[]
  /** Facts to create (new, not superseding) */
  toCreate: ExtractedFact[]
  /** Facts to update (confidence bumped) */
  toUpdate: {
    factId: string
    confidence: number
    verificationStatus: VerificationStatus
  }[]
}

// ─── Extraction port ─────────────────────────────────────────────────────────

export interface ExtractionPort {
  /**
   * Extract structured facts from a source document's content text.
   * Uses LLM extraction with schema constraints.
   */
  extractFacts(
    request: ExtractionRequest,
  ): Promise<ServiceResult<ExtractionResult>>

  /**
   * Reconcile newly extracted facts against existing facts for a business.
   * Determines which facts supersede which, identifies conflicts, and
   * proposes updates.
   */
  reconcileFacts(
    request: ReconciliationRequest,
  ): Promise<ServiceResult<ReconciliationResult>>
}
