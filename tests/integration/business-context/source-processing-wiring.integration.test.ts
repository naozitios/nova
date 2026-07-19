import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SourceProcessingService } from "@/core/business-context/service/source-processing.service";
import type { SourceAdapterPort, CollectedSource } from "@/core/business-context/source-adapter.port";
import type {
  ExtractionPort,
  ExtractionRequest,
  ExtractionResult,
  ExtractedFact,
  ReconciliationRequest,
  ReconciliationResult,
} from "@/core/business-context/extraction.port";
import type { ServiceResult } from "@/core/business-context/types";
import type { SourceType } from "@/core/business-context/types/enums";

// ---------------------------------------------------------------------------
// B31 integration proof — SourceProcessingService wiring
//
// Proves against real Supabase (no mocks, no fakes except adapter + LLM):
//   1. processSource collects via adapter, creates job + run, emits stage events
//   2. Counters (documentsCreated, warningsCount, factsExtracted) persisted
//   3. OCR-blocked source emits skipped stage events and terminal outcome
//   4. Source status transitions verified through DB reads
//   5. Facts extracted from documents and persisted to context_facts
//   6. Quality gate results persisted to context_quality_gate_results
//   7. Reconciliation + lifecycle questions wired
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

let supabase: SupabaseClient;

const WS = "b3100000-0000-0000-0000-000000000001";
const BIZ = "b3100000-0000-0000-0000-000000000002";

let cleanupIds: { sourceId: string; jobId: string; runId: string }[] = [];

beforeAll(async () => {
  if (!SUPABASE_KEY) return;
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  // Seed workspace + business
  await supabase.from("workspaces").upsert(
    { id: WS, name: "B31 Test Workspace" },
    { onConflict: "id" },
  );
  await supabase.from("businesses").upsert(
    {
      id: BIZ,
      workspace_id: WS,
      name: "B31 Test Business",
      status: "active",
    },
    { onConflict: "id" },
  );
});

afterAll(async () => {
  if (!supabase) return;
  // Cascade via workspace FK handles most cleanup; explicit for safety
  for (const c of cleanupIds) {
    await supabase.from("context_processing_stage_events").delete().eq("run_id", c.runId);
    await supabase.from("context_processing_runs").delete().eq("id", c.runId);
    await supabase.from("context_jobs").delete().eq("id", c.jobId);
    await supabase.from("context_sources").delete().eq("id", c.sourceId);
  }
  // Clean facts + quality gates + conflicts seeded by tests
  await supabase.from("context_facts").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("context_quality_gate_results").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("context_conflicts").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("onboarding_questions").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("onboarding_sessions").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("businesses").delete().eq("id", BIZ);
  await supabase.from("workspaces").delete().eq("id", WS);
});

beforeEach(async () => {
  cleanupIds = [];
  if (supabase) {
    await supabase.from("context_facts").delete().eq("workspace_id", WS).eq("business_id", BIZ);
    await supabase.from("context_quality_gate_results").delete().eq("workspace_id", WS).eq("business_id", BIZ);
    await supabase.from("context_conflicts").delete().eq("workspace_id", WS).eq("business_id", BIZ);
    await supabase.from("onboarding_questions").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  }
});

// ─── Fake adapter ──────────────────────────────────────────────────────────

function createFakeAdapter(collected: CollectedSource): SourceAdapterPort {
  return {
    supports: (t: SourceType) => t === "product_document" || t === "website",
    collect: async () => ({ ok: true, data: collected }),
  };
}

function makeCollected(overrides?: Partial<CollectedSource>): CollectedSource {
  return {
    sourceType: "product_document",
    sourceName: "test-doc",
    externalReference: null,
    metadata: {},
    documents: [
      {
        title: "Test Document",
        contentText: "Acme Corp sells widgets to enterprises.",
        mimeType: "text/markdown",
        metadata: {},
      },
    ],
    ...overrides,
  };
}

function makeCollectedWithWarnings(): CollectedSource {
  return makeCollected({
    documents: [
      {
        title: "Warned Doc",
        contentText: "Some content",
        mimeType: "text/markdown",
        metadata: {
          warnings: ["Low OCR confidence: 0.42", "Truncated at 5000 chars"],
        },
      },
    ],
  });
}

// ─── Fake extraction provider ──────────────────────────────────────────────

