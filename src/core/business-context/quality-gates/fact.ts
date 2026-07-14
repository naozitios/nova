import type { JsonValue, VerificationStatus } from '../types'
import type { GateResult } from './index'

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

  if (!hasSource || !hasExcerpt) {
    const missing: string[] = []
    if (!hasSource) missing.push('sourceId')
    if (!hasExcerpt) missing.push('sourceExcerpt')
    return {
      gateScope: 'fact',
      gateName: 'source_metadata',
      status: 'failed_blocking',
      measuredValue: { sourceId: hasSource, excerpt: hasExcerpt, evidence: hasEvidence },
      threshold: 'all present',
      reason: `Missing source metadata: ${missing.join(', ')}`,
    }
  }

  if (!hasEvidence) {
    return {
      gateScope: 'fact',
      gateName: 'source_metadata',
      status: 'warning',
      measuredValue: { sourceId: true, excerpt: true, evidence: false },
      threshold: 'all present',
      reason: 'Evidence locator missing — fact passed but downstream traceability weakened',
    }
  }

  return {
    gateScope: 'fact',
    gateName: 'source_metadata',
    status: 'passed',
    measuredValue: { sourceId: true, excerpt: true, evidence: true },
    threshold: 'all present',
    reason: null,
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
