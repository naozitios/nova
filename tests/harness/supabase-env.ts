import { getSupabaseTestEnv, type SupabaseTestEnv } from './supabase-test-env';

export const SUPABASE_TEST_SETUP_HINT =
  'Run npm run supabase:start, then npm run supabase:reset before DB-backed tests.';

export function getRequiredSupabaseTestEnv(): SupabaseTestEnv {
  const env = getSupabaseTestEnv();
  if (!env.available) {
    throw new Error(SUPABASE_TEST_SETUP_HINT);
  }
  return env;
}

export function isSupabaseTestEnvAvailable(): boolean {
  return getSupabaseTestEnv().available;
}
