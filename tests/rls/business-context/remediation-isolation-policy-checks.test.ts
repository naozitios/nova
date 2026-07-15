import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  run,
  initServiceClient,
  getServiceClient,
  cleanupUsers,
  type TableName,
} from "./remediation-isolation-fixtures";

// ---------------------------------------------------------------------------
// RLS policy existence checks via SQL — new remediation tables only
// ---------------------------------------------------------------------------

describe.skipIf(!run)("RLS — Policy Existence Checks", () => {
  beforeAll(() => initServiceClient());
  afterAll(() => cleanupUsers());

  const serverOnlyTables: TableName[] = [
    "context_idempotency_records",
    "business_context_meta_connections",
    "business_context_meta_oauth_states",
  ];

  it("has a member SELECT policy on context_upload_intents", async () => {
    const serviceClient = getServiceClient();
    const { data, error } = await serviceClient.rpc("exec_sql", {
      query: `
        SELECT polname
        FROM pg_policy pol
        JOIN pg_class pc ON pc.oid = pol.polrelid
        JOIN pg_namespace pn ON pn.oid = pc.relnamespace
        WHERE pc.relname = 'context_upload_intents'
          AND pn.nspname = 'public'
          AND pol.polcmd IN ('r', '*')
      `,
    });
    expect(error).toBeNull();
    expect((data as unknown[]).length).toBeGreaterThan(0);
  });

  for (const table of serverOnlyTables) {
    it(`has no direct authenticated policies on ${table}`, async () => {
      const serviceClient = getServiceClient();
      const { data, error } = await serviceClient.rpc("exec_sql", {
        query: `
          SELECT polname
          FROM pg_policy pol
          JOIN pg_class pc ON pc.oid = pol.polrelid
          JOIN pg_namespace pn ON pn.oid = pc.relnamespace
          WHERE pc.relname = '${table}'
            AND pn.nspname = 'public'
        `,
      });
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  }

  const supportTables: TableName[] = [
    "context_upload_intents",
    ...serverOnlyTables,
  ];

  for (const table of supportTables) {
    it(`has no direct INSERT policy on ${table}`, async () => {
      const serviceClient = getServiceClient();
      const { data, error } = await serviceClient.rpc("exec_sql", {
        query: `
          SELECT polname
          FROM pg_policy pol
          JOIN pg_class pc ON pc.oid = pol.polrelid
          JOIN pg_namespace pn ON pn.oid = pc.relnamespace
          WHERE pc.relname = '${table}'
            AND pn.nspname = 'public'
            AND pol.polcmd IN ('a', '*')
        `,
      });
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  }
});
