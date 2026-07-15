import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// T021 — Repository contract test scaffold
// Covers source, fact, conflict, profile version, job, processing run,
// stage event, quality gate, circuit breaker, and audit persistence.
// Uses local Supabase; tests define expected CRUD contracts.
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

let client: SupabaseClient | null = null;

const TEST_WORKSPACE = "10000000-0000-0000-0000-000000000001";
const TEST_BUSINESS = "10000000-0000-0000-0000-000000000002";
const TEST_USER = "10000000-0000-0000-0000-000000000010";

const createdIds: { table: string; id: string }[] = [];

beforeAll(() => {
  if (supabaseServiceKey) {
    client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }
});

afterAll(async () => {
  // Cleanup in reverse order of dependencies
  for (const { table, id } of [...createdIds].reverse()) {
    await client.from(table).delete().eq("id", id);
  }
});

async function cleanup(table: string, id: string) {
  await client.from(table).delete().eq("id", id);
  const idx = createdIds.findIndex((r) => r.table === table && r.id === id);
  if (idx >= 0) createdIds.splice(idx, 1);
}

function track(table: string, id: string) {
  createdIds.push({ table, id });
}

// ── Source persistence ─────────────────────────────────────────────────────

describe.skipIf(!supabaseServiceKey)("Repository — context_sources", () => {
  it("creates and reads a context source", async () => {
    const sourceId = crypto.randomUUID();
    track("context_sources", sourceId);

    const { error: insertError } = await client.from("context_sources").insert({
      id: sourceId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_type: "website",
      source_name: "Company Website",
      status: "registered",
      metadata: {},
      collected_at: new Date().toISOString(),
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    expect(readError).toBeNull();
    expect(data).toBeDefined();
    expect(data!.source_type).toBe("website");
    expect(data!.source_name).toBe("Company Website");
    expect(data!.status).toBe("registered");

    await cleanup("context_sources", sourceId);
  });

  it("atomically archives a source — returns row when status != archived", async () => {
    const sourceId = crypto.randomUUID();
    track("context_sources", sourceId);
    await client.from("context_sources").insert({
      id: sourceId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_type: "website",
      source_name: "Archive Test Source",
      status: "processed",
      metadata: {},
      collected_at: new Date().toISOString(),
    });

    const { data, error } = await client
      .from("context_sources")
      .update({ status: "archived", terminal_outcome: "archived" })
      .eq("workspace_id", TEST_WORKSPACE)
      .eq("id", sourceId)
      .neq("status", "archived")
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.status).toBe("archived");

    await cleanup("context_sources", sourceId);
  });

  it("atomic archive returns error when source is already archived", async () => {
    const sourceId = crypto.randomUUID();
    track("context_sources", sourceId);
    await client.from("context_sources").insert({
      id: sourceId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_type: "website",
      source_name: "Already Archived Source",
      status: "archived",
      metadata: {},
      collected_at: new Date().toISOString(),
    });

    const { data, error } = await client
      .from("context_sources")
      .update({ status: "archived", terminal_outcome: "archived" })
      .eq("workspace_id", TEST_WORKSPACE)
      .eq("id", sourceId)
      .neq("status", "archived")
      .select()
      .single();

    // Supabase returns PGRST116 when no rows match the filter
    expect(error).toBeDefined();
    expect(error!.code).toBe("PGRST116");

    await cleanup("context_sources", sourceId);
  });
});

// ── Source documents ───────────────────────────────────────────────────────

describe.skipIf(!supabaseServiceKey)("Repository — source_documents", () => {
  it("creates and reads a source document", async () => {
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

    const docId = crypto.randomUUID();
    track("source_documents", docId);

    const { error: insertError } = await client.from("source_documents").insert({
      id: docId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_id: sourceId,
      url: "https://example.com/page",
      title: "Test Page",
      content_text: "# Test Content",
      content_hash: "sha256:abc123",
      retrieved_at: new Date().toISOString(),
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("source_documents")
      .select("*")
      .eq("id", docId)
      .single();

    expect(readError).toBeNull();
    expect(data!.content_hash).toBe("sha256:abc123");

    await cleanup("source_documents", docId);
    await cleanup("context_sources", sourceId);
  });
});

// ── Facts ──────────────────────────────────────────────────────────────────

describe.skipIf(!supabaseServiceKey)("Repository — context_facts", () => {
  it("creates and reads a context fact", async () => {
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

    const factId = crypto.randomUUID();
    track("context_facts", factId);

    const { error: insertError } = await client.from("context_facts").insert({
      id: factId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      fact_key: "offers.primary.name",
      value: { name: "Test Product" },
      source_id: sourceId,
      confidence: 0.85,
      verification_status: "extracted",
      valid_from: new Date().toISOString(),
      created_by: "system",
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_facts")
      .select("*")
      .eq("id", factId)
      .single();

    expect(readError).toBeNull();
    expect(data!.fact_key).toBe("offers.primary.name");
    expect(Number(data!.confidence)).toBeCloseTo(0.85);

    await cleanup("context_facts", factId);
    await cleanup("context_sources", sourceId);
  });
});

// ── Conflicts ──────────────────────────────────────────────────────────────

describe.skipIf(!supabaseServiceKey)("Repository — context_conflicts", () => {
  it("creates and reads a conflict record", async () => {
    const conflictId = crypto.randomUUID();
    track("context_conflicts", conflictId);

    const { error: insertError } = await client.from("context_conflicts").insert({
      id: conflictId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      fact_key: "offers.primary.price",
      fact_ids: [crypto.randomUUID(), crypto.randomUUID()],
      status: "open",
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_conflicts")
      .select("*")
      .eq("id", conflictId)
      .single();

    expect(readError).toBeNull();
    expect(data!.status).toBe("open");
    expect(data!.fact_ids).toHaveLength(2);

    await cleanup("context_conflicts", conflictId);
  });
});

// ── Profile versions ───────────────────────────────────────────────────────

describe.skipIf(!supabaseServiceKey)("Repository — business_profile_versions", () => {
  it("creates a draft profile version", async () => {
    const versionId = crypto.randomUUID();
    track("business_profile_versions", versionId);

    const { error: insertError } = await client
      .from("business_profile_versions")
      .insert({
        id: versionId,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        version: 1,
        profile: { business: {}, offers: {} },
        status: "draft",
        created_by: TEST_USER,
      });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("business_profile_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    expect(readError).toBeNull();
    expect(data!.version).toBe(1);
    expect(data!.status).toBe("draft");

    await cleanup("business_profile_versions", versionId);
  });
});

// ── Jobs ───────────────────────────────────────────────────────────────────

describe.skipIf(!supabaseServiceKey)("Repository — context_jobs", () => {
  it("creates and reads a context job", async () => {
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

describe.skipIf(!supabaseServiceKey)("Repository — context_processing_runs", () => {
  it("creates and reads a processing run", async () => {
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

describe.skipIf(!supabaseServiceKey)("Repository — context_processing_stage_events", () => {
  it("creates and reads a stage event", async () => {
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

// ── Quality gate results ───────────────────────────────────────────────────

describe.skipIf(!supabaseServiceKey)("Repository — context_quality_gate_results", () => {
  it("creates and reads a quality gate result", async () => {
    const gateId = crypto.randomUUID();
    track("context_quality_gate_results", gateId);

    const { error: insertError } = await client
      .from("context_quality_gate_results")
      .insert({
        id: gateId,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        gate_scope: "document",
        gate_name: "mime_validation",
        status: "passed",
      });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_quality_gate_results")
      .select("*")
      .eq("id", gateId)
      .single();

    expect(readError).toBeNull();
    expect(data!.gate_scope).toBe("document");
    expect(data!.status).toBe("passed");

    await cleanup("context_quality_gate_results", gateId);
  });
});

// ── Circuit breakers ───────────────────────────────────────────────────────

describe.skipIf(!supabaseServiceKey)("Repository — context_provider_circuit_breakers", () => {
  it("creates and reads a circuit breaker record", async () => {
    const cbId = crypto.randomUUID();
    track("context_provider_circuit_breakers", cbId);

    const { error: insertError } = await client
      .from("context_provider_circuit_breakers")
      .insert({
        id: cbId,
        workspace_id: TEST_WORKSPACE,
        provider: "firecrawl",
        state: "closed",
        failure_count: 0,
        success_count: 0,
        timeout_count: 0,
        quota_exhausted: false,
      });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_provider_circuit_breakers")
      .select("*")
      .eq("id", cbId)
      .single();

    expect(readError).toBeNull();
    expect(data!.provider).toBe("firecrawl");
    expect(data!.state).toBe("closed");

    await cleanup("context_provider_circuit_breakers", cbId);
  });
});

// ── Audit log ──────────────────────────────────────────────────────────────

describe.skipIf(!supabaseServiceKey)("Repository — context_audit_log", () => {
  it("creates and reads an audit log entry", async () => {
    const auditId = crypto.randomUUID();
    track("context_audit_log", auditId);

    const { error: insertError } = await client.from("context_audit_log").insert({
      id: auditId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      actor_id: TEST_USER,
      actor_type: "user",
      event_type: "profile.approved",
      entity_type: "business_profile_versions",
      entity_id: crypto.randomUUID(),
      after: { status: "current" },
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_audit_log")
      .select("*")
      .eq("id", auditId)
      .single();

    expect(readError).toBeNull();
    expect(data!.event_type).toBe("profile.approved");
    expect(data!.actor_type).toBe("user");

    await cleanup("context_audit_log", auditId);
  });
});
