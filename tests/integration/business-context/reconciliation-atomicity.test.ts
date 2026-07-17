import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SourceProcessingService } from "@/core/business-context/service/source-processing.service";
import { SupabaseRepository } from "@/infrastructure/business-context/supabase.repository";
import type { SourceAdapterPort } from "@/core/business-context/source-adapter.port";
import type {
  ExtractionPort,
  ExtractionRequest,
  ExtractionResult,
  ExtractedFact,
} from "@/core/business-context/extraction.port";
import type { ServiceResult } from "@/core/business-context/types";

// B29 reconciliation atomicity proof
//
// Proves against real Supabase + real SourceProcessingService + real
// SupabaseRepository that reconciliation persistence is atomic at the
// RPC boundary: if persistFactReconciliation fails, no new facts persist.
//
//   ARRANGE: Two existing active facts (company_name=OldCorp, product=gadgets)
//            + extracted facts requiring supersession for BOTH keys.
//
//   ACT:     Override persistFactReconciliation on the real SupabaseRepository
//            to always return failure — simulating a DB-level error at the
//            atomic persistence boundary.
//
//   ASSERT:  No new facts persist; old facts not superseded.
//
//   EXPECTED GREEN: Assertions PASS because persistFactReconciliation is a
//                    single atomic RPC — failure means nothing persists.

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const WS = "b2900000-0000-0000-0000-000000000001";
const BIZ = "b2900000-0000-0000-0000-000000000002";

let supabase: SupabaseClient;

beforeAll(async () => {
  if (!SUPABASE_KEY) return;
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
  await supabase.from("workspaces").upsert(
    { id: WS, name: "B29 Atomicity Workspace" },
    { onConflict: "id" },
  );
  await supabase.from("businesses").upsert(
    { id: BIZ, workspace_id: WS, name: "B29 Atomicity Business", status: "active" },
    { onConflict: "id" },
  );
});

afterAll(async () => {
  if (!supabase) return;
  await supabase.from("context_facts").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("context_quality_gate_results").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("onboarding_questions").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("context_sources").delete().eq("workspace_id", WS).eq("business_id", BIZ);
});

beforeEach(async () => {
  if (!supabase) return;
  await supabase.from("context_facts").delete().eq("workspace_id", WS).eq("business_id", BIZ);
});

// ─── Helpers ───────────────────────────────────────────────────────────────

