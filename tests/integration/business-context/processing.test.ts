import { describe, expect, it } from "vitest";
import {
  canRun,
  getClient,
  track,
  cleanup,
  TEST_WORKSPACE,
  TEST_BUSINESS,
} from "./supabase-helpers";

// ── Jobs ───────────────────────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — context_jobs", () => {
  it("creates and reads a context job", async () => {
    const client = getClient();
    const jobId = crypto.randomUUID();
    track("context_jobs", jobId);

    const { error: insertError } = await client.from("context_jobs").insert({
      id: jobId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      job_type: "crawl_website",
      status: "queued",
      attempt_count: 0,
      max_attempts: 4,
      idempotency_key: `test-${jobId}`,
      input: { url: "https://example.com" },
      retry_policy: {},
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    expect(readError).toBeNull();
    expect(data!.job_type).toBe("crawl_website");
    expect(data!.status).toBe("queued");

    await cleanup("context_jobs", jobId);
  });
});

// ── Processing runs ────────────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — context_processing_runs", () => {
  it("creates and reads a processing run", async () => {
    const client = getClient();
    const sourceId = crypto.randomUUID();
    track("context_sources", sourceId);
    await client.from("context_sources").insert({
      id: sourceId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_type: "website",
      source_name: "Test Source",
      status: "registered",
      metadata: {},
      collected_at: new Date().toISOString(),
    });

    const runId = crypto.randomUUID();
    track("context_processing_runs", runId);

    const { error: insertError } = await client
      .from("context_processing_runs")
      .insert({
        id: runId,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        source_id: sourceId,
        pipeline_type: "website",
        status: "running",
        current_stage: "acquiring",
        started_at: new Date().toISOString(),
      });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_processing_runs")
      .select("*")
      .eq("id", runId)
      .single();

    expect(readError).toBeNull();
    expect(data!.pipeline_type).toBe("website");
    expect(data!.status).toBe("running");

    await cleanup("context_processing_runs", runId);
    await cleanup("context_sources", sourceId);
  });
});

// ── Stage events ───────────────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — context_processing_stage_events", () => {
  it("creates and reads a stage event", async () => {
    const client = getClient();
    const sourceId = crypto.randomUUID();
    track("context_sources", sourceId);
    await client.from("context_sources").insert({
      id: sourceId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_type: "website",
      source_name: "Test Source",
      status: "registered",
      metadata: {},
      collected_at: new Date().toISOString(),
    });

    const runId = crypto.randomUUID();
    track("context_processing_runs", runId);
    await client.from("context_processing_runs").insert({
      id: runId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_id: sourceId,
      pipeline_type: "website",
      status: "running",
      current_stage: "acquiring",
      started_at: new Date().toISOString(),
    });

    const eventId = crypto.randomUUID();
    track("context_processing_stage_events", eventId);

    const { error: insertError } = await client
      .from("context_processing_stage_events")
      .insert({
        id: eventId,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        run_id: runId,
        source_id: sourceId,
        stage: "acquiring",
        status: "started",
        attempt: 1,
        started_at: new Date().toISOString(),
      });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_processing_stage_events")
      .select("*")
      .eq("id", eventId)
      .single();

    expect(readError).toBeNull();
    expect(data!.stage).toBe("acquiring");
    expect(data!.status).toBe("started");

    await cleanup("context_processing_stage_events", eventId);
    await cleanup("context_processing_runs", runId);
    await cleanup("context_sources", sourceId);
  });
});
