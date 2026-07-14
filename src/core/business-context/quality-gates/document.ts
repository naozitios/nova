import type {
  JsonValue,
  QualityGateScope,
  QualityGateStatus,
} from '../types'
import type { GateResult } from './index'

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
