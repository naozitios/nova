/**
 * B14a — Two-worker race E2E: 100 sources, 2 workers, no duplicates
 *
 * Exercises concurrent worker contention:
 *   1. Seed workspace + business via service role
 *   2. Create auth user + session via harness
 *   3. Start app + 2 independently spawned workers
 *   4. Register 100 manual user_answer sources via authenticated POST
 *   5. Queue each source for processing with unique idempotency keys
 *   6. Poll all source jobs to terminal state
 *   7. Assert exactly 100 outer source_processing jobs (no duplicates)
 *   8. Assert all completed jobs have null locked_by/locked_at/heartbeat_at
 *   9. Clean afterAll at describe scope
 *
 * Hard constraints:
 *   - One new test file only (this file)
 *   - No production/harness/spec/config edits
 *   - Harness owns all lifecycle (seed, start, cleanup)
 *   - Service role only for seed/inspect, never for invoking behavior
 *   - Deterministic IDs + timestamp filtering for assertion scoping
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
// Deterministic seed IDs (unique to this test to avoid collision with other tests)
// ---------------------------------------------------------------------------

const wsId = "b14a2000-0000-0000-0000-000000000001";
const bizId = "b14a2000-0000-0000-0000-000000000003";
const SOURCE_COUNT = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function svcClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe.skipIf(!hasDeps)(
  "B14a — two-worker race: 100 sources, no duplicates, locks released",
  () => {
    let appPort: number;
    let worker1Port: number;
    let worker2Port: number;
    let sessionCookie: string;
    let testCreatedBefore: string; // ISO timestamp before test creates begin

    // Track all source IDs created by this test for assertion scoping
    const createdSourceIds: string[] = [];

    beforeAll(async () => {
      await resetDatabase();

      const client = svcClient();

      // Seed workspace
      const { error: wsErr } = await client.from("workspaces").upsert({
        id: wsId,
        name: "B14a Two-Worker Race Workspace",
      });
      if (wsErr) throw new Error(`seed workspace: ${wsErr.message}`);

      // Seed business
      const { error: bizErr } = await client.from("businesses").upsert({
        id: bizId,
        workspace_id: wsId,
        name: "B14a Two-Worker Race Business",
      });
      if (bizErr) throw new Error(`seed business: ${bizErr.message}`);

      // Create auth user + session (creates membership via harness)
      const user = await createTestUser({
        email: `b14a-two-worker-${Date.now()}@e2e.test`,
        workspaceId: wsId,
        membershipRole: "editor",
      });
      sessionCookie = await createTestSession({
        userId: user.id,
        workspaceId: wsId,
        role: "editor",
      });

      // Start app + 2 workers (both registered in spawnedProcesses for cleanup)
      appPort = getRandomPort();
      worker1Port = getRandomPort();
      worker2Port = getRandomPort();
      await startApp(appPort);
      await startWorker(worker1Port);
      await startWorker(worker2Port);

      // Mark timestamp before source creation begins
      testCreatedBefore = new Date().toISOString();
    }, 120_000);

    afterAll(async () => {
      await cleanup();
    });

    it(
      "100 sources processed by 2 workers, no duplicates, locks released",
      { timeout: 120_000 },
      async () => {
        const baseUrl = `http://localhost:${appPort}`;

        // ── Phase 1: Register 100 sources ────────────────────────────────
        console.log(`[B14a] registering ${SOURCE_COUNT} sources...`);

        for (let i = 0; i < SOURCE_COUNT; i++) {
          const registerRes = await authenticatedFetch(
            `${baseUrl}/api/businesses/${bizId}/context/sources`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": `b14a-reg-${i}-${Date.now()}`,
              },
              body: JSON.stringify({
                source_type: "user_answer",
                source_name: `B14a Race Source ${i}`,
              }),
              authToken: sessionCookie,
            },
          );
          if (registerRes.status !== 201) {
            const errBody = await registerRes.text();
            throw new Error(
              `register source ${i} returned ${registerRes.status}: ${errBody}`,
            );
          }
          const { id } = await registerRes.json();
          createdSourceIds.push(id);
        }

        console.log(`[B14a] registered ${createdSourceIds.length} sources`);

        // ── Phase 2: Queue all sources for processing ─────────────────────
        console.log(`[B14a] queueing processing for ${SOURCE_COUNT} sources...`);

        const queuedJobIds: string[] = [];

        for (let i = 0; i < SOURCE_COUNT; i++) {
          const sourceId = createdSourceIds[i];
          const processRes = await authenticatedFetch(
            `${baseUrl}/api/businesses/${bizId}/context/sources/${sourceId}/process`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": `b14a-proc-${i}-${Date.now()}`,
              },
              body: JSON.stringify({}),
              authToken: sessionCookie,
            },
          );
          if (processRes.status !== 202) {
            const errBody = await processRes.text();
            throw new Error(
              `process source ${i} returned ${processRes.status}: ${errBody}`,
            );
          }
          const body = await processRes.json();
          expect(body.status).toBe("queued");
          expect(body.job_type).toBe("source_processing");
          queuedJobIds.push(body.id);
        }

        console.log(`[B14a] queued ${queuedJobIds.length} jobs`);

        // ── Phase 3: Poll all sources to terminal state ───────────────────
        console.log(`[B14a] polling all ${SOURCE_COUNT} sources for terminal state...`);

        const terminalStatuses = new Set([
          "processed",
          "processed_with_warnings",
          "failed_permanent",
          "blocked_needs_user_action",
        ]);

        let terminalCount = 0;
        const pollDeadline = Date.now() + 90_000;

        while (terminalCount < SOURCE_COUNT && Date.now() < pollDeadline) {
          const client = svcClient();
          const { data: sources } = await client
            .from("context_sources")
            .select("id, status")
            .in("id", createdSourceIds);

          terminalCount = (sources ?? []).filter((s) =>
            terminalStatuses.has(s.status),
          ).length;

          console.log(`[B14a] ${terminalCount}/${SOURCE_COUNT} terminal`);

          if (terminalCount < SOURCE_COUNT) {
            await new Promise((r) => setTimeout(r, 1_000));
          }
        }

        expect(terminalCount).toBe(SOURCE_COUNT);
        console.log(`[B14a] all ${SOURCE_COUNT} sources reached terminal state`);

        // ── Phase 4: Assert exactly 100 outer source_processing jobs ──────
        const client = svcClient();
        const { data: jobs, error: jobsErr } = await client
          .from("context_jobs")
          .select("id, input, status, locked_by, locked_at, heartbeat_at")
          .eq("job_type", "source_processing")
          .eq("workspace_id", wsId)
          .eq("business_id", bizId)
          .gte("created_at", testCreatedBefore);

        if (jobsErr) throw jobsErr;

        // Filter to only jobs whose ID is one we queued
        // (excludes any stale jobs from prior test runs)
        const matchingJobs = (jobs ?? []).filter(
          (j: { id: string }) => queuedJobIds.includes(j.id),
        );

        // Exactly 100 outer jobs — no duplicates
        expect(matchingJobs.length).toBe(SOURCE_COUNT);

        // No duplicate jobs per source: extract sourceId from input JSON
        const sourceIdsFromJobs = matchingJobs.map(
          (j: { input: Record<string, unknown> }) => j.input?.sourceId as string,
        );
        const uniqueSourceIds = new Set(sourceIdsFromJobs);
        expect(uniqueSourceIds.size).toBe(SOURCE_COUNT);

        // ── Phase 5: All completed jobs have null lock fields ──────────────
        const succeededJobs = matchingJobs.filter(
          (j: { status: string }) =>
            j.status === "succeeded" || j.status === "completed",
        );
        expect(succeededJobs.length).toBe(SOURCE_COUNT);

        for (const job of succeededJobs) {
          expect(job.locked_by, `job ${job.id} locked_by`).toBeNull();
          expect(job.locked_at, `job ${job.id} locked_at`).toBeNull();
          expect(job.heartbeat_at, `job ${job.id} heartbeat_at`).toBeNull();
        }

        console.log(
          `[B14a] PASS: ${matchingJobs.length} jobs, ${uniqueSourceIds.size} unique sources, ${succeededJobs.length} succeeded, all locks released`,
        );
      },
    );
  },
);
