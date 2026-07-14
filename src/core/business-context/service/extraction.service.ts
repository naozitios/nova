// US3: Extraction workflows — fact extraction, reconciliation, conflict resolution.
// The pure resolution primitives live in ../resolver.ts; this module re-exports them
// under the user-story API names so callers can depend on a single service surface.

import type { ContextFact, JsonValue } from '../types'
import type { ExtractedFact } from '../extraction.port'
import type { RepositoryPort } from '../repository.port'
import {
  resolveFacts,
  detectConflicts,
  normalizeFactKey,
  type ResolutionResult,
} from '../resolver'

export type { ResolutionResult }

export function extractFacts(facts: ExtractedFact[]): ExtractedFact[] {
  return normalizeFacts(facts)
}

export function normalizeFacts(facts: ExtractedFact[]): ExtractedFact[] {
  return facts.map((f) => ({ ...f, factKey: normalizeFactKey(f.factKey) }))
}

export function reconcileFacts(
  existing: ContextFact[],
  incoming: ExtractedFact[],
): ResolutionResult {
  return resolveFacts(existing, incoming)
}

export interface ConflictGroup {
  factKey: string
  factIds: string[]
  values: JsonValue[]
}

export function resolveConflict(facts: ContextFact[]): ConflictGroup[] {
  return detectConflicts(facts) as ConflictGroup[]
}
