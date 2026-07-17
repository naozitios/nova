import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  authenticatedFetch,
  cleanup,
  createTestSession,
  createTestUser,
  getRandomPort,
  pollForCondition,
  resetDatabase,
  startApp,
  startWorker,
} from "./harness";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const hasDeps = !!supabaseServiceKey && !!supabaseAnonKey;

const wsId = "b14e11e0-0000-0000-0000-000000000001";
const bizId = "b14e11e0-0000-0000-0000-000000000002";

function svcClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

async function seedSource(input: {
  sourceType: string;
  sourceName: string;
  externalReference?: string | null;
  metadata: Record<string, unknown>;
}) {
  const id = randomUUID();
  const { error } = await svcClient().from("context_sources").insert({
    id,
    workspace_id: wsId,
    business_id: bizId,
    source_type: input.sourceType,
    source_name: input.sourceName,
    external_reference: input.externalReference ?? null,
    status: "registered",
    current_stage: null,
    terminal_outcome: null,
    metadata: input.metadata,
  });
  if (error) throw new Error(`seed source: ${error.message}`);
  return id;
}

async function queueSource(baseUrl: string, sourceId: string, sessionCookie: string) {
  const res = await authenticatedFetch(
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
  expect(res.status).toBe(202);
  return (await res.json()) as { id: string };
}

async function readSource(sourceId: string) {
  const { data, error } = await svcClient()
    .from("context_sources")
    .select("status, terminal_outcome")
    .eq("id", sourceId)
    .single();
  if (error) throw error;
  return data as { status: string; terminal_outcome: string | null };
}

async function readJob(jobId: string) {
  const { data, error } = await svcClient()
    .from("context_jobs")
    .select("status, error_class, locked_by, locked_at, heartbeat_at")
    .eq("id", jobId)
    .single();
  if (error) throw error;
  return data as {
    status: string;
    error_class: string | null;
    locked_by: string | null;
    locked_at: string | null;
    heartbeat_at: string | null;
  };
}

async function readRunForSource(sourceId: string) {
  const { data, error } = await svcClient()
    .from("context_processing_runs")
    .select("id, status, current_stage, terminal_outcome, facts_extracted")
    .eq("source_id", sourceId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as null | {
    id: string;
    status: string;
    current_stage: string;
    terminal_outcome: string | null;
    facts_extracted: number;
  };
}

async function readStageEvents(runId: string) {
  const { data, error } = await svcClient()
    .from("context_processing_stage_events")
    .select("stage, status, error_class, metadata")
    .eq("run_id", runId)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return data as Array<{
    stage: string;
    status: string;
    error_class: string | null;
    metadata: Record<string, unknown> | null;
  }>;
}

describe.skipIf(!hasDeps)("B14 Wave 11 source-worker resilience E2E", () => {
  let appPort: number;
  let workerPort: number;
  let sessionCookie: string;
  const originalNodeOptions = process.env.NODE_OPTIONS;

  beforeAll(async () => {
    await resetDatabase();

    const client = svcClient();
    const { error: wsErr } = await client.from("workspaces").upsert({
      id: wsId,
      name: "B14 Wave 11 Workspace",
    });
    if (wsErr) throw new Error(`seed workspace: ${wsErr.message}`);

    const { error: bizErr } = await client.from("businesses").upsert({
      id: bizId,
      workspace_id: wsId,
      name: "B14 Wave 11 Business",
    });
    if (bizErr) throw new Error(`seed business: ${bizErr.message}`);

    const user = await createTestUser({
      email: `b14-wave11-${Date.now()}@e2e.test`,
      workspaceId: wsId,
      membershipRole: "editor",
    });
    sessionCookie = await createTestSession({
      userId: user.id,
      workspaceId: wsId,
      role: "editor",
    });

    appPort = getRandomPort();
    workerPort = getRandomPort();
    const mockPath = fileURLToPath(new URL("./firecrawl-fetch-mock.mjs", import.meta.url));
    process.env.NODE_OPTIONS = `${originalNodeOptions ?? ""} --import ${mockPath}`.trim();
    await startApp(appPort);
    await startWorker(workerPort);
  }, 120_000);

  afterAll(async () => {
    if (originalNodeOptions === undefined) delete process.env.NODE_OPTIONS;
    else process.env.NODE_OPTIONS = originalNodeOptions;
    await cleanup();
  });

  it("B14d blocks unresolved OCR sources with skipped stages and no facts", { timeout: 60_000 }, async () => {
    const sourceId = await seedSource({
      sourceType: "product_document",
      sourceName: "Scanned product deck",
      metadata: { ocrRequired: true, ocrResolved: false },
    });

    const { id: jobId } = await queueSource(`http://localhost:${appPort}`, sourceId, sessionCookie);

    const source = await pollForCondition(async () => {
      const current = await readSource(sourceId);
      return current.status === "blocked_needs_user_action" ? current : null;
    }, 30_000, 500);
    expect(source?.terminal_outcome).toBe("blocked_needs_user_action");

    const run = await pollForCondition(async () => {
      const current = await readRunForSource(sourceId);
      return current?.terminal_outcome === "blocked_needs_user_action" ? current : null;
    }, 10_000, 500);
    expect(run?.status).toBe("blocked");
    expect(run?.facts_extracted).toBe(0);

    const events = await readStageEvents(run!.id);
    const skipped = events.filter((event) => event.status === "skipped");
    expect(skipped.length).toBeGreaterThanOrEqual(5);
    expect(skipped.every((event) => event.metadata?.reason === "ocr_blocked")).toBe(true);

    const job = await readJob(jobId);
    expect(job.status).toBe("failed_permanent");
    expect(job.locked_by).toBeNull();
    expect(job.locked_at).toBeNull();
    expect(job.heartbeat_at).toBeNull();
  });

  it("B14e stops website processing when page budget is exceeded", { timeout: 60_000 }, async () => {
    const sourceId = await seedSource({
      sourceType: "website",
      sourceName: "Budgeted website",
      externalReference: "https://example.com/",
      metadata: { approvedDomains: ["example.com"], maxPages: 1 },
    });

    const { id: jobId } = await queueSource(`http://localhost:${appPort}`, sourceId, sessionCookie);

    const run = await pollForCondition(async () => {
      const current = await readRunForSource(sourceId);
      return current?.terminal_outcome === "failed_permanent" ? current : null;
    }, 30_000, 500);
    expect(run?.status).toBe("failed");
    expect(run?.terminal_outcome).toBe("failed_permanent");

    const job = await readJob(jobId);
    expect(job.status).toBe("failed_permanent");
    expect(job.error_class).toBe("budget_exceeded");
    expect(job.locked_by).toBeNull();
    expect(job.locked_at).toBeNull();
    expect(job.heartbeat_at).toBeNull();

    const source = await readSource(sourceId);
    expect(source.status).toBe("failed_permanent");
    expect(source.terminal_outcome).toBe("failed_permanent");

    const events = await readStageEvents(run!.id);
    expect(events.some((event) => event.status === "failed_permanent" && event.error_class === "budget_exceeded")).toBe(true);
  });
});
