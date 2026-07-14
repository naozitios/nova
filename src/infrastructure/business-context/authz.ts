import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkspaceRole } from '@/core/business-context/types'
import { getSupabaseServiceClient } from './supabase-client'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthzContext {
  userId: string
  workspaceId: string
  role: WorkspaceRole
}

export interface AuthzError {
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'WORKSPACE_NOT_FOUND'
  message: string
}

export type AuthzResult =
  | { ok: true; ctx: AuthzContext }
  | { ok: false; error: AuthzError }

// ─── Role hierarchy ─────────────────────────────────────────────────────────

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
}

function roleAtLeast(role: WorkspaceRole, minRole: WorkspaceRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minRole]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the current user's workspace membership and role.
 * Uses the service-role client to query workspace_members (bypasses RLS
 * since the auth token may not be available server-side in worker context).
 */
export async function resolveWorkspaceAuth(
  userId: string,
  workspaceId: string,
  client?: SupabaseClient,
): Promise<AuthzResult> {
  const db = client ?? getSupabaseServiceClient()

  const { data, error } = await db
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return {
      ok: false,
      error: { code: 'WORKSPACE_NOT_FOUND', message: 'User is not a member of this workspace' },
    }
  }

  return {
    ok: true,
    ctx: { userId, workspaceId, role: data.role as WorkspaceRole },
  }
}

/**
 * Check if the authenticated context has at least the required role.
 */
export function hasMinRole(ctx: AuthzContext, minRole: WorkspaceRole): boolean {
  return roleAtLeast(ctx.role, minRole)
}

/**
 * Assert that context has at least the required role. Returns error result if not.
 */
export function requireRole(
  ctx: AuthzContext,
  minRole: WorkspaceRole,
): AuthzResult {
  if (roleAtLeast(ctx.role, minRole)) {
    return { ok: true, ctx }
  }
  return {
    ok: false,
    error: {
      code: 'FORBIDDEN',
      message: `Requires ${minRole} role or higher, current role: ${ctx.role}`,
    },
  }
}

/**
 * Extract userId from a Supabase auth session or JWT.
 * Returns null if no valid session.
 */
export async function getCurrentUserId(
  client: SupabaseClient,
): Promise<string | null> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}
