import { describe, expect, it, afterAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// T091 — Extraction pipeline integration tests
// Covers FR-018 (schema-constrained extraction), FR-020 (fact persistence
// with source excerpts), FR-045 (fact quality gates), FR-043 (processing
// visibility with counters).
//
// Uses local Supabase; tests verify extraction job lifecycle, fact
// persistence, quality gate results, and counter tracking.
// ---------------------------------------------------------------------------

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

let client: SupabaseClient | null = null;

const TEST_WORKSPACE = "30000000-0000-0000-0000-000000000001";
const TEST_BUSINESS = "30000000-0000-0000-0000-000000000002";
const TEST_SOURCE = "30000000-0000-0000-0000-000000000003";
const TEST_SOURCE_DOC = "30000000-0000-0000-0000-000000000004";

const createdIds: { table: string; id: string }[] = [];

afterAll(async () => {
  if (!client) return;
  for (const { table, id } of [...createdIds].reverse()) {
    await client.from(table).delete().eq("id", id);
  }
});

function track(table: string, id: string) {
  createdIds.push({ table, id });
}

async function insertJob(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  track("context_jobs", id);
  const { error } = await client.from("context_jobs").insert({
    id,
    workspace_id: TEST_WORKSPACE,
    business_id: TEST_BUSINESS,
    job_type: "extract_facts",
    status: "running",
    attempt_count: 1,
    max_attempts: 4,
    idempotency_key: `t091-${id}`,
    input: {
      sourceDocumentId: TEST_SOURCE_DOC,
      sourceId: TEST_SOURCE,
      businessId: TEST_BUSINESS,
      contentText: "Acme Corp sells Widget Pro at $49.99. Targeted at marketing directors.",
      sourceType: "website",
      parserName: "firecrawl",
    },
    retry_policy: {},
    ...overrides,
  });
  if (error) throw error;
  return id;
}

async function readJob(id: string) {
  const { data, error } = await client
    .from("context_jobs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

async function insertFact(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  track("context_facts", id);
  const { error } = await client.from("context_facts").insert({
    id,
    workspace_id: TEST_WORKSPACE,
    business_id: TEST_BUSINESS,
    fact_key: "offers.primary",
    value: { name: "Widget Pro", price: 49.99 },
    source_id: TEST_SOURCE,
    source_document_id: TEST_SOURCE_DOC,
    source_excerpt: "Widget Pro retails at $49.99",
    confidence: 0.88,
    verification_status: "extracted",
    valid_from: new Date().toISOString(),
    created_by: "extraction-worker",
    ...overrides,
  });
  if (error) throw error;
  return id;
}

async function insertProcessingRun(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  track("context_processing_runs", id);
  const { error } = await client.from("context_processing_runs").insert({
    id,
    workspace_id: TEST_WORKSPACE,
    business_id: TEST_BUSINESS,
    source_id: TEST_SOURCE,
    pipeline_type: "website",
    status: "running",
    current_stage: "extracting",
    attempt_count: 1,
    pages_processed: 0,
    slides_processed: 0,
    documents_created: 0,
    facts_extracted: 0,
    warnings_count: 0,
    credits_consumed: 0,
    quality_summary: {},
    started_at: new Date().toISOString(),
    ...overrides,
  });
  if (error) throw error;
  return id;
}

async function insertStageEvent(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  track("context_processing_stage_events", id);
  const { error } = await client.from("context_processing_stage_events").insert({
    id,
    workspace_id: TEST_WORKSPACE,
    business_id: TEST_BUSINESS,
    run_id: overrides.run_id ?? "30000000-0000-0000-0000-000000000099",
    source_id: TEST_SOURCE,
    stage: "extracting",
    status: "started",
    attempt: 1,
    started_at: new Date().toISOString(),
    pages_processed: 0,
    slides_processed: 0,
    bytes_processed: 0,
    documents_created: 0,
    facts_extracted: 0,
    warnings_count: 0,
    credits_consumed: 0,
    metadata: {},
    ...overrides,
  });
  if (error) throw error;
  return id;
}

async function insertQualityGate(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  track("context_quality_gate_results", id);
  const { error } = await client.from("context_quality_gate_results").insert({
    id,
    workspace_id: TEST_WORKSPACE,
    business_id: TEST_BUSINESS,
    gate_scope: "fact",
    gate_name: "confidence_threshold",
    status: "passed",
    ...overrides,
  });
  if (error) throw error;
  return id;
}

// ═══════════════════════════════════════════════════════════════════════════
// Concurrent extraction task outputs
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Extraction pipeline — concurrent extraction tasks",
  () => {
    it("multiple extraction jobs can run concurrently", async () => {
      const job1 = await insertJob({
        idempotency_key: `t091-concurrent-1-${crypto.randomUUID()}`,
      });
      const job2 = await insertJob({
        idempotency_key: `t091-concurrent-2-${crypto.randomUUID()}`,
      });

      const [j1, j2] = await Promise.all([readJob(job1), readJob(job2)]);
      expect(j1.status).toBe("running");
      expect(j2.status).toBe("running");
      expect(j1.id).not.toBe(j2.id);
    });

    it("each job tracks its own attempt count", async () => {
      const job1 = await insertJob({
        attempt_count: 1,
        idempotency_key: `t091-attempt-1-${crypto.randomUUID()}`,
      });
      const job2 = await insertJob({
        attempt_count: 2,
        idempotency_key: `t091-attempt-2-${crypto.randomUUID()}`,
      });

      const [j1, j2] = await Promise.all([readJob(job1), readJob(job2)]);
      expect(j1.attempt_count).toBe(1);
      expect(j2.attempt_count).toBe(2);
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Persisted facts with source excerpts
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Extraction pipeline — persisted facts with source excerpts",
  () => {
    it("fact stores source excerpt and evidence locator", async () => {
      const factId = await insertFact({
        fact_key: "offers.primary",
        value: { name: "Widget Pro", price: 49.99 },
        source_excerpt: "Widget Pro retails at $49.99",
        evidence_locator: { url: "https://acme.example.com/products", page: 1 },
        confidence: 0.88,
        verification_status: "extracted",
      });

      const { data } = await client
        .from("context_facts")
        .select("*")
        .eq("id", factId)
        .single();

      expect(data).toBeTruthy();
      expect(data.fact_key).toBe("offers.primary");
      expect(data.source_excerpt).toBe("Widget Pro retails at $49.99");
      expect(data.evidence_locator).toEqual({
        url: "https://acme.example.com/products",
        page: 1,
      });
      expect(data.confidence).toBe(0.88);
      expect(data.verification_status).toBe("extracted");
      expect(data.source_id).toBe(TEST_SOURCE);
      expect(data.source_document_id).toBe(TEST_SOURCE_DOC);
    });

    it("fact links to source document and source", async () => {
      const factId = await insertFact({
        source_id: TEST_SOURCE,
        source_document_id: TEST_SOURCE_DOC,
      });

      const { data } = await client
        .from("context_facts")
        .select("source_id, source_document_id")
        .eq("id", factId)
        .single();

      expect(data.source_id).toBe(TEST_SOURCE);
      expect(data.source_document_id).toBe(TEST_SOURCE_DOC);
    });

    it("fact preserves validity period", async () => {
      const validFrom = new Date("2026-01-01").toISOString();
      const validTo = new Date("2026-12-31").toISOString();

      const factId = await insertFact({
        valid_from: validFrom,
        valid_to: validTo,
      });

      const { data } = await client
        .from("context_facts")
        .select("valid_from, valid_to")
        .eq("id", factId)
        .single();

      expect(data.valid_from).toBeTruthy();
      expect(data.valid_to).toBeTruthy();
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Fact quality gate results
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Extraction pipeline — fact quality gate results",
  () => {
    it("quality gate records pass/warn/fail for fact validation", async () => {
      const gateId = await insertQualityGate({
        gate_scope: "fact",
        gate_name: "confidence_threshold",
        status: "passed",
        measured_value: { value: 0.88, unit: "ratio" },
        threshold: { value: 0.7, unit: "ratio" },
        reason: null,
      });

      const { data } = await client
        .from("context_quality_gate_results")
        .select("*")
        .eq("id", gateId)
        .single();

      expect(data.gate_scope).toBe("fact");
      expect(data.gate_name).toBe("confidence_threshold");
      expect(data.status).toBe("passed");
      expect(data.measured_value).toEqual({ value: 0.88, unit: "ratio" });
    });

    it("quality gate records warning for low confidence", async () => {
      const gateId = await insertQualityGate({
        gate_scope: "fact",
        gate_name: "confidence_threshold",
        status: "warning",
        measured_value: { value: 0.55, unit: "ratio" },
        threshold: { value: 0.7, unit: "ratio" },
        reason: "Confidence below recommended threshold",
      });

      const { data } = await client
        .from("context_quality_gate_results")
        .select("*")
        .eq("id", gateId)
        .single();

      expect(data.status).toBe("warning");
      expect(data.reason).toContain("below recommended");
    });

    it("quality gate records blocking failure", async () => {
      const gateId = await insertQualityGate({
        gate_scope: "fact",
        gate_name: "schema_validity",
        status: "failed_blocking",
        measured_value: null,
        threshold: null,
        reason: "Fact value does not conform to Zod schema",
      });

      const { data } = await client
        .from("context_quality_gate_results")
        .select("*")
        .eq("id", gateId)
        .single();

      expect(data.status).toBe("failed_blocking");
      expect(data.reason).toContain("Zod schema");
    });

    it("document gate records page coverage", async () => {
      const gateId = await insertQualityGate({
        run_id: null,
        source_id: null,
        source_document_id: TEST_SOURCE_DOC,
        fact_id: null,
        gate_scope: "document",
        gate_name: "page_coverage",
        status: "passed",
        measured_value: { processed: 10, total: 10, ratio: 1.0 },
        threshold: { ratio: 0.9 },
        reason: null,
      });

      const { data } = await client
        .from("context_quality_gate_results")
        .select("*")
        .eq("id", gateId)
        .single();

      expect(data.gate_scope).toBe("document");
      expect(data.gate_name).toBe("page_coverage");
      expect(data.status).toBe("passed");
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Facts extracted counter / warnings generated counter
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Extraction pipeline — counter tracking",
  () => {
    it("processing run tracks facts_extracted counter", async () => {
      const runId = await insertProcessingRun({
        facts_extracted: 0,
      });

      // Simulate extraction completing
      await client
        .from("context_processing_runs")
        .update({ facts_extracted: 12 })
        .eq("id", runId);

      const { data } = await client
        .from("context_processing_runs")
        .select("facts_extracted")
        .eq("id", runId)
        .single();

      expect(data.facts_extracted).toBe(12);
    });

    it("processing run tracks warnings_count counter", async () => {
      const runId = await insertProcessingRun({
        warnings_count: 0,
      });

      await client
        .from("context_processing_runs")
        .update({ warnings_count: 3 })
        .eq("id", runId);

      const { data } = await client
        .from("context_processing_runs")
        .select("warnings_count")
        .eq("id", runId)
        .single();

      expect(data.warnings_count).toBe(3);
    });

    it("stage event tracks per-stage facts_extracted and warnings_count", async () => {
      const runId = await insertProcessingRun();
      const eventId = await insertStageEvent({
        run_id: runId,
        stage: "extracting",
        status: "succeeded",
        facts_extracted: 8,
        warnings_count: 1,
      });

      const { data } = await client
        .from("context_processing_stage_events")
        .select("facts_extracted, warnings_count")
        .eq("id", eventId)
        .single();

      expect(data.facts_extracted).toBe(8);
      expect(data.warnings_count).toBe(1);
    });

    it("processing run tracks documents_created counter", async () => {
      const runId = await insertProcessingRun({
        documents_created: 0,
      });

      await client
        .from("context_processing_runs")
        .update({ documents_created: 3 })
        .eq("id", runId);

      const { data } = await client
        .from("context_processing_runs")
        .select("documents_created")
        .eq("id", runId)
        .single();

      expect(data.documents_created).toBe(3);
    });
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Failure classes
// ═══════════════════════════════════════════════════════════════════════════

describe.skipIf(!supabaseServiceKey)(
  "Extraction pipeline — failure classes",
  () => {
    it("job records error_class for schema contract failure", async () => {
      const jobId = await insertJob();
      await client
        .from("context_jobs")
        .update({
          status: "failed_permanent",
          error_class: "schema_contract",
          error: {
            code: "SCHEMA_CONTRACT",
            message: "LLM output violates extraction schema after repair",
          },
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      const job = await readJob(jobId);
      expect(job.status).toBe("failed_permanent");
      expect(job.error_class).toBe("schema_contract");
    });

    it("job records error_class for provider timeout", async () => {
      const jobId = await insertJob();
      await client
        .from("context_jobs")
        .update({
          status: "failed_retryable",
          error_class: "provider_timeout",
          error: {
            code: "PROVIDER_TIMEOUT",
            message: "LLM provider timed out",
          },
        })
        .eq("id", jobId);

      const job = await readJob(jobId);
      expect(job.status).toBe("failed_retryable");
      expect(job.error_class).toBe("provider_timeout");
    });

    it("stage event records error_class for failed extraction", async () => {
      const runId = await insertProcessingRun();
      const eventId = await insertStageEvent({
        run_id: runId,
        stage: "extracting",
        status: "failed_permanent",
        error_class: "schema_contract",
        error: {
          code: "SCHEMA_CONTRACT",
          message: "Extraction output failed validation",
        },
      });

      const { data } = await client
        .from("context_processing_stage_events")
        .select("error_class, error")
        .eq("id", eventId)
        .single();

      expect(data.error_class).toBe("schema_contract");
      expect(data.error.code).toBe("SCHEMA_CONTRACT");
    });
  },
);
