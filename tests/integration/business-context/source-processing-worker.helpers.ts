import { beforeAll, beforeEach, afterEach } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { JobRunner } from "@/infrastructure/business-context/job-runner/job-runner";
import type { RepositoryPort } from "@/core/business-context/repository.port";
import { SupabaseRepository } from "@/infrastructure/business-context/supabase.repository";

// ---------------------------------------------------------------------------
// Shared setup for source-processing-worker test suite.
// Real Supabase database + real JobRunner instances.
// ---------------------------------------------------------------------------

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
export const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY;

export const TEST_WORKSPACE = "30000000-0000-0000-0000-000000000001";
export const TEST_BUSINESS = "30000000-0000-0000-0000-000000000002";

let _client: SupabaseClient | null = null;
let _repo: RepositoryPort | null = null;

export function getClient(): SupabaseClient {
  if (!_client) throw new Error("Supabase client not initialized");
  return _client;
}

export function getRepo(): RepositoryPort {
  if (!_repo) throw new Error("Repository not initialized");
  return _repo;
}

beforeAll(() => {
  if (supabaseServiceKey) {
    _client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
    _repo = new SupabaseRepository(_client);
  }
});

// Track created rows for cleanup
const createdJobs: string[] = [];

// Seed parent rows idempotently, then clean up jobs.
// E2E reset can wipe seed.sql fixtures; re-seeding here keeps FK constraints satisfied.
beforeEach(async () => {
  if (!_client) return;

  // Workspace (FK target for context_jobs.workspace_id)
  const { error: wsErr } = await _client
    .from("workspaces")
    .upsert({ id: TEST_WORKSPACE, name: "Job Lifecycle Test Workspace" }, { onConflict: "id" });
  if (wsErr) throw wsErr;

  // Business (FK target for context_jobs.business_id)
  const { error: bizErr } = await _client
    .from("businesses")
    .upsert(
      { id: TEST_BUSINESS, workspace_id: TEST_WORKSPACE, name: "Job Lifecycle Test Business", website_url: "https://jl.example.com", status: "active" },
      { onConflict: "id" },
    );
  if (bizErr) throw bizErr;

  // Clean up test jobs
  const { error } = await _client
    .from("context_jobs")
    .delete()
    .like("idempotency_key", "t015-%");
  if (error) throw error;
});

afterEach(async () => {
  if (!_client) return;
  for (const id of [...createdJobs].reverse()) {
    await _client.from("context_jobs").delete().eq("id", id);
  }
  createdJobs.length = 0;
});

export function track(id: string) {
  createdJobs.push(id);
}

export async function insertJob(
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const id = crypto.randomUUID();
  track(id);
  const { error } = await _client!.from("context_jobs").insert({
    id,
    workspace_id: TEST_WORKSPACE,
    business_id: TEST_BUSINESS,
    job_type: "crawl_website",
    status: "queued",
    attempt_count: 0,
    max_attempts: 4,
    idempotency_key: `t015-${id}`,
    input: { url: "https://example.com" },
    retry_policy: {},
    stage_timeout_seconds: 60,
    ...overrides,
  });
  if (error) throw error;
  return id;
}

export async function readJob(id: string) {
  const { data, error } = await _client!
    .from("context_jobs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export function createWorker(
  workerId: string,
  opts: Partial<ConstructorParameters<typeof JobRunner>[1]> = {},
) {
  return new JobRunner(_repo!, {
    pollIntervalMs: 100,
    batchSize: 1,
    workerId,
    maxConcurrency: 5,
    stallSweepIntervalMs: 60_000,
    ...opts,
  });
}