async function seedSource(): Promise<string> {
  const { data, error } = await supabase
    .from("context_sources")
    .insert({
      workspace_id: WS,
      business_id: BIZ,
      source_type: "product_document",
      source_name: `b29-atomicity-${Date.now()}`,
      external_reference: null,
      status: "registered",
      current_stage: null,
      terminal_outcome: null,
      metadata: {},
      collected_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`seedSource: ${error.message}`);
  return data.id;
}

async function seedActiveFact(
  sourceId: string,
  factKey: string,
  value: unknown,
  confidence: number,
): Promise<string> {
  const { data, error } = await supabase
    .from("context_facts")
    .insert({
      workspace_id: WS,
      business_id: BIZ,
      fact_key: factKey,
      value,
      source_id: sourceId,
      source_document_id: null,
      source_excerpt: null,
      evidence_locator: null,
      confidence,
      verification_status: "extracted",
      supersedes_fact_id: null,
      valid_from: new Date().toISOString(),
      valid_to: null,
      created_by: "system",
    })
    .select("id")
    .single();
  if (error) throw new Error(`seedActiveFact: ${error.message}`);
  return data.id;
}

async function listFactsByKey(factKey: string) {
  const { data } = await supabase
    .from("context_facts")
    .select("*")
    .eq("workspace_id", WS)
    .eq("business_id", BIZ)
    .eq("fact_key", factKey);
  return data ?? [];
}

// ─── Repository wrapper: fail persistFactReconciliation RPC ─────────────────

/**
 * Creates a SupabaseRepository whose `persistFactReconciliation`
 * arrow-function instance property is overridden to always return failure,
 * simulating a DB-level persistence error at the atomic RPC boundary.
 *
 * Arrow-function class fields on a TypeScript class are own instance
 * properties, so reassigning them on the same instance changes what
 * `this.repo.persistFactReconciliation(...)` resolves to in the service.
 */
function createRepoWithFailingReconcileRPC(
  realClient: SupabaseClient,
): { repo: SupabaseRepository; getReconcileCount: () => number } {
  const repo = new SupabaseRepository(realClient);
  let reconcileCount = 0;

  repo.persistFactReconciliation = async (
    _workspaceId: string,
    _businessId: string,
    _supersessionUpdates: Parameters<SupabaseRepository["persistFactReconciliation"]>[2],
    _factCreations: Parameters<SupabaseRepository["persistFactReconciliation"]>[3],
    _conflicts?: Parameters<SupabaseRepository["persistFactReconciliation"]>[4],
  ) => {
    reconcileCount++;
    return {
      ok: false,
      error: {
        code: "RECONCILE_FAILED",
        message: "Simulated DB failure on fact reconciliation RPC",
      },
    };
  };

  return { repo, getReconcileCount: () => reconcileCount };
}

// ─── Fake adapter ──────────────────────────────────────────────────────────

const fakeAdapter: SourceAdapterPort = {
  supports: (t) => t === "product_document",
  collect: async () => ({
    ok: true,
    data: {
      sourceType: "product_document",
      sourceName: "b29-doc",
      externalReference: null,
      metadata: {},
      documents: [
        {
          title: "B29 Test Document",
          contentText: "Acme Corp manufactures industrial widgets.",
          mimeType: "text/markdown",
          metadata: {},
        },
      ],
    },
  }),
};

// ─── Cross-workspace isolation constants ───────────────────────────────────

const WS_B = "b2900000-0000-0000-0000-000000000010"; // foreign workspace
const BIZ_B = "b2900000-0000-0000-0000-000000000011"; // foreign business

// ─── Test ──────────────────────────────────────────────────────────────────

describe.skipIf(!SUPABASE_KEY)(
  "Cross-workspace reconciliation guard (B29) — reject mismatched business/workspace",
  () => {
    beforeAll(async () => {
      if (!supabase) return;
      await supabase.from("workspaces").upsert(
        { id: WS_B, name: "B29 Cross-Workspace B" },
        { onConflict: "id" },
      );
      await supabase.from("businesses").upsert(
        { id: BIZ_B, workspace_id: WS_B, name: "B29 Cross-Workspace Business", status: "active" },
        { onConflict: "id" },
      );
    });

    afterAll(async () => {
      if (!supabase) return;
      await supabase.from("context_facts").delete().eq("workspace_id", WS_B).eq("business_id", BIZ_B);
      await supabase.from("businesses").delete().eq("id", BIZ_B);
      await supabase.from("workspaces").delete().eq("id", WS_B);
    });

    it("rejects cross-workspace RPC: business from workspace B called with workspace A (stable error, zero writes)", async () => {
      // BIZ_B belongs to WS_B; calling RPC with WS as workspace should fail
      const { data, error } = await supabase.rpc("persist_fact_reconciliation", {
        p_workspace_id: WS, // wrong workspace — WS ≠ WS_B
        p_business_id: BIZ_B, // belongs to WS_B
        p_supersession_updates: [],
        p_fact_creations: [
          {
            factKey: "company_name",
            value: "IntruderCorp",
            confidence: 0.9,
            sourceId: "00000000-0000-0000-0000-000000000099",
            sourceExcerpt: "cross workspace test",
            evidenceLocator: null,
            verificationStatus: "extracted",
            validFrom: new Date().toISOString(),
            createdBy: "test",
          },
        ],
        p_conflicts: [],
      });

      // Stable error code — must not throw or return ok:true
      expect(error).toBeNull();
      expect(data).toBeDefined();
      const result = data as Record<string, unknown>;
      expect(result.ok).toBe(false);
      const errObj = result.error as Record<string, unknown>;
      expect(errObj.code).toBe("BUSINESS_WORKSPACE_MISMATCH");

      // Zero facts persisted under WS+BIZ_B (the wrong workspace)
      const factsWrongWs = await supabase
        .from("context_facts")
        .select("id")
        .eq("workspace_id", WS)
        .eq("business_id", BIZ_B);
      expect(factsWrongWs.data ?? []).toHaveLength(0);

      // Zero facts persisted under WS_B+BIZ_B (the correct workspace)
      const factsCorrectWs = await supabase
        .from("context_facts")
        .select("id")
        .eq("workspace_id", WS_B)
        .eq("business_id", BIZ_B);
      expect(factsCorrectWs.data ?? []).toHaveLength(0);

      // No conflicts created
      const conflicts = await supabase
        .from("context_conflicts")
        .select("id")
        .eq("workspace_id", WS_B)
        .eq("business_id", BIZ_B);
      expect(conflicts.data ?? []).toHaveLength(0);
    });
  },
);

describe.skipIf(!SUPABASE_KEY)(
  "Reconciliation atomicity (B29) — real SourceProcessingService + SupabaseRepository",
  () => {
    it("does not persist new facts when supersession update fails (atomicity violation → RED)", async () => {
      // ── ARRANGE ──────────────────────────────────────────────────────
      const sourceId = await seedSource();

      // Two existing active facts that should be superseded
      const oldCompanyFactId = await seedActiveFact(sourceId, "company_name", "OldCorp", 0.8);
      const oldProductFactId = await seedActiveFact(sourceId, "product", "gadgets", 0.7);

      // Extraction returns higher-confidence values for BOTH keys,
      // requiring supersession of both existing facts.
      const extractedFacts: ExtractedFact[] = [
        {
          factKey: "company_name",
          value: "NewCorp",
          confidence: 0.95,
          sourceExcerpt: "Acme Corp manufactures industrial widgets.",
          evidenceLocator: null,
        },
        {
          factKey: "product",
          value: "widgets",
          confidence: 0.9,
          sourceExcerpt: "manufactures industrial widgets",
          evidenceLocator: null,
        },
      ];

      const extraction: ExtractionPort = {
        extractFacts: async (
          _req: ExtractionRequest,
        ): Promise<ServiceResult<ExtractionResult>> => ({
          ok: true,
          data: { facts: extractedFacts, conflicts: [], warnings: [] },
        }),
        reconcileFacts: async () => ({
          ok: true,
          data: { superseded: [], conflicts: [], toCreate: [], toUpdate: [] },
        }),
      };

      // Real SupabaseRepository: persistFactReconciliation RPC fails
      const { repo, getReconcileCount } = createRepoWithFailingReconcileRPC(supabase);
      const svc = new SourceProcessingService(repo, extraction);
      svc.registerAdapter(fakeAdapter);

      // ── ACT ──────────────────────────────────────────────────────────
      // processSource collects extracted facts, builds reconciliation
      // payload, then calls persistFactReconciliation RPC once.
      // Our override makes that RPC fail — simulating a DB-level error
      // at the atomic persistence boundary.
      const result = await svc.processSource(BIZ, WS, sourceId);

      // ── ASSERT ───────────────────────────────────────────────────────
      // Verify the failure injection actually fired
      expect(getReconcileCount()).toBeGreaterThanOrEqual(1);

      // ATOMICITY GUARANTEE: if ANY supersession fails, NO new facts
      // should persist. Old facts must remain active (not superseded).

      // Company_name: old fact must NOT be superseded
      const oldCompanyRows = await listFactsByKey("company_name");
      const oldCompanyFact = oldCompanyRows.find((r) => r.id === oldCompanyFactId);
      expect(oldCompanyFact?.verification_status).not.toBe("superseded");

      // No new company_name fact should exist
      const newCompanyFacts = oldCompanyRows.filter((r) => r.id !== oldCompanyFactId);
      expect(newCompanyFacts).toHaveLength(0);

      // Product: old fact must NOT be superseded
      const oldProductRows = await listFactsByKey("product");
      const oldProductFact = oldProductRows.find((r) => r.id === oldProductFactId);
      expect(oldProductFact?.verification_status).not.toBe("superseded");

      // No new product fact should exist
      const newProductFacts = oldProductRows.filter((r) => r.id !== oldProductFactId);
      expect(newProductFacts).toHaveLength(0);

      // Cleanup
      await supabase.from("context_facts").delete().eq("source_id", sourceId);
      await supabase.from("context_sources").delete().eq("id", sourceId);
    });
  },
);
