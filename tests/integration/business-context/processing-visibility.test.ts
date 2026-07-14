import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// T024 — Processing visibility tests
// Verifies that stage events persist duration, attempts, worker ID,
// provider request ID, pages/slides processed, credits consumed,
// facts extracted, warning counts, and sanitized errors.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

const supabase = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

const TEST_WORKSPACE = "20000000-0000-0000-0000-000000000001";
const TEST_BUSINESS = "20000000-0000-0000-0000-000000000002";

// ── Tests ──────────────────────────────────────────────────────────────────

describe.skipIf(!supabaseServiceKey)(
  "Processing visibility — stage event fields",
  () => {
    it("persists all required stage event fields", async () => {
      const runId = crypto.randomUUID();
      const sourceId = crypto.randomUUID();
      const eventId = crypto.randomUUID();

      // Create prerequisite run
      await supabase.from("context_processing_runs").insert({
        id: runId,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        source_id: sourceId,
        pipeline_type: "website",
        status: "running",
        current_stage: "acquiring",
        started_at: new Date().toISOString(),
      });

      // Create stage event with all visibility fields
      const startedAt = new Date("2026-01-15T10:00:00Z");
      const completedAt = new Date("2026-01-15T10:00:30Z");
      const durationMs = completedAt.getTime() - startedAt.getTime();

      const { error: insertError } = await supabase
        .from("context_processing_stage_events")
        .insert({
          id: eventId,
          workspace_id: TEST_WORKSPACE,
          business_id: TEST_BUSINESS,
          run_id: runId,
          source_id: sourceId,
          stage: "acquiring",
          status: "succeeded",
          attempt: 1,
          worker_id: "worker-abc-123",
          provider: "firecrawl",
          provider_request_id: "fc-req-456",
          started_at: startedAt.toISOString(),
          completed_at: completedAt.toISOString(),
          duration_ms: durationMs,
          pages_processed: 5,
          slides_processed: 0,
          bytes_processed: 102400,
          documents_created: 1,
          facts_extracted: 3,
          warnings_count: 1,
          credits_consumed: 0.5,
          error_class: null,
          error: null,
          metadata: { parser: "firecrawl-markdown", mode: "clean" },
        });

      expect(insertError).toBeNull();

      // Read back and verify all fields
      const { data, error: readError } = await supabase
        .from("context_processing_stage_events")
        .select("*")
        .eq("id", eventId)
        .single();

      expect(readError).toBeNull();
      expect(data!.stage).toBe("acquiring");
      expect(data!.status).toBe("succeeded");
      expect(data!.attempt).toBe(1);
      expect(data!.worker_id).toBe("worker-abc-123");
      expect(data!.provider).toBe("firecrawl");
      expect(data!.provider_request_id).toBe("fc-req-456");
      expect(data!.duration_ms).toBe(durationMs);
      expect(data!.pages_processed).toBe(5);
      expect(data!.slides_processed).toBe(0);
      expect(data!.bytes_processed).toBe(102400);
      expect(data!.documents_created).toBe(1);
      expect(data!.facts_extracted).toBe(3);
      expect(data!.warnings_count).toBe(1);
      expect(Number(data!.credits_consumed)).toBeCloseTo(0.5);

      // Cleanup
      await supabase.from("context_processing_stage_events").delete().eq("id", eventId);
      await supabase.from("context_processing_runs").delete().eq("id", runId);
    });

    it("persists sanitized error in stage event", async () => {
      const runId = crypto.randomUUID();
      const sourceId = crypto.randomUUID();
      const eventId = crypto.randomUUID();

      await supabase.from("context_processing_runs").insert({
        id: runId,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        source_id: sourceId,
        pipeline_type: "website",
        status: "running",
        current_stage: "acquiring",
        started_at: new Date().toISOString(),
      });

      const sanitizedError = {
        code: "PROVIDER_TIMEOUT",
        message: "Request to provider timed out",
        details: { timeout_ms: 30000 },
        // Should NOT contain secrets or PII
      };

      const { error: insertError } = await supabase
        .from("context_processing_stage_events")
        .insert({
          id: eventId,
          workspace_id: TEST_WORKSPACE,
          business_id: TEST_BUSINESS,
          run_id: runId,
          source_id: sourceId,
          stage: "acquiring",
          status: "failed_retryable",
          attempt: 2,
          worker_id: "worker-abc-123",
          started_at: new Date().toISOString(),
          error_class: "provider_timeout",
          error: sanitizedError,
        });

      expect(insertError).toBeNull();

      const { data } = await supabase
        .from("context_processing_stage_events")
        .select("error, error_class")
        .eq("id", eventId)
        .single();

      expect(data!.error_class).toBe("provider_timeout");
      expect(data!.error.code).toBe("PROVIDER_TIMEOUT");
      expect(data!.error).not.toMatch(/secret|password|token/i);

      // Cleanup
      await supabase.from("context_processing_stage_events").delete().eq("id", eventId);
      await supabase.from("context_processing_runs").delete().eq("id", runId);
    });
  },
);

