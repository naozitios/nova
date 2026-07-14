// ─── Sanitized error recording ──────────────────────────────────────────────
//
// Helpers for normalizing and sanitizing errors before they are persisted
// to the context_jobs table. Used by both the failure and dead-letter paths.

import type { JsonValue } from '@/core/business-context/types'

const SENSITIVE_KEYS = [
  'secret', 'password', 'token', 'api_key', 'apiKey',
  'authorization', 'cookie', 'service_role', 'serviceRoleKey',
]

export function sanitizeError(error: unknown): JsonValue | null {
  if (!error || typeof error !== 'object') return null
  const raw = error as Record<string, unknown>
  const result: Record<string, JsonValue> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) continue
    if (typeof value === 'string' && SENSITIVE_KEYS.some((s) => value.toLowerCase().includes(s))) continue
    result[key] = value as JsonValue
  }
  return result
}

export function extractErrorClass(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const e = error as Record<string, unknown>
  if (typeof e.errorClass === 'string') return e.errorClass
  if (typeof e.code === 'string') return e.code.toLowerCase()
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('timeout')) return 'provider_timeout'
    if (msg.includes('oom') || msg.includes('out of memory')) return 'worker_oom'
  }
  return null
}
