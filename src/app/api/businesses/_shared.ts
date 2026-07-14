import { z } from 'zod'
import type { NextRequest } from 'next/server'
import type { AuthzContext } from '@/infrastructure/business-context/authz'
import { resolveWorkspaceAuth, requireRole } from '@/infrastructure/business-context/authz'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import type { WorkspaceRole } from '@/core/business-context/types'

// ─── JSON body parsing ──────────────────────────────────────────────────────

export async function parseJsonBody<T>(req: NextRequest): Promise<
  | { ok: true; data: T }
  | { ok: false; response: Response }
> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: { code: 'INVALID_BODY', message: 'Request body must be valid JSON' } },
        { status: 400 },
      ),
    }
  }
  return { ok: true, data: body as T }
}

// ─── Zod validation ─────────────────────────────────────────────────────────

export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { ok: true; data: T } | { ok: false; response: Response } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { ok: true, data: result.data }
  }
  return {
    ok: false,
    response: Response.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: result.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    ),
  }
}

// ─── Idempotency key enforcement ────────────────────────────────────────────

const idempotencyStore = new Map<string, { response: Response; timestamp: number }>()
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function getIdempotencyKey(req: NextRequest): string | null {
  return req.headers.get('idempotency-key')
}

export function checkIdempotency(key: string): Response | null {
  const cached = idempotencyStore.get(key)
  if (!cached) return null

  if (Date.now() - cached.timestamp > IDEMPOTENCY_TTL_MS) {
    idempotencyStore.delete(key)
    return null
  }

  return cached.response.clone()
}

export function storeIdempotency(key: string, response: Response): void {
  idempotencyStore.set(key, { response: response.clone(), timestamp: Date.now() })

  // Evict expired entries periodically
  if (idempotencyStore.size > 1000) {
    const now = Date.now()
    for (const [k, v] of idempotencyStore) {
      if (now - v.timestamp > IDEMPOTENCY_TTL_MS) {
        idempotencyStore.delete(k)
      }
    }
  }
}

export async function withIdempotency(
  req: NextRequest,
  handler: () => Promise<Response>,
): Promise<Response> {
  const key = getIdempotencyKey(req)
  if (key) {
    const cached = checkIdempotency(key)
    if (cached) return cached
  }

  const response = await handler()

  if (key && response.ok) {
    storeIdempotency(key, response)
  }

  return response
}

// ─── Authz helpers ──────────────────────────────────────────────────────────

export async function requireAuthz(
  req: NextRequest,
  workspaceId: string,
  minRole: WorkspaceRole = 'viewer',
): Promise<
  | { ok: true; ctx: AuthzContext }
  | { ok: false; response: Response }
> {
  const client = getSupabaseServiceClient()
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  // In development, allow X-User-Id header for testing
  const userId = token
    ? (await client.auth.getUser(token)).data.user?.id
    : req.headers.get('x-user-id')

  if (!userId) {
    return {
      ok: false,
      response: Response.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 },
      ),
    }
  }

  const authz = await resolveWorkspaceAuth(userId, workspaceId, client)
  if (!authz.ok) {
    return {
      ok: false,
      response: Response.json(
        { error: authz.error },
        { status: authz.error.code === 'WORKSPACE_NOT_FOUND' ? 404 : 403 },
      ),
    }
  }

  const roleCheck = requireRole(authz.ctx, minRole)
  if (!roleCheck.ok) {
    return {
      ok: false,
      response: Response.json(
        { error: roleCheck.error },
        { status: 403 },
      ),
    }
  }

  return { ok: true, ctx: authz.ctx }
}

// ─── Error response helpers ─────────────────────────────────────────────────

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): Response {
  return Response.json(
    { error: { code, message, details } },
    { status },
  )
}

export function notFound(message = 'Resource not found'): Response {
  return errorResponse(404, 'NOT_FOUND', message)
}

export function forbidden(message = 'Insufficient permissions'): Response {
  return errorResponse(403, 'FORBIDDEN', message)
}

export function unauthorized(message = 'Authentication required'): Response {
  return errorResponse(401, 'UNAUTHENTICATED', message)
}

export function badRequest(message: string, details?: unknown): Response {
  return errorResponse(400, 'BAD_REQUEST', message, details)
}

export function conflict(message: string): Response {
  return errorResponse(409, 'CONFLICT', message)
}

// ─── Response serialization ─────────────────────────────────────────────────

export function jsonResponse<T>(data: T, status = 200): Response {
  return Response.json(data, { status })
}

export function createdResponse<T>(data: T): Response {
  return Response.json(data, { status: 201 })
}

// ─── Workspace ID extraction ────────────────────────────────────────────────

export function extractWorkspaceId(pathname: string): string | null {
  // Matches /api/businesses/[workspaceId]/... or similar patterns
  const match = pathname.match(/\/api\/businesses\/([^/]+)/)
  return match?.[1] ?? null
}

// ─── Pagination helpers ─────────────────────────────────────────────────────

export function parsePagination(req: NextRequest): { limit: number; offset: number } {
  const url = new URL(req.url)
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '50'), 1), 100)
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0'), 0)
  return { limit, offset }
}

export function parseSort(
  req: NextRequest,
  allowedFields: readonly string[],
): { field: string; direction: 'asc' | 'desc' } | undefined {
  const url = new URL(req.url)
  const field = url.searchParams.get('sort')
  const direction = url.searchParams.get('order') === 'asc' ? 'asc' : 'desc'

  if (field && allowedFields.includes(field)) {
    return { field, direction }
  }
  return undefined
}