describe.skipIf(!supabaseServiceKey)(
  "Processing visibility — run aggregate fields",
  () => {
    it("persists all aggregate counters on processing run", async () => {
      const runId = crypto.randomUUID();
      const sourceId = crypto.randomUUID();

      const { error: insertError } = await supabase
        .from("context_processing_runs")
        .insert({
          id: runId,
          workspace_id: TEST_WORKSPACE,
          business_id: TEST_BUSINESS,
          source_id: sourceId,
          pipeline_type: "upload",
          status: "succeeded_with_warnings",
          current_stage: "completed",
          terminal_outcome: "processed_with_warnings",
          attempt_count: 2,
          pages_processed: 12,
          slides_processed: 8,
          documents_created: 2,
          facts_extracted: 15,
          warnings_count: 3,
          credits_consumed: 1.2,
          quality_summary: {
            document_gates: { passed: 4, warnings: 1, failed: 0 },
            fact_gates: { passed: 10, warnings: 3, failed: 0 },
          },
          started_at: new Date("2026-01-15T10:00:00Z").toISOString(),
          completed_at: new Date("2026-01-15T10:05:30Z").toISOString(),
        });

      expect(insertError).toBeNull();

      const { data, error: readError } = await supabase
        .from("context_processing_runs")
        .select("*")
        .eq("id", runId)
        .single();

      expect(readError).toBeNull();
      expect(data!.pipeline_type).toBe("upload");
      expect(data!.status).toBe("succeeded_with_warnings");
      expect(data!.terminal_outcome).toBe("processed_with_warnings");
      expect(data!.attempt_count).toBe(2);
      expect(data!.pages_processed).toBe(12);
      expect(data!.slides_processed).toBe(8);
      expect(data!.documents_created).toBe(2);
      expect(data!.facts_extracted).toBe(15);
      expect(data!.warnings_count).toBe(3);
      expect(Number(data!.credits_consumed)).toBeCloseTo(1.2);
      expect(data!.quality_summary.document_gates.passed).toBe(4);

      // Cleanup
      await supabase.from("context_processing_runs").delete().eq("id", runId);
    });
  },
);

describe.skipIf(!supabaseServiceKey)(
  "Processing visibility — stage event ordering",
  () => {
    it("returns stage events ordered by started_at for a run", async () => {
      const runId = crypto.randomUUID();
      const sourceId = crypto.randomUUID();

      await supabase.from("context_processing_runs").insert({
        id: runId,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        source_id: sourceId,
        pipeline_type: "website",
        status: "running",
        current_stage: "parsing",
        started_at: new Date().toISOString(),
      });

      const stages = ["acquiring", "stored", "parsing"];
      const eventIds: string[] = [];

      for (let i = 0; i < stages.length; i++) {
        const eventId = crypto.randomUUID();
        eventIds.push(eventId);
        await supabase.from("context_processing_stage_events").insert({
          id: eventId,
          workspace_id: TEST_WORKSPACE,
          business_id: TEST_BUSINESS,
          run_id: runId,
          source_id: sourceId,
          stage: stages[i],
          status: "succeeded",
          attempt: 1,
          started_at: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      const { data, error } = await supabase
        .from("context_processing_stage_events")
        .select("stage, started_at")
        .eq("run_id", runId)
        .order("started_at", { ascending: true });

      expect(error).toBeNull();
      expect(data).toHaveLength(3);
      expect(data![0].stage).toBe("acquiring");
      expect(data![1].stage).toBe("stored");
      expect(data![2].stage).toBe("parsing");

      // Cleanup
      for (const id of eventIds) {
        await supabase.from("context_processing_stage_events").delete().eq("id", id);
      }
      await supabase.from("context_processing_runs").delete().eq("id", runId);
    });
  },
);
