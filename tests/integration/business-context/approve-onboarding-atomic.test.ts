import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// B43 — Atomic onboarding v1 approval
//
// Proves against real Supabase that approve_onboarding_v1 is a single
// atomic SQL function: lock session → require ready_for_approval → compile
// profile from answered questions → validate sections → reject open conflicts
// → supersede current → publish sole current v1 → approve session → write audit.
// No sequential app calls. No partial state on failure.

const SUPABASE_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const WS = "b4300000-0000-0000-0000-000000000001";
const BIZ = "b4300000-0000-0000-0000-000000000002";
const ACTOR = "b4300000-0000-0000-0000-000000000003";

let supabase: SupabaseClient;

// Required dotted fact_keys — the approval RPC splits on '.' to build nested
// profile sections: { business: { name: … }, market: { primary: … }, … }
const REQUIRED_FACT_KEYS = [
  { fact_key: "business.name", answer: { value: "Acme Corp" } },
  { fact_key: "market.primary", answer: { value: "SMB" } },
  { fact_key: "advertising.primary_objective", answer: { value: "lead_gen" } },
  { fact_key: "business.primary_outcome", answer: { value: "revenue_growth" } },
  { fact_key: "economics.monthly_meta_budget", answer: { value: 5000 } },
];

// The SQL function validates these top-level sections exist in the compiled profile
const REQUIRED_SECTIONS = [
  "business",
  "market",
  "advertising",
  "economics",
];

beforeAll(async () => {
  if (!SUPABASE_KEY) return;
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
  await supabase.from("workspaces").upsert(
    { id: WS, name: "B43 Atomicity Workspace" },
    { onConflict: "id" },
  );
  await supabase.from("businesses").upsert(
    { id: BIZ, workspace_id: WS, name: "B43 Atomicity Business", status: "active" },
    { onConflict: "id" },
  );
});

afterAll(async () => {
  if (!supabase) return;
  await supabase.from("context_audit_log").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("business_profile_versions").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("context_conflicts").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("onboarding_questions").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("onboarding_sessions").delete().eq("workspace_id", WS).eq("business_id", BIZ);
});

beforeEach(async () => {
  if (!supabase) return;
  await supabase.from("context_audit_log").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("business_profile_versions").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("context_conflicts").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("onboarding_questions").delete().eq("workspace_id", WS).eq("business_id", BIZ);
  await supabase.from("onboarding_sessions").delete().eq("workspace_id", WS).eq("business_id", BIZ);
});

// ─── Helpers ───────────────────────────────────────────────────────────────

