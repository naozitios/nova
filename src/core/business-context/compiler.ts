import type { RepositoryPort } from './repository.port'
import type { JsonValue, ServiceResult, ContextConflict } from './types'
import { REQUIRED_PROFILE_SECTIONS } from './types'

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
