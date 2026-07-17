/**
 * B44 — Onboarding user-flow E2E
 * Seed workspace+users → create business → onboarding → questions → answers →
 * draft → approve → context → compile → viewer 403s
 *
 * Seed: workspace + users/memberships only (service-role).
 * Business created via real API. No lifecycle/fact mutation after setup.
 * If API returns real blocker, report exact response and keep RED.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resetDatabase,
  createTestSession,
  createTestUser,
  getRandomPort,
  startApp,
  startWorker,
  pollForCondition,
  authenticatedFetch,
  cleanup,
} from "./harness";
import type { ProcessHandle } from "./types";

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const hasDeps = !!supabaseServiceKey && !!supabaseAnonKey;

function svc() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Mock injection path (absolute, for NODE_OPTIONS --import)
// ---------------------------------------------------------------------------

const mockPath = path.resolve(
  process.cwd(),
  "tests/e2e/business-context/firecrawl-fetch-mock.mjs",
);
// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe.skipIf(!hasDeps)(
  "B44 — onboarding user-flow: create → questions → answers → approve → context",
  () => {
    let port: number;
    let editorCookie: string;
    let adminCookie: string;
    let viewerCookie: string;
    let wsId: string;
    let ik = 0;
    let workerHandle: ProcessHandle | undefined;
    let prevNodeOptions: string | undefined;
    beforeAll(async () => {
      await resetDatabase();
      const c = svc();
      wsId = crypto.randomUUID();
      const { error: wsErr } = await c.from("workspaces").upsert({
        id: wsId,
        name: "B44 Test Workspace",
      });
      if (wsErr) throw new Error(`seed workspace: ${wsErr.message}`);

      const ed = await createTestUser({
        email: `b44-editor-${Date.now()}@e2e.test`,
        workspaceId: wsId,
        membershipRole: "editor",
      });
      editorCookie = await createTestSession({
        userId: ed.id,
        workspaceId: wsId,
        role: "editor",
      });

      const ad = await createTestUser({
        email: `b44-admin-${Date.now()}@e2e.test`,
        workspaceId: wsId,
        membershipRole: "admin",
      });
      adminCookie = await createTestSession({
        userId: ad.id,
        workspaceId: wsId,
        role: "admin",
      });

      const vw = await createTestUser({
        email: `b44-viewer-${Date.now()}@e2e.test`,
        workspaceId: wsId,
        membershipRole: "viewer",
      });
      viewerCookie = await createTestSession({
        userId: vw.id,
        workspaceId: wsId,
        role: "viewer",
      });

      port = getRandomPort();

      // Inject firecrawl mock into worker env before starting app/worker
      prevNodeOptions = process.env.NODE_OPTIONS;
      const importFlag = `--import ${mockPath}`;
      process.env.NODE_OPTIONS = prevNodeOptions
        ? `${prevNodeOptions} ${importFlag}`
        : importFlag;

      await startApp(port);
      workerHandle = await startWorker(getRandomPort());
    }, 120_000);

    afterAll(async () => {
      // Restore node options before cleanup
      if (prevNodeOptions !== undefined) {
        process.env.NODE_OPTIONS = prevNodeOptions;
      } else {
        delete process.env.NODE_OPTIONS;
      }
      await cleanup();
    });

    const base = () => `http://localhost:${port}`;
    const key = (tag: string) => `b44-${tag}-${Date.now()}-${++ik}`;

    it(
      "complete onboarding user-flow",
      { timeout: 60_000 },
      async () => {
        // ── 1. POST business (editor, PRD fields, no website, idempotency) ──
        const bizRes = await authenticatedFetch(`${base()}/api/businesses`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key("create"),
          },
          body: JSON.stringify({
            workspace_id: wsId,
            name: "B44 API Business",
            primary_market: "US SMBs",
            primary_advertising_objective: "Lead generation",
            primary_business_outcome: "Increase signups",
            approximate_monthly_meta_budget: 5000,
            website_url: null,
          }),
          authToken: editorCookie,
        });
        const bizText = await bizRes.text();
        let biz: Record<string, unknown>;
        try {
          biz = JSON.parse(bizText);
        } catch {
          expect.fail(
            `BLOCKER: POST /api/businesses → ${bizRes.status} (non-JSON body): ` +
            `"${bizText.substring(0, 300)}" — route's parseJsonBody consumes req body ` +
            `before withIdempotency can clone it (req.clone() throws after consumption)`,
          );
        }
        expect(
          bizRes.status,
          `POST /api/businesses → ${bizRes.status}: ${JSON.stringify(biz)}`,
        ).toBe(201);
        expect(biz.id).toBeTruthy();
        expect(biz.workspace_id).toBe(wsId);
        const bid: string = biz.id;

        // ── 1b. Register website source, process, poll until processed ────
        const srcRes = await authenticatedFetch(
          `${base()}/api/businesses/${bid}/context/sources`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key("src"),
            },
            body: JSON.stringify({
              source_type: "website",
              source_name: "Evidence site",
              external_reference: "https://example.com/",
            }),
            authToken: editorCookie,
          },
        );
        expect(
          srcRes.status,
          `POST /context/sources → ${srcRes.status}`,
        ).toBe(201);
        const srcBody = await srcRes.json();
        const sourceId: string = srcBody.id;
        expect(sourceId).toBeTruthy();

        // POST process route for the registered source
        const procRes = await authenticatedFetch(
          `${base()}/api/businesses/${bid}/context/sources/${sourceId}/process`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key("proc"),
            },
            body: JSON.stringify({}),
            authToken: editorCookie,
          },
        );
        expect(
          procRes.status,
          `POST source process → ${procRes.status}`,
        ).toBe(202);

        // Poll context_sources via service-role until processed
        const c2 = svc();
        await pollForCondition(async () => {
          const { data } = await c2
            .from("context_sources")
            .select("status")
            .eq("id", sourceId)
            .single();
          return (
            data?.status === "processed" ||
            data?.status === "processed_with_warnings"
          );
        }, 60_000, 1_000);

        // ── 2. Inspect persisted user_verified facts ────────────────────────
        const { data: facts } = await svc()
          .from("context_facts")
          .select("fact_key, value, verification_status")
          .eq("business_id", bid)
          .eq("workspace_id", wsId)
          .order("fact_key");
        expect(facts, "context_facts query returned null").toBeTruthy();
        expect(
          facts!.length,
          "expected user_verified facts from createBusiness",
        ).toBeGreaterThan(0);
        for (const f of facts!) {
          expect(f.verification_status).toBe("user_verified");
        }

        // ── 3. POST onboarding/start ×2 (idempotent) ────────────────────────
        const s1Res = await authenticatedFetch(
          `${base()}/api/businesses/${bid}/onboarding`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key("start1"),
            },
            body: JSON.stringify({}),
            authToken: editorCookie,
          },
        );
        const s1 = await s1Res.json();
        expect(
          s1Res.status,
          `POST onboarding/start → ${s1Res.status}: ${JSON.stringify(s1)}`,
        ).toBe(201);
        expect(s1.id).toBeTruthy();
        expect(["created","ready_for_approval"]).toContain(s1.status);
        expect(s1.business_id).toBe(bid);

        const s2Res = await authenticatedFetch(
          `${base()}/api/businesses/${bid}/onboarding`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key("start2"),
            },
            body: JSON.stringify({}),
            authToken: editorCookie,
          },
        );
        expect(s2Res.status).toBe(201);
        const s2 = await s2Res.json();
        expect(s2.id).toBe(s1.id);
        expect(["created","ready_for_approval"]).toContain(s2.status);
        expect(s2.status).toBe(s1.status);

        // ── 4. POST answers with all five required keys (unconditional) ─────
        const answersPayload = [
          { factKey: "business.name", answer: "B44 API Business" },
          { factKey: "market.primary", answer: "US SMBs" },
          { factKey: "advertising.primary_objective", answer: "Lead generation" },
          { factKey: "business.primary_outcome", answer: "Increase signups" },
          { factKey: "economics.monthly_meta_budget", answer: 5000 },
        ];
        const aRes = await authenticatedFetch(
          `${base()}/api/businesses/${bid}/onboarding/answers`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key("answers"),
            },
            body: JSON.stringify({ answers: answersPayload }),
            authToken: editorCookie,
          },
        );
        expect(
          aRes.status,
          `POST answers → ${aRes.status}`,
        ).toBe(200);
        expect((await aRes.json()).ok).toBe(true);

        // ── 4b. GET onboarding → ready_for_approval / approval ──────────────
        const sessRes = await authenticatedFetch(
          `${base()}/api/businesses/${bid}/onboarding`,
          { authToken: editorCookie },
        );
        expect(sessRes.status).toBe(200);
        const onbSess = await sessRes.json();
        expect(onbSess.status).toBe("ready_for_approval");
        expect(onbSess.current_step).toBe("approval");

        // ── 5. POST context/draft (editor) ──────────────────────────────────
        const draftRes = await authenticatedFetch(
          `${base()}/api/businesses/${bid}/context/draft`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key("draft"),
            },
            body: JSON.stringify({}),
            authToken: editorCookie,
          },
        );
        expect(
          draftRes.status,
          `POST context/draft → ${draftRes.status}`,
        ).toBe(200);
        const draft = await draftRes.json();
        expect(draft).toHaveProperty("profile");

        // ── 6. POST onboarding/approve (admin, idempotency) ──────────────────
        const apprRes = await authenticatedFetch(
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
        const apprBody = await apprRes.json();
        expect(
          apprRes.status,
          `BLOCKER: approve returned ${apprRes.status}: ${JSON.stringify(apprBody)}`,
        ).toBe(200);
        expect(apprBody.id).toBeTruthy();
        expect(apprBody.version).toBe(1);
        expect(apprBody.status).toBe("current");
        expect(apprBody.approved_by).toBeTruthy();

        // ── 7. GET context → current v1 ─────────────────────────────────────
        const ctxRes = await authenticatedFetch(
          `${base()}/api/businesses/${bid}/context`,
          { authToken: editorCookie },
        );
        expect(ctxRes.status).toBe(200);
        const ctx = await ctxRes.json();
        expect(ctx.version).toBe(1);
        expect(ctx.status).toBe("current");
        expect(ctx.profile).toBeTruthy();

        // ── 8. GET context/versions → sole v1 current ───────────────────────
        const verRes = await authenticatedFetch(
          `${base()}/api/businesses/${bid}/context/versions`,
          { authToken: editorCookie },
        );
        expect(verRes.status).toBe(200);
        const vers = await verRes.json();
        expect(vers.total).toBe(1);
        expect(vers.versions).toHaveLength(1);
        expect(vers.versions[0].version).toBe(1);
        expect(vers.versions[0].status).toBe("current");
        expect(vers.versions[0].approved_by).toBeTruthy();

        // ── 9. POST context/compile campaign_setup ──────────────────────────
        const cmpRes = await authenticatedFetch(
          `${base()}/api/businesses/${bid}/context/compile`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key("compile"),
            },
            body: JSON.stringify({ purpose: "campaign_setup" }),
            authToken: editorCookie,
          },
        );
        expect(
          cmpRes.status,
          `POST context/compile → ${cmpRes.status}`,
        ).toBe(200);
        expect(await cmpRes.json()).toBeTruthy();

        // ── 10. Service-role inspection: v1, session approved, audit ─────────
        const c = svc();
        const { data: sess } = await c
          .from("onboarding_sessions")
          .select("id, status, completed_at")
          .eq("business_id", bid)
          .eq("workspace_id", wsId);
        expect(sess).toHaveLength(1);
        expect(sess![0].status).toBe("approved");
        expect(sess![0].completed_at).toBeTruthy();

        const { data: dbVers } = await c
          .from("business_profile_versions")
          .select("version, status, approved_by, approved_at")
          .eq("business_id", bid)
          .eq("workspace_id", wsId)
          .order("version");
        expect(dbVers).toHaveLength(1);
        expect(dbVers![0].version).toBe(1);
        expect(dbVers![0].status).toBe("current");
        expect(dbVers![0].approved_by).toBeTruthy();
        expect(dbVers![0].approved_at).toBeTruthy();

        const { data: audit } = await c
          .from("context_audit_log")
          .select("event_type")
          .eq("business_id", bid)
          .eq("workspace_id", wsId);
        expect(
          audit!.some((e) => e.event_type === "profile_version_approved"),
        ).toBe(true);
        expect(
          audit!.some((e) => e.event_type === "onboarding_session_approved"),
        ).toBe(true);

        // ── 11. Viewer 403s (mutation only, after verified flow) ─────────────
        const viewer403 = async (path: string, body?: unknown) => {
          const r = await authenticatedFetch(
            `${base()}/api/businesses/${bid}${path}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": key(`vw-${path.replace(/\//g, "-")}`),
              },
              body: JSON.stringify(body ?? {}),
              authToken: viewerCookie,
            },
          );
          return r.status;
        };
        expect(await viewer403("/onboarding/approve")).toBe(403);
        expect(await viewer403("/context/draft")).toBe(403);
        expect(
          await viewer403("/context/compile", { purpose: "campaign_setup" }),
        ).toBe(403);
      },
    );
  },
);
