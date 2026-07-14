import type { JsonValue, ServiceResult } from '@/core/business-context/types'

// ─── Row type alias (Supabase returns snake_case) ──────────────────────────

export type Row = Record<string, unknown>

/** Cast Supabase JSON to JsonValue (safe: Supabase stores valid JSON). */
export function asJson(v: unknown): JsonValue {
  return v as JsonValue
}

export function asJsonRecord(v: unknown): Record<string, JsonValue> {
  return (v ?? {}) as Record<string, JsonValue>
}

export function asJsonRecordOrNull(v: unknown): Record<string, JsonValue> | null {
  return v != null ? (v as Record<string, JsonValue>) : null
}

// ─── Error helper ───────────────────────────────────────────────────────────

export function err<T>(code: string, message: string): ServiceResult<T> {
  return { ok: false, error: { code, message } }
}
