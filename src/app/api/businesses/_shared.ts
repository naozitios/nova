import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import type { AuthzContext } from '@/infrastructure/business-context/authz'
import { resolveWorkspaceAuth, requireRole } from '@/infrastructure/business-context/authz'
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client'
import { config } from '@/infrastructure/config'
import type { WorkspaceRole } from '@/core/business-context/types'

// ─── JSON body parsing ──────────────────────────────────────────────────────

export async function parseJsonBody<T>(req: Request): Promise<
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

// ─── Idempotency key enforcement (durable, workspace-scoped) ────────────────

import { createHash } from 'crypto'
import type { IdempotencyOperation } from '@/core/business-context/types/remediation-entities'
import { IdempotencyRepository } from '@/infrastructure/business-context/repository/idempotency.repository'

const IDEMPOTENCY_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

function getIdempotencyRepo(): IdempotencyRepository {
  return new IdempotencyRepository(getSupabaseServiceClient())
}

export function getIdempotencyKey(req: NextRequest): string | null {
  return req.headers.get('idempotency-key')
}

export function computeFingerprint(body: unknown): string {
  const canonical = JSON.stringify(body ?? null, Object.keys(body as Record<string, unknown> ?? {}))
  return createHash('sha256').update(canonical).digest('hex')
}

export async function withIdempotency(
  req: NextRequest,
  handler: () => Promise<Response>,
  opts: { operation: IdempotencyOperation; workspaceId?: string | (() => string | null) },
): Promise<Response> {
  const key = getIdempotencyKey(req)
  if (!key) {
    return Response.json(
      { error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required' } },
      { status: 400 },
    )
  }

  const rawScope = typeof opts.workspaceId === 'function'
    ? opts.workspaceId()
    : (opts.workspaceId ?? extractWorkspaceId(req.nextUrl.pathname))
  if (!rawScope) {
    return Response.json(
      { error: { code: 'WORKSPACE_REQUIRED', message: 'Workspace ID could not be determined' } },
      { status: 400 },
    )
  }

  // When the scope came from path extraction (not explicitly provided), it may
  // be a business ID. Resolve it to the actual workspace FK for nested routes
  // like /api/businesses/:id/context/... where :id is a business, not workspace.
  const workspaceId = opts.workspaceId
    ? rawScope
    : await resolveWorkspaceFromPath(rawScope)
  if (!workspaceId) {
    return Response.json(
      { error: { code: 'WORKSPACE_REQUIRED', message: 'Business not found or has no workspace' } },
      { status: 404 },
    )
  }

  const body = await req.clone().json().catch(() => null)
  const fingerprint = computeFingerprint(body)
  const repo = getIdempotencyRepo()

  const existing = await repo.findByKey(workspaceId, opts.operation, key)
  if (!existing.ok) {
    return Response.json(
      { error: { code: 'IDEMPOTENCY_STORE_ERROR', message: 'Failed to check idempotency' } },
      { status: 500 },
    )
  }

  if (existing.data) {
    // replay cached response on matching key+payload
    if (existing.data.requestFingerprint !== fingerprint) {
      return Response.json(
        { error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'Idempotency-Key reused with different payload' } },
        { status: 409 },
      )
    }
    if (existing.data.state === 'completed' && existing.data.responseBody) {
      return Response.json(existing.data.responseBody, {
        status: existing.data.responseStatus ?? 200,
      })
    }
    if (existing.data.state === 'in_progress' || existing.data.state === 'pending') {
      return Response.json(
        { error: { code: 'IDEMPOTENCY_IN_PROGRESS', message: 'Request is already being processed' } },
        { status: 409 },
      )
    }
  }

  const createResult = await repo.createRecord({
    workspaceId,
    operation: opts.operation,
    idempotencyKey: key,
    requestFingerprint: fingerprint,
    state: 'in_progress',
    resourceType: null,
    resourceId: null,
    responseStatus: null,
    responseBody: null,
    expiresAt: new Date(Date.now() + IDEMPOTENCY_EXPIRY_MS),
    completedAt: null,
  })
  if (!createResult.ok) {
    return Response.json(
      { error: { code: 'IDEMPOTENCY_STORE_ERROR', message: 'Failed to create idempotency record' } },
      { status: 500 },
    )
  }

  const response = await handler()

  if (response.ok) {
    const responseBody = await response.clone().json().catch(() => ({}))
    await repo.updateState(workspaceId, createResult.data.id, 'completed', {
      responseStatus: response.status,
      responseBody,
      completedAt: new Date(),
    })
  } else {
    await repo.updateState(workspaceId, createResult.data.id, 'failed', {
      responseStatus: response.status,
      completedAt: new Date(),
    })
  }

  return response
}

// ─── Auth helpers ───────────────────────────────────────────────────────────

/**
 * Resolve current user ID from request headers/cookies.
 * Extracted from requireAuthz for reuse outside workspace-scoped auth.
 */
export async function authenticateRequest(
  req: NextRequest,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: Response }
> {
  const client = getSupabaseServiceClient()
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  // In development, allow X-User-Id header for testing
  let userId: string | null = null
  if (token) {
    userId = (await client.auth.getUser(token)).data.user?.id ?? null
  } else if (req.headers.get('x-user-id')) {
    userId = req.headers.get('x-user-id')
  } else {
    // Try NextAuth session cookie (dev/test)
    const sessionToken = await getToken({ req, secret: config.auth.nextAuthSecret })
    userId = sessionToken?.sub ?? null
  }

  if (!userId) {
    return {
      ok: false,
      response: Response.json(
        { error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } },
        { status: 401 },
      ),
    }
  }

  return { ok: true, userId }
}

// ─── Authz helpers ──────────────────────────────────────────────────────────

export async function requireAuthz(
  req: NextRequest,
  workspaceId: string,
  minRole: WorkspaceRole = 'viewer',
  authenticatedUserId?: string,
): Promise<
  | { ok: true; ctx: AuthzContext }
  | { ok: false; response: Response }
> {
  let userId: string
  if (authenticatedUserId) {
    userId = authenticatedUserId
  } else {
    const authResult = await authenticateRequest(req)
    if (!authResult.ok) return authResult
    userId = authResult.userId
  }

  const client = getSupabaseServiceClient()
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

/**
 * When extractWorkspaceId pulls a value from the path it may actually be a
 * business ID (nested routes use /api/businesses/:businessId/...). This
 * resolves it to the real workspace FK via the businesses table. Returns the
 * value unchanged if it already looks like a UUID (optimisation: skip DB hit
 * for explicit workspace IDs passed through opts.workspaceId).
 */
async function resolveWorkspaceFromPath(candidateId: string): Promise<string | null> {
  const client = getSupabaseServiceClient()
  const { data, error } = await client
    .from('businesses')
    .select('workspace_id')
    .eq('id', candidateId)
    .single()

  if (error || !data?.workspace_id) return null
  return data.workspace_id as string
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
