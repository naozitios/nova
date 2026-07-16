// ─── Fact resolution facade ─────────────────────────────────────────────────

import type { ContextFact, JsonValue, VerificationStatus } from '../types'
import type { ExtractedFact } from '../extraction.port'
import { groupByNormalizedKey, normalizeFactKey } from './normalize'
import { decideProposed } from './precedence'

export interface ResolutionResult {
  superseded: { oldFactId: string }[]
  toCreate: ExtractedFact[]
  toUpdate: {
    factId: string
    confidence: number
    verificationStatus: VerificationStatus
  }[]
  conflicts: {
    factKey: string
    values: JsonValue[]
    factIds: string[]
  }[]
}

function isActive(f: ContextFact): boolean {
  return f.verificationStatus !== 'superseded' && f.verificationStatus !== 'rejected'
}

export function resolveFacts(
  existing: ContextFact[],
  incoming: ExtractedFact[],
): ResolutionResult {
  const result: ResolutionResult = {
    superseded: [],
    toCreate: [],
    toUpdate: [],
    conflicts: [],
  }
  const byKey = groupByNormalizedKey(existing)
  for (const inc of incoming) {
    const active = (byKey.get(normalizeFactKey(inc.factKey)) ?? []).filter(isActive)
    const d = decideProposed(inc, active)
    switch (d.kind) {
      case 'create':
        result.toCreate.push(inc)
        break
      case 'update':
        result.toUpdate.push({
          factId: d.factId,
          confidence: d.confidence,
          verificationStatus: d.verificationStatus,
        })
        break
      case 'supersede':
        for (const id of d.oldFactIds) result.superseded.push({ oldFactId: id })
        result.toCreate.push(inc)
        break
      case 'conflict':
        result.conflicts.push({
          factKey: d.factKey,
          values: d.values,
          factIds: d.factIds,
        })
        break
    }
  }
  // Deduplicate conflicts by normalized fact key (B29: exactly one per key)
  const seen = new Map<string, number>()
  const deduped: typeof result.conflicts = []
  for (const c of result.conflicts) {
    const norm = normalizeFactKey(c.factKey)
    const idx = seen.get(norm)
    if (idx !== undefined) {
      const existing = deduped[idx]
      for (const id of c.factIds) {
        if (!existing.factIds.includes(id)) existing.factIds.push(id)
      }
      for (const v of c.values) {
        if (!existing.values.some((ev) => JSON.stringify(ev) === JSON.stringify(v))) {
          existing.values.push(v)
        }
      }
    } else {
      seen.set(norm, deduped.length)
      deduped.push({ ...c, factIds: [...c.factIds], values: [...c.values] })
    }
  }
  result.conflicts = deduped

  return result
}
