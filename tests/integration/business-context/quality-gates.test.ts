import { describe, expect, it } from "vitest";
import {
  canRun,
  getClient,
  track,
  cleanup,
  TEST_WORKSPACE,
  TEST_BUSINESS,
  TEST_USER,
} from "./supabase-helpers";

// ── Quality gate results ───────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — context_quality_gate_results", () => {
  it("creates and reads a quality gate result", async () => {
    const client = getClient();
    const gateId = crypto.randomUUID();
    track("context_quality_gate_results", gateId);

    const { error: insertError } = await client
      .from("context_quality_gate_results")
      .insert({
        id: gateId,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        gate_scope: "document",
        gate_name: "mime_validation",
        status: "passed",
      });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_quality_gate_results")
      .select("*")
      .eq("id", gateId)
      .single();

    expect(readError).toBeNull();
    expect(data!.gate_scope).toBe("document");
    expect(data!.status).toBe("passed");

    await cleanup("context_quality_gate_results", gateId);
  });
});

// ── Circuit breakers ───────────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — context_provider_circuit_breakers", () => {
  it("creates and reads a circuit breaker record", async () => {
    const client = getClient();
    const cbId = crypto.randomUUID();
    track("context_provider_circuit_breakers", cbId);

    const { error: insertError } = await client
      .from("context_provider_circuit_breakers")
      .insert({
        id: cbId,
        workspace_id: TEST_WORKSPACE,
        provider: "firecrawl",
        state: "closed",
        failure_count: 0,
        success_count: 0,
        timeout_count: 0,
        quota_exhausted: false,
      });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_provider_circuit_breakers")
      .select("*")
      .eq("id", cbId)
      .single();

    expect(readError).toBeNull();
    expect(data!.provider).toBe("firecrawl");
    expect(data!.state).toBe("closed");

    await cleanup("context_provider_circuit_breakers", cbId);
  });
});

// ── Audit log ──────────────────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — context_audit_log", () => {
  it("creates and reads an audit log entry", async () => {
    const client = getClient();
    const auditId = crypto.randomUUID();
    track("context_audit_log", auditId);

    const { error: insertError } = await client.from("context_audit_log").insert({
      id: auditId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      actor_id: TEST_USER,
      actor_type: "user",
      event_type: "profile.approved",
      entity_type: "business_profile_versions",
      entity_id: crypto.randomUUID(),
      after: { status: "current" },
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_audit_log")
      .select("*")
      .eq("id", auditId)
      .single();

    expect(readError).toBeNull();
    expect(data!.event_type).toBe("profile.approved");
    expect(data!.actor_type).toBe("user");

    await cleanup("context_audit_log", auditId);
  });
});
