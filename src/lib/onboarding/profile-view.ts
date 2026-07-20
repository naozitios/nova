import type { JsonValue } from '@/core/business-context/types'
import { REQUIRED_PROFILE_SECTIONS } from '@/core/business-context/types/purpose'

export interface ProfileViewSection {
  key: string
  title: string
  fields: { label: string; value: JsonValue }[]
}

export function toProfileSections(profile: Record<string, JsonValue>): ProfileViewSection[] {
  const sections: ProfileViewSection[] = []

  for (const key of REQUIRED_PROFILE_SECTIONS) {
    const data = profile[key]
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue

    const title = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())

    const entries = Object.entries(data as Record<string, JsonValue>)
    if (entries.length === 0) continue

    const fields = entries
      .filter(([k]) => k !== '_provenance')
      .map(([k, v]) => ({
        label: k
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
        value: v,
      }))

    if (fields.length > 0) {
      sections.push({ key, title, fields })
    }
  }

  return sections
}
