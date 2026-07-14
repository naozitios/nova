import type {
  JsonValue,
  QualityGateScope,
  QualityGateStatus,
  VerificationStatus,
} from './types'

// ─── Gate evaluation result ──────────────────────────────────────────────────

export interface GateResult {
  gateScope: QualityGateScope
  gateName: string
  status: QualityGateStatus
  measuredValue: JsonValue | null
  threshold: JsonValue | null
  reason: string | null
}

// ─── Document quality input ──────────────────────────────────────────────────

export interface DocumentQualityInput {
  sourceDocumentId: string
  mimeType: string
  contentHash: string
  contentText: string | null
  pageOrSlideCount: number | null
  pagesProcessed: number
  slidesProcessed: number
  parserWarnings: string[]
  ocrConfidence: number | null
  evidenceLocatorsPresent: boolean
  truncationDetected: boolean
}

// ─── Fact quality input ──────────────────────────────────────────────────────

export interface FactQualityInput {
  factId: string
  factKey: string
  value: JsonValue
  sourceId: string
  sourceExcerpt: string | null
  evidenceLocator: unknown | null
  confidence: number
  verificationStatus: VerificationStatus
  hasConflict: boolean
  supersedesFactId: string | null
}

// ─── Document quality gates ──────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'text/html',
  'text/plain',
  'text/markdown',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
])

const OCR_CONFIDENCE_THRESHOLD = 0.65
const PAGE_COVERAGE_THRESHOLD = 0.9

export function checkMimeAllowlist(input: DocumentQualityInput): GateResult {
  const allowed = ALLOWED_MIME_TYPES.has(input.mimeType)
  return {
    gateScope: 'document',
    gateName: 'mime_allowlist',
    status: allowed ? 'passed' : 'failed_blocking',
    measuredValue: input.mimeType,
    threshold: 'application/pdf',
    reason: allowed
      ? null
      : `MIME type "${input.mimeType}" is not in the allowlist`,
  }
}

export function checkContentHashPresent(input: DocumentQualityInput): GateResult {
  const present = input.contentHash.length > 0
  return {
    gateScope: 'document',
    gateName: 'content_hash_present',
    status: present ? 'passed' : 'failed_blocking',
    measuredValue: input.contentHash || null,
    threshold: 'non-empty',
    reason: present ? null : 'Content hash is missing',
  }
}

export function checkNonEmptyContent(input: DocumentQualityInput): GateResult {
  const hasContent = input.contentText !== null && input.contentText.trim().length > 0
  return {
    gateScope: 'document',
    gateName: 'non_empty_content',
    status: hasContent ? 'passed' : 'failed_blocking',
    measuredValue: input.contentText?.length ?? 0,
    threshold: 'non-empty',
    reason: hasContent ? null : 'Parser produced empty content',
  }
}

export function checkPageCoverage(input: DocumentQualityInput): GateResult {
  if (input.pageOrSlideCount === null || input.pageOrSlideCount === 0) {
    return {
      gateScope: 'document',
      gateName: 'page_coverage',
      status: 'passed',
      measuredValue: null,
      threshold: null,
      reason: null,
    }
  }

  const expected = input.pageOrSlideCount
  const processed = input.pagesProcessed + input.slidesProcessed
  const ratio = processed / expected

  if (ratio >= PAGE_COVERAGE_THRESHOLD) {
    return {
      gateScope: 'document',
      gateName: 'page_coverage',
      status: 'passed',
      measuredValue: { processed, expected, ratio },
      threshold: PAGE_COVERAGE_THRESHOLD,
      reason: null,
    }
  }

  return {
    gateScope: 'document',
    gateName: 'page_coverage',
    status: 'failed_non_blocking',
    measuredValue: { processed, expected, ratio },
    threshold: PAGE_COVERAGE_THRESHOLD,
    reason: `Only ${Math.round(ratio * 100)}% of pages/slides processed`,
  }
}

export function checkOcrConfidence(input: DocumentQualityInput): GateResult {
  if (input.ocrConfidence === null) {
    return {
      gateScope: 'document',
      gateName: 'ocr_confidence',
      status: 'passed',
      measuredValue: null,
      threshold: null,
      reason: null,
    }
  }

  if (input.ocrConfidence >= OCR_CONFIDENCE_THRESHOLD) {
    return {
      gateScope: 'document',
      gateName: 'ocr_confidence',
      status: 'passed',
      measuredValue: input.ocrConfidence,
      threshold: OCR_CONFIDENCE_THRESHOLD,
      reason: null,
    }
  }

  return {
    gateScope: 'document',
    gateName: 'ocr_confidence',
    status: 'failed_non_blocking',
    measuredValue: input.ocrConfidence,
    threshold: OCR_CONFIDENCE_THRESHOLD,
    reason: `OCR confidence ${input.ocrConfidence} below threshold ${OCR_CONFIDENCE_THRESHOLD}`,
  }
}

export function checkTruncation(input: DocumentQualityInput): GateResult {
  if (!input.truncationDetected) {
    return {
      gateScope: 'document',
      gateName: 'truncation',
      status: 'passed',
      measuredValue: null,
      threshold: null,
      reason: null,
    }
  }

  return {
    gateScope: 'document',
    gateName: 'truncation',
    status: 'failed_blocking',
    measuredValue: true,
    threshold: false,
    reason: 'Truncation detected — source blocked for user review',
  }
}

