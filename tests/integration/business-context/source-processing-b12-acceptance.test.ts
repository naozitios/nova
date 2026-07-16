import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SourceProcessingService } from "@/core/business-context/service/source-processing.service";
import { ManualSourceAdapter } from "@/infrastructure/business-context/manual-source.adapter";
import { SupabaseRepository } from "@/infrastructure/business-context/supabase.repository";
import type { ExtractionPort, ExtractionRequest, ExtractionResult, ExtractedFact } from "@/core/business-context/extraction.port";
import type { ServiceResult } from "@/core/business-context/types";

// B12 acceptance — real Supabase + real ManualSourceAdapter + fake extraction only
// Uses "system_inference" (NOT in NO_PARSE_TYPES) so full pipeline runs.

const URL_ = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
let sb: SupabaseClient;
const WS = randomUUID();
const BIZ = randomUUID();
let clean: { sourceId: string; jobId: string; runId: string }[] = [];

beforeAll(async () => {
  if (!KEY) return;
  sb = createClient(URL_, KEY, { auth: { persistSession: false } });
  await sb.from("workspaces").upsert({ id: WS, name: "B12 WS" }, { onConflict: "id" });
  await sb.from("businesses").upsert({ id: BIZ, workspace_id: WS, name: "B12 Biz", status: "active" }, { onConflict: "id" });
});

afterAll(async () => {
  if (!sb) return;
  for (const c of clean) {
    await sb.from("context_processing_stage_events").delete().eq("run_id", c.runId);
    await sb.from("context_processing_runs").delete().eq("id", c.runId);
    await sb.from("context_jobs").delete().eq("id", c.jobId);
    await sb.from("context_sources").delete().eq("id", c.sourceId);
  }
  for (const t of ["source_documents", "context_facts", "context_quality_gate_results"]) {
    await sb.from(t).delete().eq("workspace_id", WS).eq("business_id", BIZ);
  }
  await sb.from("businesses").delete().eq("id", BIZ);
  await sb.from("workspaces").delete().eq("id", WS);
});

beforeEach(async () => {
  clean = [];
  if (!sb) return;
  for (const t of ["source_documents", "context_facts", "context_quality_gate_results"]) {
    await sb.from(t).delete().eq("workspace_id", WS).eq("business_id", BIZ);
  }
});

function fakeExtraction(facts?: ExtractedFact[]): ExtractionPort {
  const d: ExtractedFact[] = [
    { factKey: "brand_name", value: "BrightBrand Co", confidence: 0.92, sourceExcerpt: "BrightBrand Co is a premium wellness brand", evidenceLocator: null },
    { factKey: "target_audience", value: "health-conscious millennials", confidence: 0.88, sourceExcerpt: "targeting health-conscious millennials aged 25-40", evidenceLocator: null },
  ];
  return {
    extractFacts: async (_r: ExtractionRequest): Promise<ServiceResult<ExtractionResult>> => ({ ok: true, data: { facts: facts ?? d, conflicts: [], warnings: [] } }),
    reconcileFacts: async () => ({ ok: true, data: { superseded: [], conflicts: [], toCreate: [], toUpdate: [] } }),
  };
}

