import type { RepositoryPort } from './repository.port'
import type {
  ContextFact,
  ContextConflict,
  JsonValue,
  ServiceResult,
  VerificationStatus,
} from './types'
import { REQUIRED_PROFILE_SECTIONS } from './types'
import { runFactGates, hasBlockingFailures } from './quality-gates'

// ─── Validation result ──────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  missingSections: string[]
  unresolvedConflicts: ContextConflict[]
}

// ─── Profile validation ─────────────────────────────────────────────────────

export async function validateProfile(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
  profile: Record<string, JsonValue>,
): Promise<ServiceResult<ValidationResult>> {
  const missingSections = REQUIRED_PROFILE_SECTIONS.filter((section) => {
    const value = profile[section]
    if (!value) return true
    if (typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).length === 0
    }
    return false
  })

  const conflictsResult = await repo.listContextConflicts({
    workspaceId,
    businessId,
    status: 'open',
  })
  if (!conflictsResult.ok) return conflictsResult

  return {
    ok: true,
    data: {
      valid: missingSections.length === 0 && conflictsResult.data.items.length === 0,
      missingSections,
      unresolvedConflicts: conflictsResult.data.items,
    },
  }
}

// ─── Required fields check ──────────────────────────────────────────────────

export async function checkRequiredFieldsFulfilled(
  repo: RepositoryPort,
  sessionId: string,
  workspaceId: string,
): Promise<ServiceResult<{ fulfilled: boolean; missingFields: string[] }>> {
  const questionsResult = await repo.listOnboardingQuestions({
    workspaceId,
    sessionId,
  })
  if (!questionsResult.ok) return questionsResult

  const answered = new Map<string, unknown>()
  for (const q of questionsResult.data.items) {
    if (q.status === 'answered' && q.answer !== null) {
      answered.set(q.factKey, q.answer)
    }
  }

  const missingFields: string[] = []
  for (const section of REQUIRED_PROFILE_SECTIONS) {
    if (!answered.has(section)) {
      missingFields.push(section)
    }
  }

  return {
    ok: true,
    data: {
      fulfilled: missingFields.length === 0,
      missingFields,
    },
  }
}

// ─── Confidence thresholds ──────────────────────────────────────────────────

export const CONFIDENCE_THRESHOLDS = {
  /** Facts below this are excluded from draft compilation */
  MIN_COMPILE: 0.5,
  /** Facts in this range produce warnings but still compile */
  REVIEW_RANGE_MIN: 0.5,
  REVIEW_RANGE_MAX: 0.7,
  /** Facts at or above this are considered high confidence */
  HIGH: 0.7,
} as const

// ─── Active fact selection ──────────────────────────────────────────────────

/**
 * Filter active facts: exclude superseded and rejected facts.
 * User-verified facts always pass confidence thresholds.
 */
export function selectActiveFacts(facts: ContextFact[]): ContextFact[] {
  return facts.filter(
    (f) =>
      f.verificationStatus !== 'superseded' &&
      f.verificationStatus !== 'rejected',
  )
}

/**
 * Group facts by their top-level section key (e.g. "business", "offers").
 * Within each section, keep only the highest-confidence active fact per factKey.
 */
export function groupFactsBySection(
  facts: ContextFact[],
): Map<string, Map<string, ContextFact>> {
  const bySection = new Map<string, Map<string, ContextFact>>()

  for (const fact of facts) {
    const section = fact.factKey.split('.')[0] ?? fact.factKey
    if (!bySection.has(section)) {
      bySection.set(section, new Map())
    }
    const sectionFacts = bySection.get(section)!
    const existing = sectionFacts.get(fact.factKey)
    if (!existing || fact.confidence > existing.confidence) {
      sectionFacts.set(fact.factKey, fact)
    }
  }

  return bySection
}

// ─── Nested value builder ────────────────────────────────────────────────────

/**
 * Set a value in an object using a dotted path.
 * E.g. setNestedValue(obj, "pricing.tier_count", 3)
 * creates obj.pricing = { tier_count: 3 }.
 */
function setNestedValue(
  obj: Record<string, JsonValue>,
  path: string,
  value: JsonValue,
): void {
  const parts = path.split('.')
  let current: Record<string, JsonValue> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!(key in current) || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {}
    }
    current = current[key] as Record<string, JsonValue>
  }
  current[parts[parts.length - 1]] = value
}

// ─── Draft compilation ──────────────────────────────────────────────────────

export interface CompiledDraft {
  profile: Record<string, JsonValue>
  unresolvedFields: string[]
  warnings: string[]
}

/**
 * Compile a draft profile from active facts in the repository.
 * Assembles sections, filters by confidence thresholds, tracks unresolved fields.
 */
export async function compileDraftFromFacts(
  repo: RepositoryPort,
  businessId: string,
  workspaceId: string,
): Promise<ServiceResult<CompiledDraft>> {
  const factsResult = await repo.listContextFacts({
    workspaceId,
    businessId,
    active: true,
  })
  if (!factsResult.ok) return factsResult

  const activeFacts = selectActiveFacts(factsResult.data.items)
  const bySection = groupFactsBySection(activeFacts)

  const profile: Record<string, JsonValue> = {}
  const unresolvedFields: string[] = []
  const warnings: string[] = []

  for (const section of REQUIRED_PROFILE_SECTIONS) {
    const sectionFacts = bySection.get(section)
    if (!sectionFacts || sectionFacts.size === 0) {
      unresolvedFields.push(section)
      continue
    }

    const sectionData: Record<string, JsonValue> = {}
    let sectionHasContent = false

    for (const [factKey, fact] of sectionFacts) {
      const isUserVerified = fact.verificationStatus === 'user_verified'

      if (!isUserVerified && fact.confidence < CONFIDENCE_THRESHOLDS.MIN_COMPILE) {
        unresolvedFields.push(factKey)
        continue
      }

      if (
        !isUserVerified &&
        fact.confidence >= CONFIDENCE_THRESHOLDS.REVIEW_RANGE_MIN &&
        fact.confidence < CONFIDENCE_THRESHOLDS.HIGH
      ) {
        warnings.push(
          `Low confidence (${fact.confidence}) for ${factKey}`,
        )
      }

      // Use the leaf key within the section — nested via setNestedValue
      const leafKey = factKey.includes('.') ? factKey.split('.').slice(1).join('.') : factKey
      setNestedValue(sectionData, leafKey, fact.value)
      sectionHasContent = true
    }

    if (sectionHasContent) {
      profile[section] = sectionData
    } else {
      unresolvedFields.push(section)
    }
  }

  return { ok: true, data: { profile, unresolvedFields, warnings } }
}

// ─── Markdown projection ────────────────────────────────────────────────────

/**
 * Project a compiled profile to Markdown.
 * Each section becomes a heading; each key-value pair becomes a bullet.
 */
export function projectToMarkdown(profile: Record<string, JsonValue>): string {
  const lines: string[] = []

  for (const section of REQUIRED_PROFILE_SECTIONS) {
    const data = profile[section]
    const title = section.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
lines.push(`## ${title}`)

    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, val] of Object.entries(data as Record<string, JsonValue>)) {
        lines.push(`- **${key}**: ${JSON.stringify(val)}`)
      }
    } else if (data !== undefined && data !== null) {
      lines.push(`- ${JSON.stringify(data)}`)
    } else {
      lines.push('- *No data available*')
    }

    lines.push('')
  }

  return lines.join('\n')
}
