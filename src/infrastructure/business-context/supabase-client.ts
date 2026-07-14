import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '@/infrastructure/config'

let _anonClient: SupabaseClient | null = null
let _serviceClient: SupabaseClient | null = null

/**
 * Anon Supabase client. Safe for browser and server use.
 * Uses the anon key which is subject to RLS policies.
 */
export function getSupabaseAnonClient(): SupabaseClient {
  if (!_anonClient) {
    _anonClient = createClient(
      config.businessContext.supabaseUrl,
      config.businessContext.supabaseAnonKey,
      { auth: { persistSession: false } },
    )
  }
  return _anonClient
}

/**
 * Service-role Supabase client. SERVER-SIDE ONLY.
 * Bypasses RLS. Never import in client components or expose the key.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!_serviceClient) {
    _serviceClient = createClient(
      config.businessContext.supabaseUrl,
      config.businessContext.supabaseServiceRoleKey,
      { auth: { persistSession: false } },
    )
  }
  return _serviceClient
}

/** Reset clients (for testing). */
export function resetSupabaseClients(): void {
  _anonClient = null
  _serviceClient = null
}
