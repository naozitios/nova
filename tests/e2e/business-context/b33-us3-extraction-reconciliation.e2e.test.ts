/**
 * B33 — US3 extraction/reconciliation/questions E2E.
 * Real HTTP, NextAuth session, Supabase, worker, Firecrawl fetch mock,
 * deterministic OpenRouter fetch mock. No direct lifecycle table mutation.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
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
import type { ProcessHandle } from "./types";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const hasDeps = !!supabaseServiceKey && !!supabaseAnonKey;

const mockPath = path.resolve(
  process.cwd(),
  "tests/e2e/business-context/firecrawl-fetch-mock.mjs",
);

function svc() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

describe.skipIf(!hasDeps)("B33 — extraction creates conflict, question, blocker", () => {
  let port: number;
  let editorCookie: string;
  let adminCookie: string;
  let wsId: string;
  let workerHandle: ProcessHandle | undefined;
  let prevNodeOptions: string | undefined;
  let prevFirecrawlKey: string | undefined;
  let prevOpenRouterKey: string | undefined;
  let prevOpenRouterModel: string | undefined;
  let ik = 0;

  beforeAll(async () => {
    await resetDatabase();

    const c = svc();
    wsId = crypto.randomUUID();
    const { error: wsErr } = await c.from("workspaces").upsert({
      id: wsId,
      name: "B33 Test Workspace",
    });
    if (wsErr) throw new Error(`seed workspace: ${wsErr.message}`);

    const editor = await createTestUser({
      email: `b33-editor-${Date.now()}@e2e.test`,
      workspaceId: wsId,
      membershipRole: "editor",
    });
    editorCookie = await createTestSession({
      userId: editor.id,
      workspaceId: wsId,
      role: "editor",
    });

    const admin = await createTestUser({
      email: `b33-admin-${Date.now()}@e2e.test`,
      workspaceId: wsId,
      membershipRole: "admin",
    });
    adminCookie = await createTestSession({
      userId: admin.id,
      workspaceId: wsId,
      role: "admin",
    });

    prevNodeOptions = process.env.NODE_OPTIONS;
    prevFirecrawlKey = process.env.FIRECRAWL_API_KEY;
    prevOpenRouterKey = process.env.OPENROUTER_API_KEY;
    prevOpenRouterModel = process.env.OPENROUTER_MODEL;

    const importFlag = `--import ${mockPath}`;
    process.env.NODE_OPTIONS = prevNodeOptions
      ? `${prevNodeOptions} ${importFlag}`
      : importFlag;
    process.env.FIRECRAWL_API_KEY = "e2e-firecrawl";
    process.env.OPENROUTER_API_KEY = "e2e-openrouter";
    process.env.OPENROUTER_MODEL = "e2e-deterministic";

    port = getRandomPort();
    await startApp(port);
    workerHandle = await startWorker(getRandomPort());
  }, 120_000);

  afterAll(async () => {
    void workerHandle;
    if (prevNodeOptions !== undefined) process.env.NODE_OPTIONS = prevNodeOptions;
    else delete process.env.NODE_OPTIONS;
    if (prevFirecrawlKey !== undefined) process.env.FIRECRAWL_API_KEY = prevFirecrawlKey;
    else delete process.env.FIRECRAWL_API_KEY;
    if (prevOpenRouterKey !== undefined) process.env.OPENROUTER_API_KEY = prevOpenRouterKey;
    else delete process.env.OPENROUTER_API_KEY;
    if (prevOpenRouterModel !== undefined) process.env.OPENROUTER_MODEL = prevOpenRouterModel;
    else delete process.env.OPENROUTER_MODEL;
    await cleanup();
  });

  const base = () => `http://localhost:${port}`;
  const key = (tag: string) => `b33-${tag}-${Date.now()}-${++ik}`;

  async function createBusiness(): Promise<string> {
    const res = await authenticatedFetch(`${base()}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key("business"),
      },
      body: JSON.stringify({
        workspace_id: wsId,
        name: "B33 Canonical Business",
        primary_market: "Evidence-led operators",
        primary_advertising_objective: "Lead generation",
        primary_business_outcome: "Increase qualified pipeline",
        approximate_monthly_meta_budget: 7500,
        website_url: null,
      }),
      authToken: editorCookie,
    });
    const body = await res.json();
    expect(res.status, `POST /api/businesses: ${JSON.stringify(body)}`).toBe(201);
    return body.id as string;
  }

  it(
    "processes extracted facts into one conflict, one question, and approval blocker",
    { timeout: 90_000 },
    async () => {
      const bid = await createBusiness();

      const sessionRes = await authenticatedFetch(`${base()}/api/businesses/${bid}/onboarding`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key("session"),
        },
        body: JSON.stringify({}),
        authToken: editorCookie,
      });
      const session = await sessionRes.json();
      expect(sessionRes.status, `POST onboarding: ${JSON.stringify(session)}`).toBe(201);
      expect(session.id).toBeTruthy();

      const sourceRes = await authenticatedFetch(
        `${base()}/api/businesses/${bid}/context/sources`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key("source"),
          },
          body: JSON.stringify({
            source_type: "website",
            source_name: "B33 conflicting website evidence",
            external_reference: "https://example.com/",
          }),
          authToken: editorCookie,
        },
      );
      const source = await sourceRes.json();
      expect(sourceRes.status, `POST source: ${JSON.stringify(source)}`).toBe(201);

      const processRes = await authenticatedFetch(
        `${base()}/api/businesses/${bid}/context/sources/${source.id}/process`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key("process"),
          },
          body: JSON.stringify({}),
          authToken: editorCookie,
        },
      );
      const processBody = await processRes.json();
      expect(processRes.status, `POST process: ${JSON.stringify(processBody)}`).toBe(202);

      await pollForCondition(async () => {
        const { data } = await svc()
          .from("context_sources")
          .select("status")
          .eq("id", source.id)
          .single();
        return data?.status === "processed" || data?.status === "processed_with_warnings"
          ? data
          : null;
      }, 60_000, 1_000);

      const conflictsRes = await authenticatedFetch(
        `${base()}/api/businesses/${bid}/context/conflicts?status=open`,
        { authToken: editorCookie },
      );
      const conflicts = await conflictsRes.json();
      expect(conflictsRes.status, `GET conflicts: ${JSON.stringify(conflicts)}`).toBe(200);
      expect(conflicts.total).toBe(1);
      expect(conflicts.items[0].factKey).toBe("business.name");

      const reconcileRes = await authenticatedFetch(
        `${base()}/api/businesses/${bid}/context/reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key("reconcile"),
          },
          body: JSON.stringify({}),
          authToken: editorCookie,
        },
      );
      const reconcile = await reconcileRes.json();
      expect(reconcileRes.status, `POST reconcile: ${JSON.stringify(reconcile)}`).toBe(202);
      expect(reconcile.open_conflicts).toBe(1);

      const questionsRes = await authenticatedFetch(
        `${base()}/api/businesses/${bid}/onboarding/questions`,
        { authToken: editorCookie },
      );
      const questions = await questionsRes.json();
      expect(questionsRes.status, `GET questions: ${JSON.stringify(questions)}`).toBe(200);
      expect(questions.questions).toHaveLength(1);
      expect(questions.questions[0].fact_key).toBe("customers.target_segment");

      const approvalRes = await authenticatedFetch(
        `${base()}/api/businesses/${bid}/onboarding/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key("approve"),
          },
          body: JSON.stringify({}),
          authToken: adminCookie,
        },
      );
      const approval = await approvalRes.json();
      expect(approvalRes.status, `POST approve: ${JSON.stringify(approval)}`).toBe(409);
      expect(approval.error?.code).toBe("OPEN_CONFLICTS");
    },
  );
});