async function seedSession(status: string): Promise<string> {
  const { data, error } = await supabase
    .from("onboarding_sessions")
    .insert({
      workspace_id: WS,
      business_id: BIZ,
      status,
      current_step: "review",
      started_by: ACTOR,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw new Error(`seedSession: ${error.message}`);
  return data.id;
}

async function seedAnsweredQuestions(sessionId: string): Promise<void> {
  for (const { fact_key, answer } of REQUIRED_FACT_KEYS) {
    const { error } = await supabase.from("onboarding_questions").insert({
      workspace_id: WS,
      business_id: BIZ,
      session_id: sessionId,
      fact_key,
      question_type: "manual",
      question: `What about ${fact_key}?`,
      reason: "Required fact for onboarding",
      priority: 1,
      status: "answered",
      answer,
      answered_by: ACTOR,
      answered_at: new Date().toISOString(),
    });
    if (error) throw new Error(`seedAnsweredQuestions[${fact_key}]: ${error.message}`);
  }
}

async function countCurrentVersions(): Promise<number> {
  const { count, error } = await supabase
    .from("business_profile_versions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", WS)
    .eq("business_id", BIZ)
    .eq("status", "current");
  if (error) throw new Error(`countCurrentVersions: ${error.message}`);
  return count ?? 0;
}

async function listAuditEvents(): Promise<Array<{ event_type: string; entity_type: string; entity_id: string }>> {
  const { data, error } = await supabase
    .from("context_audit_log")
    .select("event_type, entity_type, entity_id")
    .eq("workspace_id", WS)
    .eq("business_id", BIZ);
  if (error) throw new Error(`listAuditEvents: ${error.message}`);
  return data ?? [];
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe.skipIf(!SUPABASE_KEY)(
  "Atomic onboarding v1 approval (B43) — real Supabase RPC",
  () => {
    it("approves session, publishes sole current v1, writes audit — all atomically", async () => {
      const sessionId = await seedSession("ready_for_approval");
      await seedAnsweredQuestions(sessionId);

      const { data, error } = await supabase.rpc("approve_onboarding_v1", {
        p_workspace_id: WS,
        p_business_id: BIZ,
        p_approver_id: ACTOR,
      });

      expect(error).toBeNull();
      expect(data).toBeTruthy();
      expect(data.ok).toBe(true, JSON.stringify(data));
      expect(data.data.version).toBe(1);
      expect(data.data.status).toBe("current");

      // Session moved to approved
      const { data: session } = await supabase
        .from("onboarding_sessions")
        .select("status, completed_at")
        .eq("id", sessionId)
        .single();
      expect(session?.status).toBe("approved");
      expect(session?.completed_at).toBeTruthy();

      // Exactly one current version
      expect(await countCurrentVersions()).toBe(1);

      // Audit events: profile approved + session approved
      const audits = await listAuditEvents();
      const eventTypes = audits.map((a) => a.event_type);
      expect(eventTypes).toContain("profile_version_approved");
      expect(eventTypes).toContain("onboarding_session_approved");
    });

    it("supersedes pre-existing current version — no duplicate current", async () => {
      const sessionId = await seedSession("ready_for_approval");
      await seedAnsweredQuestions(sessionId);

      // Seed an existing current version
      await supabase.from("business_profile_versions").insert({
        workspace_id: WS,
        business_id: BIZ,
        version: 1,
        profile: { business: { name: "old" } },
        status: "current",
        created_by: ACTOR,
      });

      const { data, error } = await supabase.rpc("approve_onboarding_v1", {
        p_workspace_id: WS,
        p_business_id: BIZ,
        p_approver_id: ACTOR,
      });

      expect(error).toBeNull();
      expect(data.ok).toBe(true);
      expect(data.data.version).toBe(2);

      // Exactly one current (the new one)
      expect(await countCurrentVersions()).toBe(1);

      // Old version superseded
      const { data: versions } = await supabase
        .from("business_profile_versions")
        .select("version, status")
        .eq("workspace_id", WS)
        .eq("business_id", BIZ)
        .order("version");
      expect(versions).toHaveLength(2);
      expect(versions![0].status).toBe("superseded");
      expect(versions![1].status).toBe("current");
    });

    it("rejects approval when session is not ready_for_approval", async () => {
      const sessionId = await seedSession("created");
      await seedAnsweredQuestions(sessionId);

      const { data, error } = await supabase.rpc("approve_onboarding_v1", {
        p_workspace_id: WS,
        p_business_id: BIZ,
        p_approver_id: ACTOR,
      });

      expect(error).toBeNull();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe("SESSION_NOT_READY");

      // No state changes
      expect(await countCurrentVersions()).toBe(0);
      const { data: session } = await supabase
        .from("onboarding_sessions")
        .select("status")
        .eq("id", sessionId)
        .single();
      expect(session?.status).toBe("created");
    });

    it("rejects approval when required sections are missing from questions", async () => {
      const sessionId = await seedSession("ready_for_approval");
      // Seed only 1 of 4 required sections (business.name → section "business")
      await supabase.from("onboarding_questions").insert({
        workspace_id: WS,
        business_id: BIZ,
        session_id: sessionId,
        fact_key: "business.name",
        question_type: "manual",
        question: "What is the business name?",
        reason: "Required",
        priority: 1,
        status: "answered",
        answer: { value: "Acme" },
        answered_by: ACTOR,
        answered_at: new Date().toISOString(),
      });

      const { data, error } = await supabase.rpc("approve_onboarding_v1", {
        p_workspace_id: WS,
        p_business_id: BIZ,
        p_approver_id: ACTOR,
      });

      expect(error).toBeNull();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe("PROFILE_INCOMPLETE");

      // No state changes
      expect(await countCurrentVersions()).toBe(0);
      const { data: session } = await supabase
        .from("onboarding_sessions")
        .select("status")
        .eq("id", sessionId)
        .single();
      expect(session?.status).toBe("ready_for_approval");
    });

    it("rejects approval when open conflicts exist", async () => {
      const sessionId = await seedSession("ready_for_approval");
      await seedAnsweredQuestions(sessionId);

      // Seed an open conflict
      await supabase.from("context_conflicts").insert({
        workspace_id: WS,
        business_id: BIZ,
        fact_key: "business.name",
        fact_ids: [],
        status: "open",
      });

      const { data, error } = await supabase.rpc("approve_onboarding_v1", {
        p_workspace_id: WS,
        p_business_id: BIZ,
        p_approver_id: ACTOR,
      });

      expect(error).toBeNull();
      expect(data.ok).toBe(false);
      expect(data.error.code).toBe("OPEN_CONFLICTS");

      // No state changes
      expect(await countCurrentVersions()).toBe(0);
    });

    it("rejects duplicate approval — session cannot be approved twice", async () => {
      const sessionId = await seedSession("ready_for_approval");
      await seedAnsweredQuestions(sessionId);

      // First approval succeeds
      const { data: data1, error: err1 } = await supabase.rpc("approve_onboarding_v1", {
        p_workspace_id: WS,
        p_business_id: BIZ,
        p_approver_id: ACTOR,
      });
      expect(err1).toBeNull();
      expect(data1.ok).toBe(true);

      // Second approval on same session fails (session no longer ready_for_approval)
      const { data: data2, error: err2 } = await supabase.rpc("approve_onboarding_v1", {
        p_workspace_id: WS,
        p_business_id: BIZ,
        p_approver_id: ACTOR,
      });
      expect(err2).toBeNull();
      expect(data2.ok).toBe(false);
      expect(data2.error.code).toBe("SESSION_NOT_READY");

      // Still exactly one current version
      expect(await countCurrentVersions()).toBe(1);
    });
  },
);
