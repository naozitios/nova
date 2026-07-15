import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  run,
  initServiceClient,
  getServiceClient,
  seedWorkspaces,
  seedBusinesses,
  testRlsMatrix,
  cleanupUsers,
} from "./remediation-isolation-fixtures";

// ---------------------------------------------------------------------------
// Modified + existing tables — RLS matrix
// Uses per-test dynamic UUIDs to avoid seed collisions across runs.
// ---------------------------------------------------------------------------

describe.skipIf(!run)("RLS — Modified & Existing Tables", () => {
  beforeAll(() => initServiceClient());
  afterAll(() => cleanupUsers());

  // -----------------------------------------------------------------------
  // onboarding_sessions (modified)
  // -----------------------------------------------------------------------
  describe("onboarding_sessions (modified)", () => {
    it("enforces workspace-scoped access by role", async () => {
      const wsId = crypto.randomUUID();
      const bizId = crypto.randomUUID();
      const svc = getServiceClient();
      await svc.from("workspaces").upsert({ id: wsId, name: `WS-${wsId.slice(0,8)}` });
      await svc.from("businesses").upsert({ id: bizId, workspace_id: wsId, name: `Biz-${bizId.slice(0,8)}`, status: "active" });

      await testRlsMatrix(
        "onboarding_sessions",
        {
          id: crypto.randomUUID(),
          workspace_id: wsId,
          business_id: bizId,
          status: "created",
          mode: "initial",
          started_by: "00000000-0000-0000-0000-000000000001",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // onboarding_questions (modified)
  // -----------------------------------------------------------------------
  describe("onboarding_questions (modified)", () => {
    it("enforces workspace-scoped access by role", async () => {
      const wsId = crypto.randomUUID();
      const bizId = crypto.randomUUID();
      const sessId = crypto.randomUUID();
      const svc = getServiceClient();
      await svc.from("workspaces").upsert({ id: wsId, name: `WS-${wsId.slice(0,8)}` });
      await svc.from("businesses").upsert({ id: bizId, workspace_id: wsId, name: `Biz-${bizId.slice(0,8)}`, status: "active" });
      await svc.from("onboarding_sessions").upsert({
        id: sessId, workspace_id: wsId, business_id: bizId,
        status: "awaiting_review", started_by: "00000000-0000-0000-0000-000000000001",
      });

      await testRlsMatrix(
        "onboarding_questions",
        {
          id: crypto.randomUUID(),
          workspace_id: wsId,
          session_id: sessId,
          business_id: bizId,
          fact_key: "business.name",
          question_type: "single_choice",
          question: "What is your business name?",
          reason: "gap",
          priority: 10,
          status: "open",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // business_profile_versions (modified)
  // -----------------------------------------------------------------------
  describe("business_profile_versions (modified)", () => {
    it("enforces workspace-scoped access by role", async () => {
      const wsId = crypto.randomUUID();
      const bizId = crypto.randomUUID();
      const svc = getServiceClient();
      await svc.from("workspaces").upsert({ id: wsId, name: `WS-${wsId.slice(0,8)}` });
      await svc.from("businesses").upsert({ id: bizId, workspace_id: wsId, name: `Biz-${bizId.slice(0,8)}`, status: "active" });

      await testRlsMatrix(
        "business_profile_versions",
        {
          id: crypto.randomUUID(),
          workspace_id: wsId,
          business_id: bizId,
          version: 1,
          profile: { business: {}, offers: {}, customers: {}, conversion_journey: {}, economics: {}, brand: {}, creative_capacity: {}, measurement: {} },
          status: "draft",
          created_by: "00000000-0000-0000-0000-000000000001",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // context_conflicts (existing)
  // -----------------------------------------------------------------------
  describe("context_conflicts (existing)", () => {
    it("enforces workspace-scoped access by role", async () => {
      const wsId = crypto.randomUUID();
      const bizId = crypto.randomUUID();
      const svc = getServiceClient();
      await svc.from("workspaces").upsert({ id: wsId, name: `WS-${wsId.slice(0,8)}` });
      await svc.from("businesses").upsert({ id: bizId, workspace_id: wsId, name: `Biz-${bizId.slice(0,8)}`, status: "active" });

      await testRlsMatrix(
        "context_conflicts",
        {
          id: crypto.randomUUID(),
          workspace_id: wsId,
          business_id: bizId,
          fact_key: "business.founded_year",
          fact_ids: [],
          status: "open",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // context_sources (existing)
  // -----------------------------------------------------------------------
  describe("context_sources (existing)", () => {
    it("enforces workspace-scoped access by role", async () => {
      const wsId = crypto.randomUUID();
      const bizId = crypto.randomUUID();
      const svc = getServiceClient();
      await svc.from("workspaces").upsert({ id: wsId, name: `WS-${wsId.slice(0,8)}` });
      await svc.from("businesses").upsert({ id: bizId, workspace_id: wsId, name: `Biz-${bizId.slice(0,8)}`, status: "active" });

      await testRlsMatrix(
        "context_sources",
        {
          id: crypto.randomUUID(),
          workspace_id: wsId,
          business_id: bizId,
          source_type: "website",
          source_name: "Test Website",
          status: "registered",
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });

  // -----------------------------------------------------------------------
  // context_jobs (existing)
  // -----------------------------------------------------------------------
  describe("context_jobs (existing)", () => {
    it("enforces workspace-scoped access by role", async () => {
      const wsId = crypto.randomUUID();
      const bizId = crypto.randomUUID();
      const svc = getServiceClient();
      await svc.from("workspaces").upsert({ id: wsId, name: `WS-${wsId.slice(0,8)}` });
      await svc.from("businesses").upsert({ id: bizId, workspace_id: wsId, name: `Biz-${bizId.slice(0,8)}`, status: "active" });

      await testRlsMatrix(
        "context_jobs",
        {
          id: crypto.randomUUID(),
          workspace_id: wsId,
          business_id: bizId,
          job_type: "crawl_website",
          status: "queued",
          idempotency_key: `idem-job-${crypto.randomUUID()}`,
          input: { url: "https://example.com" },
        },
        [],
        {
          ownerA: "allowed",
          editorA: "allowed",
          viewerA: "allowed",
          ownerB: "denied",
          unauth: "denied",
        },
      );
    });
  });
});
