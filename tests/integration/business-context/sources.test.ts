import { describe, expect, it } from "vitest";
import {
  canRun,
  getClient,
  track,
  cleanup,
  TEST_WORKSPACE,
  TEST_BUSINESS,
} from "./supabase-helpers";

// ── Source persistence ─────────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — context_sources", () => {
  it("creates and reads a context source", async () => {
    const client = getClient();
    const sourceId = crypto.randomUUID();
    track("context_sources", sourceId);

    const { error: insertError } = await client.from("context_sources").insert({
      id: sourceId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_type: "website",
      source_name: "Company Website",
      status: "registered",
      metadata: {},
      collected_at: new Date().toISOString(),
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("context_sources")
      .select("*")
      .eq("id", sourceId)
      .single();

    expect(readError).toBeNull();
    expect(data).toBeDefined();
    expect(data!.source_type).toBe("website");
    expect(data!.source_name).toBe("Company Website");
    expect(data!.status).toBe("registered");

    await cleanup("context_sources", sourceId);
  });

  it("atomically archives a source — returns row when status != archived", async () => {
    const client = getClient();
    const sourceId = crypto.randomUUID();
    track("context_sources", sourceId);
    await client.from("context_sources").insert({
      id: sourceId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_type: "website",
      source_name: "Archive Test Source",
      status: "processed",
      metadata: {},
      collected_at: new Date().toISOString(),
    });

    const { data, error } = await client
      .from("context_sources")
      .update({ status: "archived", terminal_outcome: "archived" })
      .eq("workspace_id", TEST_WORKSPACE)
      .eq("id", sourceId)
      .neq("status", "archived")
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data!.status).toBe("archived");

    await cleanup("context_sources", sourceId);
  });

  it("atomic archive returns error when source is already archived", async () => {
    const client = getClient();
    const sourceId = crypto.randomUUID();
    track("context_sources", sourceId);
    await client.from("context_sources").insert({
      id: sourceId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_type: "website",
      source_name: "Already Archived Source",
      status: "archived",
      metadata: {},
      collected_at: new Date().toISOString(),
    });

    const { data, error } = await client
      .from("context_sources")
      .update({ status: "archived", terminal_outcome: "archived" })
      .eq("workspace_id", TEST_WORKSPACE)
      .eq("id", sourceId)
      .neq("status", "archived")
      .select()
      .single();

    // Supabase returns PGRST116 when no rows match the filter
    expect(error).toBeDefined();
    expect(error!.code).toBe("PGRST116");

    await cleanup("context_sources", sourceId);
  });
});

// ── Source documents ───────────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — source_documents", () => {
  it("creates and reads a source document", async () => {
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

    const docId = crypto.randomUUID();
    track("source_documents", docId);

    const { error: insertError } = await client.from("source_documents").insert({
      id: docId,
      workspace_id: TEST_WORKSPACE,
      business_id: TEST_BUSINESS,
      source_id: sourceId,
      url: "https://example.com/page",
      title: "Test Page",
      content_text: "# Test Content",
      content_hash: "sha256:abc123",
      retrieved_at: new Date().toISOString(),
    });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("source_documents")
      .select("*")
      .eq("id", docId)
      .single();

    expect(readError).toBeNull();
    expect(data!.content_hash).toBe("sha256:abc123");

    await cleanup("source_documents", docId);
    await cleanup("context_sources", sourceId);
  });
});
