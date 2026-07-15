import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, afterAll } from "vitest";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

export const TEST_WORKSPACE = "10000000-0000-0000-0000-000000000001";
export const TEST_BUSINESS = "10000000-0000-0000-0000-000000000002";
export const TEST_USER = "10000000-0000-0000-0000-000000000010";

export const canRun = Boolean(supabaseServiceKey);

let client: SupabaseClient | null = null;
const createdIds: { table: string; id: string }[] = [];

beforeAll(() => {
  if (supabaseServiceKey) {
    client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }
});

afterAll(async () => {
  for (const { table, id } of [...createdIds].reverse()) {
    await client!.from(table).delete().eq("id", id);
  }
});

export function track(table: string, id: string) {
  createdIds.push({ table, id });
}

export async function cleanup(table: string, id: string) {
  await client!.from(table).delete().eq("id", id);
  const idx = createdIds.findIndex((r) => r.table === table && r.id === id);
  if (idx >= 0) createdIds.splice(idx, 1);
}

export function getClient(): SupabaseClient {
  if (!client) throw new Error("Supabase client not initialised");
  return client;
}
