// ─── Fact key normalization + deduplication ─────────────────────────────────

import type { ContextFact, JsonValue } from '../types'
import type { ExtractedFact } from '../extraction.port'

export function normalizeFactKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/_/g, '.')
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

export function valuesEqual(a: JsonValue, b: JsonValue): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
  const byKeyAndValue = new Map<string, ExtractedFact>()
  for (const fact of facts) {
    const norm = normalizeFactKey(fact.factKey)
    const composite = `${norm}::${JSON.stringify(fact.value)}`
    const existing = byKeyAndValue.get(composite)
    if (!existing || fact.confidence > existing.confidence) {
      byKeyAndValue.set(composite, fact)
    }
  }
  return Array.from(byKeyAndValue.values())
}

export function groupByNormalizedKey(facts: ContextFact[]): Map<string, ContextFact[]> {
  const byKey = new Map<string, ContextFact[]>()
  for (const f of facts) {
    const norm = normalizeFactKey(f.factKey)
    const arr = byKey.get(norm) ?? []
    arr.push(f)
    byKey.set(norm, arr)
  }
  return byKey
}
