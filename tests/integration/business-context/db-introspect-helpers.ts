import { beforeAll, it } from "vitest";
import { getSupabaseTestEnv } from "../../harness/supabase-test-env";

const env = getSupabaseTestEnv();
export const itDb = env.available ? it : it.skip;

export function requireEnv() {
  beforeAll(() => {
    if (!env.available) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY not set; required for remediation migration tests",
      );
    }
  });
}

async function query<T = Record<string, unknown>>(
  sql: string,
): Promise<T[]> {
  const { data, error } = await env.serviceClient.rpc("exec_sql", { query: sql });
  if (error) throw error;
  return data as T[];
}

export async function columnExists(
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`,
  );
  return rows.length > 0;
}

export async function columnType(
  table: string,
  column: string,
): Promise<string | null> {
  const rows = await query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = '${column}'`,
  );
  return rows[0]?.data_type ?? null;
}

export async function tableExists(table: string): Promise<boolean> {
  const rows = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = '${table}'`,
  );
  return rows.length > 0;
}

export async function indexExists(
  table: string,
  indexName: string,
): Promise<boolean> {
  const rows = await query<{ indexname: string }>(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND tablename = '${table}' AND indexname = '${indexName}'`,
  );
  return rows.length > 0;
}

export async function constraintExists(
  table: string,
  constraintName: string,
): Promise<boolean> {
  const rows = await query<{ constraint_name: string }>(
    `SELECT constraint_name FROM information_schema.table_constraints
     WHERE table_schema = 'public' AND table_name = '${table}' AND constraint_name = '${constraintName}'`,
  );
  return rows.length > 0;
}

export async function checkConstraintDef(
  table: string,
  constraintName: string,
): Promise<string | null> {
  const rows = await query<{ check_clause: string }>(
    `SELECT check_clause FROM information_schema.check_constraints
     WHERE constraint_schema = 'public' AND constraint_name = '${constraintName}'`,
  );
  return rows[0]?.check_clause ?? null;
}

export async function getColumns(
  table: string,
): Promise<{ column_name: string; data_type: string; is_nullable: string }[]> {
  return query(
    `SELECT column_name, data_type, is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}'
     ORDER BY ordinal_position`,
  );
}

export { query };
