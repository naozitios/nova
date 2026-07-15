import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { withIdempotency } from "@/app/api/businesses/_shared";
import type { IdempotencyOperation } from "@/core/business-context/types/remediation-entities";

// ---------------------------------------------------------------------------
// B06 verification — real Supabase integration test for withIdempotency
//
// Proves against live Supabase (no mocks, no fakes):
//   1. First call runs handler and persists completed idempotency record
//   2. Same key + same payload replays stored response without handler re-execution
//   3. Same key + different payload returns 409 IDEMPOTENCY_KEY_REUSED
//
// Uses service-role client to seed/inspect/clean. Does not reset DB.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";

let supabase: SupabaseClient;

// Unique test workspace — created in beforeAll, cleaned in afterAll
let testWorkspaceId: string;

const TEST_OPERATION: IdempotencyOperation = "create_business";

beforeAll(() => {
  if (!SUPABASE_SERVICE_KEY) return;
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  testWorkspaceId = crypto.randomUUID();
});

afterAll(async () => {
  if (!supabase || !SUPABASE_SERVICE_KEY) return;

  // Workspace FK cascade deletes idempotency records automatically
  await supabase.from("workspaces").delete().eq("id", testWorkspaceId);
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeIdempotencyRequest(
  key: string,
  body: Record<string, unknown>,
): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    headers: {
      "idempotency-key": key,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe.skipIf(!SUPABASE_SERVICE_KEY)(
  "withIdempotency — real Supabase integration",
  () => {
    beforeAll(async () => {
      if (!supabase) return;
      // Ensure workspace exists for FK references
      const { error } = await supabase.from("workspaces").upsert(
        { id: testWorkspaceId, name: `Idempotency Test ${testWorkspaceId.slice(0, 8)}` },
        { onConflict: "id" },
      );
      if (error) {
        throw new Error(`Failed to create test workspace: ${error.message}`);
      }
    });

    it("first call runs handler and persists completed record", async () => {
      const key = crypto.randomUUID();
      const body = { name: "Acme Corp", website: "https://acme.example.com" };
      const req = makeIdempotencyRequest(key, body);

      let handlerCallCount = 0;
      const handler = async () => {
        handlerCallCount++;
        return Response.json(
          { ok: true, data: { id: "biz-123", name: body.name } },
          { status: 201 },
        );
      };

      const response = await withIdempotency(req, handler, {
        operation: TEST_OPERATION,
        workspaceId: testWorkspaceId,
      });

      // Handler was called
      expect(handlerCallCount).toBe(1);

      // Response comes from handler
      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.ok).toBe(true);
      expect(json.data.name).toBe("Acme Corp");

      // Record persisted in Supabase
      const { data: record, error: readError } = await supabase
        .from("context_idempotency_records")
        .select("*")
        .eq("workspace_id", testWorkspaceId)
        .eq("operation", TEST_OPERATION)
        .eq("idempotency_key", key)
        .single();

      expect(readError).toBeNull();
      expect(record).not.toBeNull();
      expect(record!.state).toBe("completed");
      expect(record!.response_status).toBe(201);
      expect(record!.response_body).toEqual(json);
      expect(record!.request_fingerprint).toBeTruthy();
    });

    it("same key + same payload replays without handler re-execution", async () => {
      const key = crypto.randomUUID();
      const body = { name: "Globex Inc", website: "https://globex.example.com" };

      let handlerCallCount = 0;

      // First call — runs handler
      const req1 = makeIdempotencyRequest(key, body);
      const response1 = await withIdempotency(
        req1,
        async () => {
          handlerCallCount++;
          return Response.json(
            { ok: true, data: { id: "biz-456", name: body.name } },
            { status: 201 },
          );
        },
        { operation: TEST_OPERATION, workspaceId: testWorkspaceId },
      );

      expect(handlerCallCount).toBe(1);
      const json1 = await response1.json();

      // Second call — same key + same payload → replay
      const req2 = makeIdempotencyRequest(key, body);
      const response2 = await withIdempotency(
        req2,
        async () => {
          handlerCallCount++;
          return Response.json(
            { ok: true, data: { id: "biz-789", name: "SHOULD NOT APPEAR" } },
            { status: 201 },
          );
        },
        { operation: TEST_OPERATION, workspaceId: testWorkspaceId },
      );

      // Handler was NOT called again
      expect(handlerCallCount).toBe(1);

      // Response is the replayed original
      expect(response2.status).toBe(response1.status);
      const json2 = await response2.json();
      expect(json2).toEqual(json1);
    });

    it("same key + different payload returns 409 IDEMPOTENCY_KEY_REUSED", async () => {
      const key = crypto.randomUUID();
      const bodyA = { name: "First Corp", website: "https://first.example.com" };
      const bodyB = { name: "Second Corp", website: "https://second.example.com" };

      // First call — succeeds
      const req1 = makeIdempotencyRequest(key, bodyA);
      const response1 = await withIdempotency(
        req1,
        async () => {
          return Response.json(
            { ok: true, data: { id: "biz-aaa" } },
            { status: 201 },
          );
        },
        { operation: TEST_OPERATION, workspaceId: testWorkspaceId },
      );
      expect(response1.status).toBe(201);

      // Second call — same key, different payload → 409
      const req2 = makeIdempotencyRequest(key, bodyB);
      const response2 = await withIdempotency(
        req2,
        async () => {
          return Response.json(
            { ok: true, data: { id: "biz-bbb" } },
            { status: 201 },
          );
        },
        { operation: TEST_OPERATION, workspaceId: testWorkspaceId },
      );

      expect(response2.status).toBe(409);
      const json = await response2.json();
      expect(json.error.code).toBe("IDEMPOTENCY_KEY_REUSED");
    });
  },
);
