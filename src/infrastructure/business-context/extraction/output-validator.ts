import type { ExtractionResult } from '../../../core/business-context/extraction.port'

// ─── Types ──────────────────────────────────────────────────────────────────

export type LlmRawOutput = ExtractionResult

export interface OutputValidatorConfig {}

export interface ValidationError {
  code: 'MISSING_KEY' | 'UNKNOWN_KEY' | 'INVALID_TYPE' | 'OUT_OF_RANGE'
  field: string
  message?: string
}

export interface ValidationWarning {
  code: 'MISSING_EVIDENCE'
  field: string
  message?: string
}

export interface OutputValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

// ─── Validation ─────────────────────────────────────────────────────────────

const TOP_LEVEL_KEYS = ['facts', 'conflicts', 'warnings'] as const

export function validateOutput(
  raw: LlmRawOutput,
  _config?: OutputValidatorConfig,
): OutputValidationResult {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({ code: 'INVALID_TYPE', field: '(root)', message: 'expected object' })
    return { valid: false, errors, warnings }
  }

  const obj = raw as unknown as Record<string, unknown>

  // ── Strict top-level keys ──
  for (const key of TOP_LEVEL_KEYS) {
    if (!(key in obj)) {
      errors.push({ code: 'MISSING_KEY', field: key })
    }
  }
  for (const key of Object.keys(obj)) {
    if (!(TOP_LEVEL_KEYS as readonly string[]).includes(key)) {
      errors.push({ code: 'UNKNOWN_KEY', field: key })
    }
  }

  // ── Facts ──
  if (Array.isArray(obj.facts)) {
    obj.facts.forEach((fact: unknown, i: number) => {
      if (fact === null || typeof fact !== 'object' || Array.isArray(fact)) {
        errors.push({ code: 'INVALID_TYPE', field: `facts[${i}]`, message: 'expected object' })
        return
      }
      const f = fact as Record<string, unknown>
      if (typeof f.factKey !== 'string') {
        errors.push({ code: 'INVALID_TYPE', field: `facts[${i}].factKey` })
      }
      if (!('value' in f)) {
        errors.push({ code: 'MISSING_KEY', field: `facts[${i}].value` })
      }
      if (typeof f.confidence !== 'number') {
        errors.push({ code: 'INVALID_TYPE', field: `facts[${i}].confidence` })
      } else if (f.confidence < 0 || f.confidence > 1) {
        errors.push({ code: 'OUT_OF_RANGE', field: `facts[${i}].confidence` })
      }
      if (f.evidenceLocator === null) {
        warnings.push({ code: 'MISSING_EVIDENCE', field: `facts[${i}].evidenceLocator` })
      }
      if (f.sourceExcerpt === null) {
        warnings.push({ code: 'MISSING_EVIDENCE', field: `facts[${i}].sourceExcerpt` })
      }
    })
  }

  // ── Conflicts ──
  if (Array.isArray(obj.conflicts)) {
    obj.conflicts.forEach((c: unknown, i: number) => {
      if (c === null || typeof c !== 'object' || Array.isArray(c)) {
        errors.push({ code: 'INVALID_TYPE', field: `conflicts[${i}]`, message: 'expected object' })
        return
      }
      const conflict = c as Record<string, unknown>
      if (typeof conflict.factKey !== 'string') {
        errors.push({ code: 'INVALID_TYPE', field: `conflicts[${i}].factKey` })
      }
      if (!Array.isArray(conflict.values)) {
        errors.push({ code: 'INVALID_TYPE', field: `conflicts[${i}].values` })
      }
    })
  }

  // ── Warnings ──
  if (Array.isArray(obj.warnings)) {
    obj.warnings.forEach((w: unknown, i: number) => {
      if (typeof w !== 'string') {
        errors.push({ code: 'INVALID_TYPE', field: `warnings[${i}]` })
      }
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}

// ─── Repair ─────────────────────────────────────────────────────────────────

export function repairOutput(raw: LlmRawOutput): LlmRawOutput | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }

  const obj = raw as unknown as Record<string, unknown>

  // Ensure arrays exist
  if (!Array.isArray(obj.facts)) obj.facts = []
  if (!Array.isArray(obj.conflicts)) obj.conflicts = []
  if (!Array.isArray(obj.warnings)) obj.warnings = []

  // Clamp out-of-range confidence
  for (const fact of obj.facts as Record<string, unknown>[]) {
    if (typeof fact.confidence === 'number') {
      fact.confidence = Math.max(0, Math.min(1, fact.confidence))
    }
  }

  return obj as unknown as LlmRawOutput
}