async function seed(sourceType: string, meta: Record<string, unknown> = {}): Promise<string> {
  const { data, error } = await sb.from("context_sources").insert({
    workspace_id: WS, business_id: BIZ, source_type: sourceType,
    source_name: `b12-${sourceType}-${Date.now()}`, external_reference: null,
    status: "registered", current_stage: null, terminal_outcome: null,
    metadata: meta, collected_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw new Error(`seed: ${error.message}`);
  return data.id;
}

const src = (id: string) => sb.from("context_sources").select("*").eq("id", id).single().then(r => r.data);
const job = (id: string) => sb.from("context_jobs").select("*").eq("id", id).single().then(r => r.data);
const run = (id: string) => sb.from("context_processing_runs").select("*").eq("id", id).single().then(r => r.data);
const stageEvts = (rid: string) => sb.from("context_processing_stage_events").select("*").eq("run_id", rid).order("started_at", { ascending: true }).then(r => r.data ?? []);
const docs = (sid: string) => sb.from("source_documents").select("*").eq("source_id", sid).then(r => r.data ?? []);
const facts = (sid: string) => sb.from("context_facts").select("*").eq("source_id", sid).then(r => r.data ?? []);
const gates = (sid: string) => svc_from_source(sid).then(() => sb.from("context_quality_gate_results").select("*").eq("source_id", sid).then(r => r.data ?? []));
const findRun = (sid: string) => sb.from("context_processing_runs").select("id, job_id").eq("source_id", sid).limit(1).then(r => r.data?.[0] ?? null);

function svc(ex: ExtractionPort) {
  const r = new SupabaseRepository(sb);
  const s = new SourceProcessingService(r, ex);
  s.registerAdapter(new ManualSourceAdapter());
  return s;
}

// Dummy helper to satisfy gates() type — not actually called
function svc_from_source(_sid: string): Promise<void> { return Promise.resolve(); }

// Re-read gates without svc dependency
async function listGates(sid: string) {
  const { data } = await sb.from("context_quality_gate_results").select("*").eq("source_id", sid);
  return data ?? [];
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe.skipIf(!KEY)("B12 acceptance — SourceProcessingService persistence", () => {
  it("happy path: document + facts + quality gates + events + terminal outcome", async () => {
    const sourceId = await seed("system_inference", {
      content: "BrightBrand Co is a premium wellness brand targeting health-conscious millennials aged 25-40.",
    });
    const s = svc(fakeExtraction());
    const result = await s.processSource(BIZ, WS, sourceId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.status).toBe("processed");
    expect(result.data.warnings).toHaveLength(0);

    const src_ = await src(sourceId);
    expect(src_.status).toBe("processed");
    expect(src_.terminal_outcome).toBe("processed");

    const ds = await docs(sourceId);
    expect(ds.length).toBe(1);
    expect(ds[0].workspace_id).toBe(WS);
    expect(ds[0].business_id).toBe(BIZ);
    expect(ds[0].source_id).toBe(sourceId);
    expect(ds[0].content_text).toContain("BrightBrand Co");
    expect(ds[0].mime_type).toBe("text/markdown");
    expect(ds[0].content_hash).toMatch(/^[a-f0-9]{64}$/);

    const fs = await facts(sourceId);
    expect(fs.length).toBeGreaterThanOrEqual(2);
    expect(fs.map((f: any) => f.fact_key)).toEqual(expect.arrayContaining(["brand_name", "target_audience"]));
    for (const f of fs) {
      expect(f.workspace_id).toBe(WS);
      expect(f.business_id).toBe(BIZ);
      expect(f.source_id).toBe(sourceId);
      expect(f.verification_status).toBe("extracted");
      expect(f.created_by).toBe("system");
    }

    const gs = await listGates(sourceId);
    expect(gs.length).toBeGreaterThanOrEqual(1);
    expect(gs.filter((g: any) => g.gate_scope === "document").length).toBeGreaterThanOrEqual(1);
    expect(gs.filter((g: any) => g.gate_scope === "fact").length).toBeGreaterThanOrEqual(1);
    for (const g of gs) { expect(g.workspace_id).toBe(WS); expect(g.business_id).toBe(BIZ); }

    const r = await findRun(sourceId);
    expect(r).not.toBeNull();
    const evts = await stageEvts(r!.id);
    expect(evts.length).toBeGreaterThanOrEqual(5);
    for (const e of evts) expect(e.status).toBe("succeeded");

    const rd = await run(r!.id);
    expect(rd.documents_created).toBe(1);
    expect(rd.facts_extracted).toBeGreaterThanOrEqual(2);
    expect(rd.warnings_count).toBe(0);
    expect(rd.status).toBe("succeeded");
    expect(rd.terminal_outcome).toBe("processed");

    const j = await job(r!.job_id);
    expect(j.status).toBe("succeeded");
    expect(j.completed_at).not.toBeNull();
    clean.push({ sourceId, jobId: r!.job_id, runId: r!.id });
  });

  it("ManualSourceAdapter uses content metadata as document text", async () => {
    const sourceId = await seed("system_inference", { content: "Inferred: targets eco-conscious consumers" });
    const s = svc(fakeExtraction([{ factKey: "segment", value: "eco-conscious", confidence: 0.75, sourceExcerpt: "targets eco-conscious", evidenceLocator: null }]));
    const result = await s.processSource(BIZ, WS, sourceId);
    expect(result.ok).toBe(true);
    const ds = await docs(sourceId);
    expect(ds.length).toBe(1);
    expect(ds[0].content_text).toContain("eco-conscious consumers");
    const fs = await facts(sourceId);
    expect(fs.length).toBe(1);
    expect(fs[0].fact_key).toBe("segment");
    const r = await findRun(sourceId);
    clean.push({ sourceId, jobId: r?.job_id ?? "", runId: r?.id ?? "" });
  });

  it("default content when no metadata provided", async () => {
    const sourceId = await seed("system_inference");
    const s = svc(fakeExtraction([]));
    await s.processSource(BIZ, WS, sourceId);
    const ds = await docs(sourceId);
    expect(ds.length).toBe(1);
    expect(ds[0].content_text).toContain("System Inference");
    const r = await findRun(sourceId);
    clean.push({ sourceId, jobId: r?.job_id ?? "", runId: r?.id ?? "" });
  });

  it("content hash is real SHA-256 from collected text", async () => {
    const sourceId = await seed("system_inference", { content: "Hash check content" });
    await svc(fakeExtraction([])).processSource(BIZ, WS, sourceId);
    const ds = await docs(sourceId);
    expect(ds.length).toBe(1);
    const expected = createHash("sha256").update(ds[0].content_text).digest("hex");
    expect(ds[0].content_hash).toBe(expected);
    expect(ds[0].content_hash).not.toMatch(/^hash-/);
    const r = await findRun(sourceId);
    clean.push({ sourceId, jobId: r?.job_id ?? "", runId: r?.id ?? "" });
  });

  it("quality gate records reference persisted document ID", async () => {
    const sourceId = await seed("system_inference", { content: "Gate ref check" });
    await svc(fakeExtraction()).processSource(BIZ, WS, sourceId);
    const ds = await docs(sourceId);
    expect(ds.length).toBe(1);
    const docId = ds[0].id;
    const gs = await listGates(sourceId);
    const dg = gs.filter((g: any) => g.gate_scope === "document");
    expect(dg.length).toBeGreaterThanOrEqual(1);
    for (const g of dg) expect(g.source_document_id).toBe(docId);
    const r = await findRun(sourceId);
    clean.push({ sourceId, jobId: r?.job_id ?? "", runId: r?.id ?? "" });
  });
});
