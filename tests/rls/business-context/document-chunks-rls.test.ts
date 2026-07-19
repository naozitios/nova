import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  run,
  WORKSPACE_A,
  WORKSPACE_B,
  BUSINESS_A,
  BUSINESS_B,
  SOURCE_A,
  SOURCE_B,
  initServiceClient,
  getServiceClient,
  createAuthUser,
  authedClient,
  seedWorkspaces,
  seedBusinesses,
  seedContextSources,
  cleanupUsers,
} from "./remediation-isolation-fixtures";

describe.skipIf(!run)("RLS — Document Chunks (workspace isolation)", () => {
  beforeAll(async () => {
    initServiceClient();
    const svc = getServiceClient();
    await svc.from("document_chunks").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await svc.from("source_documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await svc.from("context_facts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  });
  afterAll(() => cleanupUsers());

  const seedChunk = (workspaceId: string, businessId: string, sourceDocumentId: string) => ({
    workspace_id: workspaceId,
    business_id: businessId,
    source_document_id: sourceDocumentId,
    chunk_index: 0,
    heading_path: ["Introduction"],
    content: "Test chunk content",
    locator: { page: 1 },
    embedding: Array(1536).fill(0.1),
    embedding_model: "text-embedding-3-small",
  });

  it("authenticated user can SELECT chunks only for own workspace", async () => {
    await seedWorkspaces();
    await seedBusinesses();
    await seedContextSources();
    const svc = getServiceClient();

    const sourceDocA = {
      id: crypto.randomUUID(),
      workspace_id: WORKSPACE_A,
      business_id: BUSINESS_A,
      source_id: SOURCE_A,
      content_hash: "hash-a",
      metadata: {},
      retrieved_at: new Date().toISOString(),
    };
    const sourceDocB = {
      id: crypto.randomUUID(),
      workspace_id: WORKSPACE_B,
      business_id: BUSINESS_B,
      source_id: SOURCE_B,
      content_hash: "hash-b",
      metadata: {},
      retrieved_at: new Date().toISOString(),
    };
    await svc.from("source_documents").upsert([sourceDocA, sourceDocB]);

    const chunkA = seedChunk(WORKSPACE_A, BUSINESS_A, sourceDocA.id);
    const chunkB = seedChunk(WORKSPACE_B, BUSINESS_B, sourceDocB.id);
    await svc.from("document_chunks").upsert([chunkA, chunkB]);

    const userA = await createAuthUser(`chunk-user-a-${Date.now()}@test.example`);
    await svc.from("workspace_members").upsert([
      { workspace_id: WORKSPACE_A, user_id: userA.id, role: "owner" },
    ]);

    const clientA = authedClient(userA.jwt);
    const { data: rows, error } = await clientA.from("document_chunks").select("*");
    expect(error).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].workspace_id).toBe(WORKSPACE_A);
  });

  it("service role can INSERT/UPDATE/DELETE chunks", async () => {
    await seedWorkspaces();
    await seedBusinesses();
    await seedContextSources();
    const svc = getServiceClient();

    const sourceDoc = {
      id: crypto.randomUUID(),
      workspace_id: WORKSPACE_A,
      business_id: BUSINESS_A,
      source_id: SOURCE_A,
      content_hash: "hash-svc",
      metadata: {},
      retrieved_at: new Date().toISOString(),
    };
    await svc.from("source_documents").upsert(sourceDoc);

    const chunk = seedChunk(WORKSPACE_A, BUSINESS_A, sourceDoc.id);
    const { data: inserted, error: insertErr } = await svc
      .from("document_chunks")
      .insert(chunk)
      .select()
      .single();
    expect(insertErr).toBeNull();
    expect(inserted).not.toBeNull();

    const { error: updateErr } = await svc
      .from("document_chunks")
      .update({ content: "Updated content" })
      .eq("id", inserted.id);
    expect(updateErr).toBeNull();

    const { error: deleteErr } = await svc.from("document_chunks").delete().eq("id", inserted.id);
    expect(deleteErr).toBeNull();
  });
});