export function checkEvidenceLocators(input: DocumentQualityInput): GateResult {
  return {
    gateScope: 'document',
    gateName: 'evidence_locators',
    status: input.evidenceLocatorsPresent ? 'passed' : 'warning',
    measuredValue: input.evidenceLocatorsPresent,
    threshold: true,
    reason: input.evidenceLocatorsPresent
      ? null
      : 'Evidence locators not present in parser output',
  }
}

export function runDocumentGates(input: DocumentQualityInput): GateResult[] {
  return [
    checkMimeAllowlist(input),
    checkContentHashPresent(input),
    checkNonEmptyContent(input),
    checkPageCoverage(input),
    checkOcrConfidence(input),
    checkTruncation(input),
    checkEvidenceLocators(input),
  ]
}

// ─── Fact quality gates ──────────────────────────────────────────────────────

const CONFIDENCE_HIGH = 0.7
const CONFIDENCE_REVIEW_MIN = 0.5
const CONFIDENCE_LOW = 0.5

export function checkConfidenceThreshold(input: FactQualityInput): GateResult {
  if (input.verificationStatus === 'user_verified') {
    return {
      gateScope: 'fact',
      gateName: 'confidence_threshold',
      status: 'passed',
      measuredValue: input.confidence,
      threshold: null,
      reason: null,
    }
  }

  if (input.confidence >= CONFIDENCE_HIGH) {
    return {
      gateScope: 'fact',
      gateName: 'confidence_threshold',
      status: 'passed',
      measuredValue: input.confidence,
      threshold: CONFIDENCE_HIGH,
      reason: null,
    }
  }

  if (input.confidence >= CONFIDENCE_REVIEW_MIN) {
    return {
      gateScope: 'fact',
      gateName: 'confidence_threshold',
      status: 'warning',
      measuredValue: input.confidence,
      threshold: CONFIDENCE_REVIEW_MIN,
      reason: `Confidence ${input.confidence} requires review (${CONFIDENCE_REVIEW_MIN}–${CONFIDENCE_HIGH})`,
    }
  }

  return {
    gateScope: 'fact',
    gateName: 'confidence_threshold',
    status: 'failed_blocking',
    measuredValue: input.confidence,
    threshold: CONFIDENCE_LOW,
    reason: `Confidence ${input.confidence} below minimum ${CONFIDENCE_LOW} — stored as low-confidence evidence only`,
  }
}

export function checkSourceMetadata(input: FactQualityInput): GateResult {
  const hasSource = input.sourceId.length > 0
  const hasExcerpt = input.sourceExcerpt !== null && input.sourceExcerpt.length > 0
  const hasEvidence = input.evidenceLocator !== null

  const ok = hasSource && hasExcerpt && hasEvidence

  if (ok) {
    return {
      gateScope: 'fact',
      gateName: 'source_metadata',
      status: 'passed',
      measuredValue: { sourceId: true, excerpt: true, evidence: true },
      threshold: 'all present',
      reason: null,
    }
  }

  const missing: string[] = []
  if (!hasSource) missing.push('sourceId')
  if (!hasExcerpt) missing.push('sourceExcerpt')
  if (!hasEvidence) missing.push('evidenceLocator')

  return {
    gateScope: 'fact',
    gateName: 'source_metadata',
    status: 'failed_blocking',
    measuredValue: { sourceId: hasSource, excerpt: hasExcerpt, evidence: hasEvidence },
    threshold: 'all present',
    reason: `Missing source metadata: ${missing.join(', ')}`,
  }
}

export function checkConflictBlocking(input: FactQualityInput): GateResult {
  if (!input.hasConflict) {
    return {
      gateScope: 'fact',
      gateName: 'conflict_blocking',
      status: 'passed',
      measuredValue: null,
      threshold: null,
      reason: null,
    }
  }

  return {
    gateScope: 'fact',
    gateName: 'conflict_blocking',
    status: 'failed_blocking',
    measuredValue: true,
    threshold: false,
    reason: 'Material conflict exists — blocks approval until resolved',
  }
}

export function checkSupersessionMetadata(input: FactQualityInput): GateResult {
  if (input.supersedesFactId === null) {
    return {
      gateScope: 'fact',
      gateName: 'supersession_metadata',
      status: 'passed',
      measuredValue: null,
      threshold: null,
      reason: null,
    }
  }

  const hasSource = input.sourceId.length > 0
  const hasExcerpt = input.sourceExcerpt !== null && input.sourceExcerpt.length > 0

  const ok = hasSource && hasExcerpt

  return {
    gateScope: 'fact',
    gateName: 'supersession_metadata',
    status: ok ? 'passed' : 'failed_blocking',
    measuredValue: { supersedes: true, source: hasSource, excerpt: hasExcerpt },
    threshold: 'authority metadata required',
    reason: ok
      ? null
      : 'Superseding fact missing authority/effective-date metadata',
  }
}

export function runFactGates(input: FactQualityInput): GateResult[] {
  return [
    checkConfidenceThreshold(input),
    checkSourceMetadata(input),
    checkConflictBlocking(input),
    checkSupersessionMetadata(input),
  ]
}

// ─── Aggregate evaluation ────────────────────────────────────────────────────

export function hasBlockingFailures(results: GateResult[]): boolean {
  return results.some((r) => r.status === 'failed_blocking')
}

export function hasWarnings(results: GateResult[]): boolean {
  return results.some((r) => r.status === 'warning' || r.status === 'failed_non_blocking')
}

export function overallGateStatus(
  results: GateResult[],
): 'passed' | 'passed_with_warnings' | 'failed' {
  if (hasBlockingFailures(results)) return 'failed'
  if (hasWarnings(results)) return 'passed_with_warnings'
  return 'passed'
}
