import { z } from 'zod'
import type { ExtractionResult } from '../../../core/business-context/extraction.port'

// ─── Types ──────────────────────────────────────────────────────────────────

export type LlmRawOutput = ExtractionResult

export type OutputValidatorConfig = object

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

// ─── Zod schema (strict) ───────────────────────────────────────────────────

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
)

const EvidenceLocatorSchema = z.object({
  url: z.string().url().optional(),
  page: z.number().int().nonnegative().optional(),
  slide: z.number().int().nonnegative().optional(),
  element: z.string().optional(),
  boundingBox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .strict()
    .optional(),
}).strict()

const StrictOutputSchema = z.object({
  facts: z.array(
    z.object({
      factKey: z.string().min(1),
      value: JsonValueSchema,
      confidence: z.number().min(0).max(1),
      sourceExcerpt: z.string().nullable(),
      evidenceLocator: EvidenceLocatorSchema.nullable(),
    }).strict(),
  ),
  conflicts: z.array(
    z.object({
      factKey: z.string().min(1),
      values: z.array(JsonValueSchema),
    }).strict(),
  ),
  warnings: z.array(z.string()),
}).strict()

// ─── Validation ─────────────────────────────────────────────────────────────

function mapZodPath(path: readonly (string | number)[]): string {
  return path
    .map((seg, i) => (typeof seg === 'number' ? `[${seg}]` : i === 0 ? seg : `.${seg}`))
    .join('')
}

function mapZodErrors(result: z.ZodError): ValidationError[] {
  const errors: ValidationError[] = []
  for (const issue of result.issues) {
    const path = issue.path as (string | number)[]
    const field = path.length > 0 ? mapZodPath(path) : '(root)'
    let code: ValidationError['code'] = 'INVALID_TYPE'

    if (issue.code === 'invalid_type') {
      if (issue.message.includes('received undefined')) {
        code = 'MISSING_KEY'
      } else if (issue.message.includes('received never') || issue.message.includes('received unknown')) {
        code = 'UNKNOWN_KEY'
      }
    } else if (issue.code === 'invalid_union') {
      // Union of primitive types: if all branch sub-errors indicate "received undefined", it's missing
      const branches = (issue as unknown as { errors?: Array<Array<{ message?: string }>> }).errors
      const allUndefined = branches?.every((branch) =>
        branch.every((e) => e.message?.includes('received undefined')),
      )
      if (allUndefined) {
        code = 'MISSING_KEY'
      }
    } else if (issue.code === 'too_small' || issue.code === 'too_big') {
      // Numeric range violations → OUT_OF_RANGE; string length → INVALID_TYPE
      code = (issue as { origin?: string }).origin === 'number' ? 'OUT_OF_RANGE' : 'INVALID_TYPE'
    } else if (issue.code === 'invalid_format') {
      code = 'INVALID_TYPE'
    } else if (issue.code === 'unrecognized_keys') {
      code = 'UNKNOWN_KEY'
      const parentPath = mapZodPath(path)
      for (const key of issue.keys) {
        const field = parentPath ? `${parentPath}.${key}` : key
        errors.push({ code: 'UNKNOWN_KEY', field })
      }
      continue
    }

    errors.push({ code, field, message: issue.message })
  }
  return errors
}

export function validateOutput(
  raw: LlmRawOutput,
  _config?: OutputValidatorConfig,
): OutputValidationResult {
  const warnings: ValidationWarning[] = []
  const errors: ValidationError[] = []

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push({ code: 'INVALID_TYPE', field: '(root)', message: 'expected object' })
    return { valid: false, errors, warnings }
  }

  const parsed = StrictOutputSchema.safeParse(raw)

  if (!parsed.success) {
    const zodErrors = mapZodErrors(parsed.error)
    errors.push(...zodErrors)
  }

  // ── Evidence warnings (soft checks, not schema errors) ──
  const obj = raw as unknown as Record<string, unknown>
  if (Array.isArray(obj.facts)) {
    obj.facts.forEach((fact: unknown, i: number) => {
      if (fact !== null && typeof fact === 'object' && !Array.isArray(fact)) {
        const f = fact as Record<string, unknown>
        if (f.evidenceLocator === null) {
          warnings.push({ code: 'MISSING_EVIDENCE', field: `facts[${i}].evidenceLocator` })
        }
        if (f.sourceExcerpt === null) {
          warnings.push({ code: 'MISSING_EVIDENCE', field: `facts[${i}].sourceExcerpt` })
        }
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
