import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabaseTestEnv {
  url: string;
  serviceRoleKey: string;
  anonKey: string;
  serviceClient: SupabaseClient;
  anonClient: SupabaseClient;
  available: boolean;
}

export function getSupabaseTestEnv(): SupabaseTestEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const serviceClient = serviceRoleKey
    ? createClient(url, serviceRoleKey, { auth: { persistSession: false } })
    : (null as unknown as SupabaseClient);

  const anonClient = anonKey
    ? createClient(url, anonKey, { auth: { persistSession: false } })
    : (null as unknown as SupabaseClient);

  return {
    url,
    serviceRoleKey,
    anonKey,
    serviceClient,
    anonClient,
    available: Boolean(serviceRoleKey && anonKey),
  };
}
