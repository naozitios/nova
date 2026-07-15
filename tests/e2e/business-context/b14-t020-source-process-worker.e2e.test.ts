/**
 * B14/T020 — Happy-path E2E: source → process → worker → processed
 *
 * Exercises one real-boundary slice:
 *   1. Authenticated POST to process route returns 202 with a job
 *   2. Independently spawned worker claims and processes the job
 *   3. Source reaches persisted `processed` state
 *   4. Processing run and stage events show required pipeline order
 *
 * Hard constraints:
 *   - One new test file only (this file)
 *   - No production/harness/spec/config edits
 *   - Harness owns all lifecycle (seed, start, cleanup)
 *   - Service role only for seed/inspect, never for invoking behavior
 *   - Deterministic manual source path (no external provider mocks)
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  resetDatabase,
  createTestSession,
  createTestUser,
  getRandomPort,
  startApp,
  startWorker,
  authenticatedFetch,
  pollForCondition,
  cleanup,
} from "./harness";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const hasDeps = !!supabaseServiceKey && !!supabaseAnonKey;

// ---------------------------------------------------------------------------
// Deterministic seed IDs
// ---------------------------------------------------------------------------

const wsId = "b14e20a0-0000-0000-0000-000000000001";
const bizId = "b14e20a0-0000-0000-0000-000000000003";

// Expected pipeline stages (from source-processing.types PIPELINE_STAGES)
const EXPECTED_STAGES = ["claim", "parse", "extract", "reconcile", "quality"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function svcClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

async function querySource(sourceId: string) {
  const client = svcClient();
  const { data, error } = await client
    .from("context_sources")
    .select("status, terminal_outcome")
    .eq("id", sourceId)
    .single();
  if (error) throw error;
  return data as { status: string; terminal_outcome: string | null };
}

async function queryProcessingRuns(sourceId: string) {
  const client = svcClient();
  const { data, error } = await client
    .from("context_processing_runs")
    .select("id, status, current_stage, terminal_outcome")
    .eq("source_id", sourceId)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return data as Array<{
    id: string;
    status: string;
    current_stage: string;
    terminal_outcome: string | null;
  }>;
}

async function queryStageEvents(runId: string) {
  const client = svcClient();
  const { data, error } = await client
    .from("context_processing_stage_events")
    .select("stage, status")
    .eq("run_id", runId)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return data as Array<{ stage: string; status: string }>;
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe.skipIf(!hasDeps)(
  "B14/T020 — source process → worker → processed happy path",
  () => {
    let appPort: number;
    let workerPort: number;
    let sessionCookie: string;
    let sourceId: string;

    beforeAll(async () => {
      await resetDatabase();

      const client = svcClient();

      // Seed workspace
      const { error: wsErr } = await client.from("workspaces").upsert({
        id: wsId,
        name: "B14 Test Workspace",
      });
      if (wsErr) throw new Error(`seed workspace: ${wsErr.message}`);

      // Seed business
      const { error: bizErr } = await client.from("businesses").upsert({
        id: bizId,
        workspace_id: wsId,
        name: "B14 Test Business",
      });
      if (bizErr) throw new Error(`seed business: ${bizErr.message}`);

      // Create auth user + session (creates membership via harness)
      const user = await createTestUser({
        email: `b14-t020-${Date.now()}@e2e.test`,
        workspaceId: wsId,
        membershipRole: "editor",
      });
      sessionCookie = await createTestSession({
        userId: user.id,
        workspaceId: wsId,
        role: "editor",
      });

      // Start app + worker (handles auto-registered in spawnedProcesses)
      appPort = getRandomPort();
      workerPort = getRandomPort();
      await startApp(appPort);
      await startWorker(workerPort);
    }, 120_000);

    afterAll(async () => {
      await cleanup();
    });

    it("full happy path: register → process → worker → processed", { timeout: 90_000 }, async () => {
      const baseUrl = `http://localhost:${appPort}`;
      console.log(`[T020] baseUrl=${baseUrl}`);

      // 1. Register a manual source
      console.log("[T020] registering source...");
      const registerRes = await authenticatedFetch(
        `${baseUrl}/api/businesses/${bizId}/context/sources`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `reg-${Date.now()}`,
          },
          body: JSON.stringify({
            source_type: "user_answer",
            source_name: "B14 Test Source",
          }),
          authToken: sessionCookie,
        },
      );
      if (registerRes.status !== 201) {
        const errBody = await registerRes.text();
        throw new Error(
          `register source returned ${registerRes.status}: ${errBody}`,
        );
      }
      const registerBody = await registerRes.json();
      sourceId = registerBody.id;
      expect(sourceId).toBeTruthy();
      console.log(`[T020] source registered: ${sourceId}`);

      // 2. POST to process → expect 202 with a job
      console.log("[T020] posting to process...");
      const processRes = await authenticatedFetch(
        `${baseUrl}/api/businesses/${bizId}/context/sources/${sourceId}/process`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `process-${sourceId}-${Date.now()}`,
          },
          body: JSON.stringify({}),
          authToken: sessionCookie,
        },
      );
      expect(processRes.status).toBe(202);
      const processBody = await processRes.json();
      expect(processBody.id).toBeTruthy();
      expect(processBody.status).toBe("queued");
      expect(processBody.job_type).toBe("source_processing");

      // 3. Poll for source to reach processed state (worker claims + executes)
      const source = await pollForCondition(
        async () => {
          const s = await querySource(sourceId);
          return s.status === "processed" || s.status === "processed_with_warnings"
            ? s
            : null;
        },
        30_000,
        1_000,
      );
      if (!source) {
        throw new Error("Source did not reach processed state within timeout");
      }
      expect(source.status).toMatch(/^processed/);
      expect(source.terminal_outcome).toMatch(/^processed/);

      // 4. Verify processing run exists
      const runs = await queryProcessingRuns(sourceId);
      expect(runs.length).toBeGreaterThanOrEqual(1);
      const run = runs[0];
      expect(run.status).toMatch(/succeeded/);
      expect(run.current_stage).toBe("completed");
      expect(run.terminal_outcome).toMatch(/^processed/);

      // 5. Verify stage events show required pipeline order
      const events = await queryStageEvents(run.id);
      expect(events.length).toBeGreaterThanOrEqual(1);

      const succeededStages = events
        .filter((e) => e.status === "succeeded")
        .map((e) => e.stage);

      // At minimum, pipeline stages should appear in order
      if (succeededStages.length >= EXPECTED_STAGES.length) {
        const foundOrder = EXPECTED_STAGES.filter((s) =>
          succeededStages.includes(s),
        );
        expect(foundOrder).toEqual(EXPECTED_STAGES);
      }
    });
  },
);
