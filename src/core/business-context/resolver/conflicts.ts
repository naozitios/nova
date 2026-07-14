// ─── Conflict detection across active facts ─────────────────────────────────

import type { ContextFact, JsonValue } from '../types'
import { normalizeFactKey } from './normalize'

export function detectConflicts(facts: ContextFact[]): {
  factKey: string
  factIds: string[]
  values: JsonValue[]
}[] {
  const active = facts.filter(
    (f) => f.verificationStatus !== 'superseded' && f.verificationStatus !== 'rejected',
  )

  const byKey = new Map<string, ContextFact[]>()
  for (const fact of active) {
    const norm = normalizeFactKey(fact.factKey)
    const arr = byKey.get(norm) ?? []
    arr.push(fact)
    byKey.set(norm, arr)
  }

  const conflicts: { factKey: string; factIds: string[]; values: JsonValue[] }[] = []

  for (const [key, group] of byKey) {
    if (group.length < 2) continue

    const uniqueValues = new Map<string, JsonValue>()
    for (const f of group) {
      const serialized = JSON.stringify(f.value)
      if (!uniqueValues.has(serialized)) {
        uniqueValues.set(serialized, f.value)
      }
    }

    if (uniqueValues.size > 1) {
      conflicts.push({
        factKey: key,
        factIds: group.map((f) => f.id),
        values: Array.from(uniqueValues.values()),
      })
    }
  }

  return conflicts
}
