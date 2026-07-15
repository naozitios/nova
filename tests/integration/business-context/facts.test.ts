import { describe, expect, it } from "vitest";
import {
  canRun,
  getClient,
  track,
  cleanup,
  TEST_WORKSPACE,
  TEST_BUSINESS,
} from "./supabase-helpers";

// ── Facts ──────────────────────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — context_facts", () => {
  it("creates and reads a context fact", async () => {
    const client = getClient();
    const sourceId = crypto.randomUUID();
    track("context_sources", sourceId);
    await client.from("context_sources").insert({
      id: sourceId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_type: "website",
      source_name: "Test Source",
      status: "registered",
      metadata: {},
      collected_at: new Date().toISOString(),
    });

    const factId = crypto.randomUUID();
    track("context_facts", factId);

    const { error: insertError } = await client.from("context_facts").insert({
      id: factId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      fact_key: "offers.primary.name",
      value: { name: "Test Product" },
      source_id: sourceId,
      confidence: 0.85,
      verification_status: "extracted",
      valid_from: new Date().toISOString(),
      created_by: "system",
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_facts")
      .select("*")
      .eq("id", factId)
      .single();

    expect(readError).toBeNull();
    expect(data!.fact_key).toBe("offers.primary.name");
    expect(Number(data!.confidence)).toBeCloseTo(0.85);

    await cleanup("context_facts", factId);
    await cleanup("context_sources", sourceId);
  });
});

// ── Conflicts ──────────────────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — context_conflicts", () => {
  it("creates and reads a conflict record", async () => {
    const client = getClient();
    const conflictId = crypto.randomUUID();
    track("context_conflicts", conflictId);

    const { error: insertError } = await client.from("context_conflicts").insert({
      id: conflictId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      fact_key: "offers.primary.price",
      fact_ids: [crypto.randomUUID(), crypto.randomUUID()],
      status: "open",
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_conflicts")
      .select("*")
      .eq("id", conflictId)
      .single();

    expect(readError).toBeNull();
    expect(data!.status).toBe("open");
    expect(data!.fact_ids).toHaveLength(2);

    await cleanup("context_conflicts", conflictId);
  });
});
