import type { BusinessProfileVersion, ContextPurpose, JsonValue, ProfileSectionName, ServiceResult } from './types'
import { PURPOSE_SECTIONS } from './types'
import { projectToMarkdown } from './compiler'

// ─── Compiled context result ─────────────────────────────────────────────────

export interface CompiledContext {
  purpose: ContextPurpose
  business_context_version: string
  context: Record<string, JsonValue>
  unresolved_fields: string[]
  compiled_at: string
}

// ─── Purpose-specific context compiler (FR-030) ─────────────────────────────

/**
 * Compile task-specific context from a profile version.
 * Returns only sections allowed for the given purpose.
 */
export function compileContextForPurpose(
  profileVersion: BusinessProfileVersion,
  purpose: ContextPurpose,
): ServiceResult<CompiledContext> {
  const allowedSections = PURPOSE_SECTIONS[purpose]
  if (!allowedSections) {
    return {
      ok: false,
      error: { code: 'INVALID_PURPOSE', message: `Unknown purpose: ${purpose}` },
    }
  }

  const profile = profileVersion.profile
  const context: Record<string, JsonValue> = {}
  const unresolvedFields: string[] = []

  for (const section of allowedSections) {
    const value = profile[section]
    if (value !== undefined && value !== null) {
      // Check if empty object
      if (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0) {
        unresolvedFields.push(section)
      } else {
        context[section] = value
      }
    } else {
      unresolvedFields.push(section)
    }
  }

  return {
    ok: true,
    data: {
      purpose,
      business_context_version: profileVersion.id,
      context,
      unresolved_fields: unresolvedFields,
      compiled_at: new Date().toISOString(),
    },
  }
}

/**
 * Get the allowed sections for a given purpose.
 */
export function getAllowedSections(purpose: ContextPurpose): readonly ProfileSectionName[] {
  return PURPOSE_SECTIONS[purpose] ?? []
}

/**
 * Validate that a purpose string is a valid ContextPurpose.
 */
export function isValidPurpose(purpose: string): purpose is ContextPurpose {
  return purpose in PURPOSE_SECTIONS
}
