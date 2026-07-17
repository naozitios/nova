// ─── Sanitized error recording ──────────────────────────────────────────────
//
// Helpers for normalizing and sanitizing errors before they are persisted
// to the context_jobs table. Used by both the failure and dead-letter paths.

import type { JsonValue } from '@/core/business-context/types'

const SENSITIVE_KEYS = [
  'secret', 'password', 'token', 'api_key', 'apiKey',
  'authorization', 'cookie', 'service_role', 'serviceRoleKey',
]

function isSensitive(value: string): boolean {
  return SENSITIVE_KEYS.some((s) => value.toLowerCase().includes(s.toLowerCase()))
}

function sanitizeValue(value: unknown): JsonValue | undefined {
  if (typeof value === 'string') return isSensitive(value) ? undefined : value
  if (value == null || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeValue(item))
      .filter((item): item is JsonValue => item !== undefined)
  }
  if (typeof value === 'object') {
    const result: Record<string, JsonValue> = {}
    for (const [key, nested] of Object.entries(value)) {
      if (isSensitive(key)) continue
      const sanitized = sanitizeValue(nested)
      if (sanitized !== undefined) result[key] = sanitized
    }
    return result
  }
  return undefined
}

export function sanitizeError(error: unknown): JsonValue | null {
  if (!error || typeof error !== 'object') return null
  const raw = error as Record<string, unknown>
  const result: Record<string, JsonValue> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (isSensitive(key)) continue
    const sanitized = sanitizeValue(value)
    if (sanitized !== undefined) result[key] = sanitized
  }
  return result
}

export function extractErrorClass(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const e = error as Record<string, unknown>
  if (typeof e.errorClass === 'string') return e.errorClass
  if (typeof e.code === 'string') {
    if (e.code === 'LEGACY_FORMAT_UNSUPPORTED') return 'unsupported_file'
    return e.code.toLowerCase()
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('timeout')) return 'provider_timeout'
    if (msg.includes('oom') || msg.includes('out of memory')) return 'worker_oom'
  }
  return null
}