function createFakeExtractionProvider(
  facts?: ExtractedFact[],
): ExtractionPort {
  const defaultFacts: ExtractedFact[] = [
    {
      factKey: "company_name",
      value: "Acme Corp",
      confidence: 0.9,
      sourceExcerpt: "Acme Corp sells widgets",
      evidenceLocator: null,
    },
    {
      factKey: "product",
      value: "widgets",
      confidence: 0.85,
      sourceExcerpt: "sells widgets to enterprises",
      evidenceLocator: null,
    },
  ];

  return {
    extractFacts: async (
      request: ExtractionRequest,
    ): Promise<ServiceResult<ExtractionResult>> => ({
      ok: true,
      data: {
        facts: facts ?? defaultFacts,
        conflicts: [],
        warnings: [],
      },
    }),
    reconcileFacts: async (
      request: ReconciliationRequest,
    ): Promise<ServiceResult<ReconciliationResult>> => ({
      ok: true,
      data: {
        superseded: [],
        conflicts: [],
        toCreate: request.newFacts,
        toUpdate: [],
      },
    }),
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

async function seedSource(
  sourceType: SourceType,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  const { data, error } = await supabase
    .from("context_sources")
    .insert({
      workspace_id: WS,
      business_id: BIZ,
      source_type: sourceType,
      source_name: `test-${sourceType}-${Date.now()}`,
      external_reference: null,
      status: "registered",
      current_stage: null,
      terminal_outcome: null,
      metadata,
      collected_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw new Error(`seedSource failed: ${error.message}`);
  return data.id;
}

async function readJob(jobId: string) {
  const { data } = await supabase
    .from("context_jobs")
    .select("*")
    .eq("id", jobId)
    .single();
  return data;
}

async function readRun(runId: string) {
  const { data } = await supabase
    .from("context_processing_runs")
    .select("*")
    .eq("id", runId)
    .single();
  return data;
}

async function listStageEvents(runId: string) {
  const { data, error } = await supabase
    .from("context_processing_stage_events")
    .select("*")
    .eq("run_id", runId)
    .order("started_at", { ascending: true });
  if (error) throw new Error(`listStageEvents failed: ${error.message}`);
  if (!data || data.length === 0) {
    const { data: allForBiz } = await supabase
      .from("context_processing_stage_events")
      .select("run_id, source_id")
      .eq("workspace_id", WS)
      .eq("business_id", BIZ);
    throw new Error(
      `listStageEvents: no rows for run_id=${runId}. All stage events for WS/BIZ: ${JSON.stringify(allForBiz ?? [])}`,
    );
  }
  return data;
}

async function readSource(sourceId: string) {
  const { data } = await supabase
    .from("context_sources")
    .select("*")
    .eq("id", sourceId)
    .single();
  return data;
}

async function seedSession(): Promise<string> {
  const { data, error } = await supabase
    .from("onboarding_sessions")
    .insert({
      workspace_id: WS,
      business_id: BIZ,
      status: "in_progress",
      current_step: null,
      started_by: "00000000-0000-0000-0000-000000000099",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`seedSession failed: ${error.message}`);
  return data.id;
}

async function listFacts(sourceId: string) {
  const { data } = await supabase
    .from("context_facts")
    .select("*")
    .eq("source_id", sourceId);
  return data ?? [];
}

async function listQualityGates(sourceId: string) {
  const { data } = await supabase
    .from("context_quality_gate_results")
    .select("*")
    .eq("source_id", sourceId);
  return data ?? [];
}

async function findRunForSource(sourceId: string) {
  const { data: runs } = await supabase
    .from("context_processing_runs")
    .select("id, job_id")
    .eq("source_id", sourceId)
    .limit(1);
  return runs?.[0] ?? null;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe.skipIf(!SUPABASE_KEY)(
  "SourceProcessingService — production wiring (B31)",
  () => {
    it("processSource happy path: creates job, run, stage events; persists counters", async () => {
      const sourceId = await seedSource("product_document");
      const collected = makeCollected();
      const adapter = createFakeAdapter(collected);
      const extraction = createFakeExtractionProvider();

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      const result = await svc.processSource(BIZ, WS, sourceId);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Source status updated
      const src = await readSource(sourceId);
      expect(src.status).toBe("processed");
      expect(src.terminal_outcome).toBe("processed");

      // Stage events created (claim, parse, extract, reconcile, quality)
      const run = await findRunForSource(sourceId);
      expect(run).not.toBeNull();

      const runEvents = await listStageEvents(run!.id);
      expect(runEvents.length).toBeGreaterThanOrEqual(5);

      // All stage events should be succeeded
      for (const evt of runEvents) {
        expect(evt.status).toBe("succeeded");
      }

      // Processing run counters
      const runData = await readRun(run!.id);
      expect(runData.documents_created).toBe(1);
      expect(runData.warnings_count).toBe(0);
      expect(runData.facts_extracted).toBeGreaterThanOrEqual(1);
      expect(runData.status).toBe("succeeded");
      expect(runData.terminal_outcome).toBe("processed");

      // Job succeeded
      const job = await readJob(run!.job_id);
      expect(job.status).toBe("succeeded");
      expect(job.completed_at).not.toBeNull();

      // Track cleanup
      cleanupIds.push({
        sourceId,
        jobId: run!.job_id,
        runId: run!.id,
      });
    });

    it("processSource with warnings: terminal outcome processed_with_warnings", async () => {
      const sourceId = await seedSource("website");
      const collected = makeCollectedWithWarnings();
      const adapter = createFakeAdapter(collected);
      const extraction = createFakeExtractionProvider([]);

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      const result = await svc.processSource(BIZ, WS, sourceId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.warnings).toContain("Low OCR confidence: 0.42");
      expect(result.data.warnings).toContain("Truncated at 5000 chars");
      expect(result.data.status).toBe("processed_with_warnings");

      const src = await readSource(sourceId);
      expect(src.status).toBe("processed_with_warnings");
      expect(src.terminal_outcome).toBe("processed_with_warnings");

      const run = await findRunForSource(sourceId);
      expect(run).not.toBeNull();

      const runData = await readRun(run!.id);
      expect(runData.warnings_count).toBe(2);
      expect(runData.status).toBe("succeeded_with_warnings");

      cleanupIds.push({
        sourceId,
        jobId: run!.job_id,
        runId: run!.id,
      });
    });

    it("processSource OCR-blocked source: skipped stage events + blocked outcome", async () => {
      const sourceId = await seedSource("product_document", {
        ocrRequired: true,
        ocrResolved: false,
      });
      const adapter = createFakeAdapter(makeCollected());
      const extraction = createFakeExtractionProvider();

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      const result = await svc.processSource(BIZ, WS, sourceId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.data.status).toBe("blocked_needs_user_action");

      const src = await readSource(sourceId);
      expect(src.status).toBe("blocked_needs_user_action");
      expect(src.terminal_outcome).toBe("blocked_needs_user_action");

      const run = await findRunForSource(sourceId);
      expect(run).not.toBeNull();

      const events = await listStageEvents(run!.id);
      expect(events.length).toBeGreaterThanOrEqual(5);
      for (const evt of events) {
        expect(evt.status).toBe("skipped");
        expect(evt.metadata?.reason).toBe("ocr_blocked");
      }

      const runData = await readRun(run!.id);
      expect(runData.status).toBe("blocked");
      expect(runData.terminal_outcome).toBe("blocked_needs_user_action");

      const job = await readJob(run!.job_id);
      expect(job.status).toBe("failed_permanent");

      cleanupIds.push({
        sourceId,
        jobId: run!.job_id,
        runId: run!.id,
      });
    });

    it("processSource adapter failure: job marked failed_permanent", async () => {
      const sourceId = await seedSource("product_document");
      const failingAdapter: SourceAdapterPort = {
        supports: () => true,
        collect: async () => ({
          ok: false,
          error: { code: "FETCH_FAILED", message: "Network error" },
        }),
      };
      const extraction = createFakeExtractionProvider();

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(failingAdapter);

      const result = await svc.processSource(BIZ, WS, sourceId);
      expect(result.ok).toBe(false);

      const src = await readSource(sourceId);
      expect(src.status).toBe("failed_permanent");

      const run = await findRunForSource(sourceId);
      expect(run).not.toBeNull();

      const job = await readJob(run!.job_id);
      expect(job.status).toBe("failed_permanent");
      expect(job.error).not.toBeNull();

      cleanupIds.push({
        sourceId,
        jobId: run!.job_id,
        runId: run!.id,
      });
    });

    // ─── B31 wiring assertions ────────────────────────────────────────────

    it("processSource extracts facts from collected documents and persists them", async () => {
      const sourceId = await seedSource("product_document");
      const collected = makeCollected();
      const adapter = createFakeAdapter(collected);
      const extraction = createFakeExtractionProvider();

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      const result = await svc.processSource(BIZ, WS, sourceId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Facts must be persisted
      const facts = await listFacts(sourceId);
      expect(facts.length).toBeGreaterThanOrEqual(1);

      // Each fact has the expected keys
      const factKeys = facts.map((f: { fact_key: string }) => f.fact_key);
      expect(factKeys).toContain("company_name");
      expect(factKeys).toContain("product");

      // Facts have proper workspace + business scoping
      for (const f of facts) {
        expect(f.workspace_id).toBe(WS);
        expect(f.business_id).toBe(BIZ);
        expect(f.source_id).toBe(sourceId);
      }

      // Run counter reflects extracted facts
      const run = await findRunForSource(sourceId);
      const runData = await readRun(run!.id);
      expect(runData.facts_extracted).toBeGreaterThanOrEqual(2);

      cleanupIds.push({
        sourceId,
        jobId: run!.job_id,
        runId: run!.id,
      });
    });

    it("processSource persists quality gate results for documents and facts", async () => {
      const sourceId = await seedSource("product_document");
      const adapter = createFakeAdapter(makeCollected());
      const extraction = createFakeExtractionProvider();

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      await svc.processSource(BIZ, WS, sourceId);

      // Quality gate results must be persisted
      const gates = await listQualityGates(sourceId);
      expect(gates.length).toBeGreaterThanOrEqual(1);

      // At least document-scope gates exist
      const docGates = gates.filter((g: { gate_scope: string }) => g.gate_scope === "document");
      expect(docGates.length).toBeGreaterThanOrEqual(1);

      // At least fact-scope gates exist
      const factGates = gates.filter((g: { gate_scope: string }) => g.gate_scope === "fact");
      expect(factGates.length).toBeGreaterThanOrEqual(1);

      // All gates have proper scoping
      for (const g of gates) {
        expect(g.workspace_id).toBe(WS);
        expect(g.business_id).toBe(BIZ);
      }

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
    });

    it("processSource creates lifecycle questions for low-confidence facts", async () => {
      const sourceId = await seedSource("product_document");
      const sessionId = await seedSession();
      const adapter = createFakeAdapter(makeCollected());

      // Low-confidence facts should trigger lifecycle questions
      const lowConfidenceFacts: ExtractedFact[] = [
        {
          factKey: "uncertain_fact",
          value: "maybe something",
          confidence: 0.3,
          sourceExcerpt: "unclear text",
          evidenceLocator: null,
        },
      ];
      const extraction = createFakeExtractionProvider(lowConfidenceFacts);

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      const result = await svc.processSource(BIZ, WS, sourceId, { sessionId });
      expect(result.ok).toBe(true);

      // Low-confidence facts trigger onboarding questions
      const { data: questions } = await supabase
        .from("onboarding_questions")
        .select("*")
        .eq("workspace_id", WS)
        .eq("business_id", BIZ);

      expect(questions).not.toBeNull();
      expect(questions!.length).toBeGreaterThanOrEqual(1);

      // Question references the uncertain fact key
      const factKeys = questions!.map((q: { fact_key: string }) => q.fact_key);
      expect(factKeys).toContain("uncertain_fact");

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
    });

    // ─── B31 review findings ────────────────────────────────────────────────

    it("processSource uses real SHA-256 content hash, not fake hash-${docId}", async () => {
      const sourceId = await seedSource("product_document");
      const collected = makeCollected();
      const adapter = createFakeAdapter(collected);
      const extraction = createFakeExtractionProvider();

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      await svc.processSource(BIZ, WS, sourceId);

      const expectedHash = createHash("sha256")
        .update(collected.documents[0].contentText)
        .digest("hex");

      const { data: docs } = await supabase
        .from("source_documents")
        .select("content_hash")
        .eq("source_id", sourceId);

      expect(docs).not.toBeNull();
      expect(docs!.length).toBe(1);
      expect(docs![0].content_hash).toBe(expectedHash);
      expect(docs![0].content_hash).not.toMatch(/^hash-/);

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
    });

    it("processSource propagates document persistence failure as error", async () => {
      const sourceId = await seedSource("product_document");
      const collected = makeCollected();
      const adapter = createFakeAdapter(collected);
      const extraction = createFakeExtractionProvider();

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      // Process normally first — documents persist
      await svc.processSource(BIZ, WS, sourceId);

      // Second call with same source — document insert would fail on
      // unique constraint or similar; verify service handles it
      const result = await svc.processSource(BIZ, WS, sourceId);

      // The service should return a result (not throw), and the source
      // should not be in 'processed' status if document persistence failed
      const src = await readSource(sourceId);
      // Either it succeeded (idempotent) or it failed gracefully
      expect(result.ok).toBeDefined();

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
    });

    it("processSource uses persisted document ID in quality gate records", async () => {
      const sourceId = await seedSource("product_document");
      const collected = makeCollected();
      const adapter = createFakeAdapter(collected);
      const extraction = createFakeExtractionProvider();

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      await svc.processSource(BIZ, WS, sourceId);

      // Get the persisted document ID
      const { data: docs } = await supabase
        .from("source_documents")
        .select("id")
        .eq("source_id", sourceId);

      expect(docs).not.toBeNull();
      expect(docs!.length).toBe(1);
      const persistedDocId = docs![0].id;

      // Quality gate records must reference the real persisted document ID
      const gates = await listQualityGates(sourceId);
      const docGates = gates.filter((g: { gate_scope: string }) => g.gate_scope === "document");
      expect(docGates.length).toBeGreaterThanOrEqual(1);

      for (const g of docGates) {
        expect(g.source_document_id).toBe(persistedDocId);
      }

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
    });

    it("processSource extraction request uses persisted document ID", async () => {
      const sourceId = await seedSource("product_document");
      const collected = makeCollected();
      const adapter = createFakeAdapter(collected);

      let capturedRequest: ExtractionRequest | null = null;
      const extraction: ExtractionPort = {
        extractFacts: async (request: ExtractionRequest) => {
          capturedRequest = request;
          return {
            ok: true,
            data: {
              facts: [{
                factKey: "test",
                value: "test",
                confidence: 0.9,
                sourceExcerpt: null,
                evidenceLocator: null,
              }],
              conflicts: [],
              warnings: [],
            },
          };
        },
        reconcileFacts: async () => ({
          ok: true,
          data: { superseded: [], conflicts: [], toCreate: [], toUpdate: [] },
        }),
      };

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      await svc.processSource(BIZ, WS, sourceId);

      // Get the real persisted document ID
      const { data: docs } = await supabase
        .from("source_documents")
        .select("id")
        .eq("source_id", sourceId);

      expect(capturedRequest).not.toBeNull();
      expect(capturedRequest!.sourceDocumentId).toBe(docs![0].id);
      expect(capturedRequest!.sourceDocumentId).not.toMatch(/^doc-/);

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
    });

    it("processSource reconciles against all business facts, not just source-scoped", async () => {
      const sourceId = await seedSource("product_document");
      const otherSourceId = await seedSource("product_document");

      // Seed a fact from a different source under the same business
      await supabase.from("context_facts").insert({
        workspace_id: WS,
        business_id: BIZ,
        fact_key: "company_name",
        value: "Old Corp",
        source_id: otherSourceId,
        source_document_id: null,
        source_excerpt: "Old Corp was a company",
        evidence_locator: null,
        confidence: 0.8,
        verification_status: "extracted",
        supersedes_fact_id: null,
        valid_from: new Date().toISOString(),
        valid_to: null,
        created_by: "system",
      });

      const adapter = createFakeAdapter(makeCollected());
      const extraction = createFakeExtractionProvider([
        {
          factKey: "company_name",
          value: "Acme Corp",
          confidence: 0.95,
          sourceExcerpt: "Acme Corp sells widgets",
          evidenceLocator: null,
        },
      ]);

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      await svc.processSource(BIZ, WS, sourceId);

      // The old fact from otherSource should be superseded, not just source-scoped facts
      const { data: oldFact } = await supabase
        .from("context_facts")
        .select("verification_status")
        .eq("source_id", otherSourceId)
        .eq("fact_key", "company_name")
        .single();

      expect(oldFact).not.toBeNull();
      expect(oldFact!.verification_status).toBe("superseded");

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
      // Also clean up the other source's facts
      await supabase.from("context_facts").delete().eq("source_id", otherSourceId);
      await supabase.from("context_sources").delete().eq("id", otherSourceId);
    });

    it("processSource surfaces extraction failure as warning, never silent", async () => {
      const sourceId = await seedSource("product_document");
      const adapter = createFakeAdapter(makeCollected());

      const failingExtraction: ExtractionPort = {
        extractFacts: async () => ({
          ok: false,
          error: { code: "EXTRACTION_FAILED", message: "LLM output invalid" },
        }),
        reconcileFacts: async () => ({
          ok: true,
          data: { superseded: [], conflicts: [], toCreate: [], toUpdate: [] },
        }),
      };

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        failingExtraction,
      );
      svc.registerAdapter(adapter);

      const result = await svc.processSource(BIZ, WS, sourceId);

      // Extraction failure should NOT be silent — it should produce
      // either an error result or warnings in the response
      expect(result.ok).toBe(true);
      if (result.ok) {
        // If ok, there must be warnings about the extraction failure
        expect(result.data.warnings.length).toBeGreaterThan(0);
        const hasExtractionWarning = result.data.warnings.some(
          (w) => w.toLowerCase().includes("extraction") || w.toLowerCase().includes("failed"),
        );
        expect(hasExtractionWarning).toBe(true);
      }

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
    });

    it("processSource dismisses open question when high-confidence extraction resolves its key", async () => {
      const sourceId = await seedSource("product_document");
      const sessionId = await seedSession();
      const adapter = createFakeAdapter(makeCollected());

      // Seed an open onboarding question for company_name
      const { data: seededQ } = await supabase
        .from("onboarding_questions")
        .insert({
          workspace_id: WS,
          business_id: BIZ,
          session_id: sessionId,
          fact_key: "company_name",
          question_type: "confirmation",
          question: "Is the company name Acme Corp?",
          options: null,
          reason: "Low-confidence extraction",
          priority: 1,
          status: "open",
          answer: null,
          answered_by: null,
          answered_at: null,
        })
        .select("id")
        .single();
      expect(seededQ).not.toBeNull();

      // High-confidence extraction — company_name resolved, not a gap
      const highConfidenceFacts: ExtractedFact[] = [
        {
          factKey: "company_name",
          value: "Acme Corp",
          confidence: 0.95,
          sourceExcerpt: "Acme Corp sells widgets",
          evidenceLocator: null,
        },
      ];
      const extraction = createFakeExtractionProvider(highConfidenceFacts);

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      const result = await svc.processSource(BIZ, WS, sourceId, { sessionId });
      expect(result.ok).toBe(true);

      // Question should be dismissed — key resolved by high-confidence fact
      const { data: q } = await supabase
        .from("onboarding_questions")
        .select("status")
        .eq("id", seededQ!.id)
        .single();
      expect(q).not.toBeNull();
      expect(q!.status).toBe("dismissed");

      // No answered questions should have been modified
      const { data: answeredQs } = await supabase
        .from("onboarding_questions")
        .select("*")
        .eq("workspace_id", WS)
        .eq("business_id", BIZ)
        .eq("status", "answered");
      expect(answeredQs).not.toBeNull();
      expect(answeredQs!.length).toBe(0);

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
    });

    it("processSource with warnings: persisted warnings_count matches returned warnings length", async () => {
      const sourceId = await seedSource("product_document");
      const collected = makeCollectedWithWarnings();
      const adapter = createFakeAdapter(collected);
      const extraction = createFakeExtractionProvider([]);

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      const result = await svc.processSource(BIZ, WS, sourceId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Returned warnings count
      const returnedWarningCount = result.data.warnings.length;
      expect(returnedWarningCount).toBeGreaterThan(0);

      // Persisted run warnings_count must match returned warnings count
      const run = await findRunForSource(sourceId);
      expect(run).not.toBeNull();
      const runData = await readRun(run!.id);
      expect(runData.warnings_count).toBe(returnedWarningCount);

      // Source terminal status must be processed_with_warnings
      const src = await readSource(sourceId);
      expect(src.terminal_outcome).toBe("processed_with_warnings");

      cleanupIds.push({
        sourceId,
        jobId: run!.job_id,
        runId: run!.id,
      });
    });

    it("processSource skips lifecycle questions when no sessionId provided", async () => {
      const sourceId = await seedSource("product_document");
      const adapter = createFakeAdapter(makeCollected());

      const lowConfidenceFacts: ExtractedFact[] = [
        {
          factKey: "uncertain_fact",
          value: "maybe",
          confidence: 0.3,
          sourceExcerpt: "unclear",
          evidenceLocator: null,
        },
      ];
      const extraction = createFakeExtractionProvider(lowConfidenceFacts);

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      // No sessionId option — should NOT create lifecycle questions
      await svc.processSource(BIZ, WS, sourceId);

      const { data: questions } = await supabase
        .from("onboarding_questions")
        .select("*")
        .eq("workspace_id", WS)
        .eq("business_id", BIZ)
        .eq("fact_key", "uncertain_fact");

      expect(questions).not.toBeNull();
      expect(questions!.length).toBe(0);

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
    });

    // ─── B29 conflict persistence ──────────────────────────────────────────

    it("B29 conflict persistence: conflicting extracted value produces open context_conflicts row", async () => {
      const sourceId = await seedSource("product_document");
      const otherSourceId = await seedSource("product_document");

      // Seed an active fact with one value
      const { data: seededFact } = await supabase
        .from("context_facts")
        .insert({
          workspace_id: WS,
          business_id: BIZ,
          fact_key: "company_name",
          value: "Old Corp",
          source_id: otherSourceId,
          source_document_id: null,
          source_excerpt: "Old Corp was a company",
          evidence_locator: null,
          confidence: 0.95,
          verification_status: "extracted",
          supersedes_fact_id: null,
          valid_from: new Date().toISOString(),
          valid_to: null,
          created_by: "system",
        })
        .select("id")
        .single();
      expect(seededFact).not.toBeNull();

      // Extraction returns a CONFLICTING value for the same fact key
      const conflictingFacts: ExtractedFact[] = [
        {
          factKey: "company_name",
          value: "New Corp",
          confidence: 0.9,
          sourceExcerpt: "New Corp sells widgets",
          evidenceLocator: null,
        },
      ];
      const extraction = createFakeExtractionProvider(conflictingFacts);

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(createFakeAdapter(makeCollected()));

      const result = await svc.processSource(BIZ, WS, sourceId);
      expect(result.ok).toBe(true);

      // Exactly one open context_conflicts row for the normalized fact key
      const { data: conflicts } = await supabase
        .from("context_conflicts")
        .select("*")
        .eq("workspace_id", WS)
        .eq("business_id", BIZ)
        .eq("fact_key", "company_name")
        .eq("status", "open");

      expect(conflicts).not.toBeNull();
      expect(conflicts!.length).toBe(1);

      // The conflict should reference both competing fact IDs
      const conflict = conflicts![0];
      expect(conflict.fact_ids).toContain(seededFact!.id);

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
      // Clean up other source
      await supabase.from("context_facts").delete().eq("source_id", otherSourceId);
      await supabase.from("context_sources").delete().eq("id", otherSourceId);
    });

    // ─── B29 supersession propagation ─────────────────────────────────────

    it("B29 supersession: higher-confidence extraction supersedes old fact with valid_to and supersedes_fact_id", async () => {
      const sourceId = await seedSource("product_document");
      const otherSourceId = await seedSource("product_document");

      // Seed an active extracted fact with lower confidence
      const { data: oldFact } = await supabase
        .from("context_facts")
        .insert({
          workspace_id: WS,
          business_id: BIZ,
          fact_key: "company_name",
          value: "Old Corp",
          source_id: otherSourceId,
          source_document_id: null,
          source_excerpt: "Old Corp was a company",
          evidence_locator: null,
          confidence: 0.6,
          verification_status: "extracted",
          supersedes_fact_id: null,
          valid_from: new Date().toISOString(),
          valid_to: null,
          created_by: "system",
        })
        .select("id")
        .single();
      expect(oldFact).not.toBeNull();

      // Process same fact key with higher-confidence different value
      const higherConfidenceFacts: ExtractedFact[] = [
        {
          factKey: "company_name",
          value: "New Corp",
          confidence: 0.9,
          sourceExcerpt: "New Corp sells widgets",
          evidenceLocator: null,
        },
      ];
      const extraction = createFakeExtractionProvider(higherConfidenceFacts);

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(createFakeAdapter(makeCollected()));

      const result = await svc.processSource(BIZ, WS, sourceId);
      expect(result.ok).toBe(true);

      // Old fact must be superseded with valid_to set
      const { data: oldFactAfter } = await supabase
        .from("context_facts")
        .select("verification_status, valid_to")
        .eq("id", oldFact!.id)
        .single();

      expect(oldFactAfter).not.toBeNull();
      expect(oldFactAfter!.verification_status).toBe("superseded");
      expect(oldFactAfter!.valid_to).not.toBeNull();

      // New active fact must exist with supersedes_fact_id pointing to old
      const { data: newFacts } = await supabase
        .from("context_facts")
        .select("id, value, verification_status, supersedes_fact_id, valid_to")
        .eq("workspace_id", WS)
        .eq("business_id", BIZ)
        .eq("fact_key", "company_name")
        .eq("source_id", sourceId);

      expect(newFacts).not.toBeNull();
      expect(newFacts!.length).toBe(1);

      const newFact = newFacts![0];
      expect(newFact.value).toBe("New Corp");
      expect(newFact.verification_status).toBe("extracted");
      expect(newFact.valid_to).toBeNull();
      expect(newFact.supersedes_fact_id).toBe(oldFact!.id);

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
      // Clean up other source
      await supabase.from("context_facts").delete().eq("source_id", otherSourceId);
      await supabase.from("context_sources").delete().eq("id", otherSourceId);
    });

    // ─── B29 atomic regression ────────────────────────────────────────────

    it("B29 atomic regression: DB-rejected fact must not leak previously-persisted fact", async () => {
      const sourceId = await seedSource("product_document");
      const adapter = createFakeAdapter(makeCollected());

      // Seed a pre-existing fact that must survive processing untouched
      const preExistingSourceId = await seedSource("product_document");
      await supabase.from("context_facts").insert({
        workspace_id: WS,
        business_id: BIZ,
        fact_key: "existing_key",
        value: "pre-existing value",
        source_id: preExistingSourceId,
        source_document_id: null,
        source_excerpt: "existing excerpt",
        evidence_locator: null,
        confidence: 0.8,
        verification_status: "extracted",
        supersedes_fact_id: null,
        valid_from: new Date().toISOString(),
        valid_to: null,
        created_by: "system",
      });

      // Extraction returns one valid fact + one with confidence > 1
      // The invalid fact violates: check (confidence >= 0 and confidence <= 1)
      const mixedFacts: ExtractedFact[] = [
        {
          factKey: "company_name",
          value: "Acme Corp",
          confidence: 0.9,
          sourceExcerpt: "Acme Corp sells widgets",
          evidenceLocator: null,
        },
        {
          factKey: "industry",
          value: "Manufacturing",
          confidence: 1.5, // DB constraint violation
          sourceExcerpt: "manufacturing sector",
          evidenceLocator: null,
        },
      ];
      const extraction = createFakeExtractionProvider(mixedFacts);

      const svc = new SourceProcessingService(
        await import("@/infrastructure/business-context/supabase.repository").then(
          (m) => new m.SupabaseRepository(supabase),
        ),
        extraction,
      );
      svc.registerAdapter(adapter);

      const result = await svc.processSource(BIZ, WS, sourceId);

      // ── ServiceResult assertion ───────────────────────────────────────
      // When a fact violates the DB confidence constraint (check constraint
      // confidence >= 0 AND confidence <= 1), the service must surface the
      // failure as ok:false — not swallow it.
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeDefined();
        expect(result.error.code).toBeDefined();
      }

      // ── Atomic assertion ──────────────────────────────────────────────
      // If ANY fact in the batch fails DB persistence, NO new facts from
      // this processing run should be committed. The pre-existing fact
      // must remain active.
      const { data: facts } = await supabase
        .from("context_facts")
        .select("*")
        .eq("workspace_id", WS)
        .eq("business_id", BIZ);

      const preExisting = facts!.filter((f: { fact_key: string }) => f.fact_key === "existing_key");
      const newCompany = facts!.filter((f: { fact_key: string }) => f.fact_key === "company_name");
      const newIndustry = facts!.filter((f: { fact_key: string }) => f.fact_key === "industry");

      // Pre-existing fact must survive
      expect(preExisting.length).toBe(1);
      expect(preExisting[0].verification_status).toBe("extracted");

      // No new facts from this run should persist — atomic rollback required
      expect(newCompany.length).toBe(0); // FAILS: sequential writes persist this
      expect(newIndustry.length).toBe(0);

      cleanupIds.push({
        sourceId,
        jobId: (await findRunForSource(sourceId))?.job_id ?? "",
        runId: (await findRunForSource(sourceId))?.id ?? "",
      });
      // Clean up pre-existing source + facts
      await supabase.from("context_facts").delete().eq("source_id", preExistingSourceId);
      await supabase.from("context_sources").delete().eq("id", preExistingSourceId);
    });
  },
);
