import { describe, expect, it, vi, beforeEach } from "vitest";
import { SourceRepository } from "./source.repository";

function makeMockSupabase() {
  const mockSingle = vi.fn();

  // Chain: from().update().eq().eq().neq().select().single()
  const selectChain = { single: mockSingle };
  const neqChain = { select: vi.fn().mockReturnValue(selectChain) };
  const eq3Chain = { neq: vi.fn().mockReturnValue(neqChain) };
  const eq2Chain = { eq: vi.fn().mockReturnValue(eq3Chain) };
  const eq1Chain = { eq: vi.fn().mockReturnValue(eq2Chain) };
  const mockUpdate = vi.fn().mockReturnValue(eq1Chain);
  const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });

  return {
    from: mockFrom,
    _mocks: { mockSingle, mockUpdate, eq1Chain, eq2Chain, eq3Chain, neqChain },
  };
}

describe("SourceRepository — atomic archive", () => {
  let db: ReturnType<typeof makeMockSupabase>;
  let repo: SourceRepository;

  beforeEach(() => {
    db = makeMockSupabase();
    repo = new SourceRepository(db as never);
  });

  it("archiveSource calls conditional update with neq status != archived", async () => {
    db._mocks.mockSingle.mockResolvedValue({
      data: {
        id: "src-1",
        workspace_id: "ws-1",
        business_id: "biz-1",
        source_type: "website",
        source_name: "Test",
        status: "archived",
        terminal_outcome: "archived",
        metadata: {},
        collected_at: new Date().toISOString(),
      },
      error: null,
    });

    const result = await repo.archiveSource("ws-1", "src-1");

    expect(result.ok).toBe(true);
    expect(db.from).toHaveBeenCalledWith("context_sources");
    expect(db._mocks.mockUpdate).toHaveBeenCalledWith({
      status: "archived",
      terminal_outcome: "archived",
    });
    expect(db._mocks.eq1Chain.eq).toHaveBeenCalledWith("workspace_id", "ws-1");
    expect(db._mocks.eq2Chain.eq).toHaveBeenCalledWith("id", "src-1");
    expect(db._mocks.eq3Chain.neq).toHaveBeenCalledWith("status", "archived");
  });

  it("archiveSource returns null data when Supabase returns PGRST116 (no match)", async () => {
    db._mocks.mockSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "No rows found" },
    });

    const result = await repo.archiveSource("ws-1", "src-1");

    expect(result).toMatchObject({ ok: true, data: null });
  });

  it("archiveSource returns error on non-PGRST116 failure", async () => {
    db._mocks.mockSingle.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "unique violation" },
    });

    const result = await repo.archiveSource("ws-1", "src-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ARCHIVE_FAILED");
    }
  });
});

// ─── replaceDocumentChunks + updateSourceDocument ─────────────────────────────

function makeFlexibleSupabase() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const mockResult = { data: null as unknown, error: null as unknown };

  function chainProxy(): Record<string, unknown> {
    const proxy: Record<string, unknown> = {};
    for (const method of ["eq", "neq", "select", "single", "delete", "insert", "update"]) {
      proxy[method] = vi.fn((...args: unknown[]) => {
        calls.push({ method, args });
        if (method === "single") return { data: mockResult.data, error: mockResult.error };
        return chainProxy();
      });
    }
    return proxy;
  }

  return {
    from: vi.fn(() => chainProxy()),
    _calls: calls,
    _mock: mockResult,
  };
}

describe("SourceRepository — replaceDocumentChunks", () => {
  it("inserts chunks with correct ownership columns", async () => {
    const db = makeFlexibleSupabase();
    const repo = new SourceRepository(db as never);

    db._mock.data = { id: "doc-1", processing_status: "processing" };
    db._mock.error = null;

    const chunks = [
      {
        chunkIndex: 0,
        headingPath: ["Intro"],
        content: "Hello",
        locator: { page: 1 },
        embedding: [0.1, 0.2],
        embeddingModel: "text-embedding-3-small",
      },
      {
        chunkIndex: 1,
        headingPath: ["Intro", "Details"],
        content: "World",
        locator: { page: 2 },
        embedding: [0.3, 0.4],
        embeddingModel: "text-embedding-3-small",
      },
    ];

    const result = await repo.replaceDocumentChunks("ws-1", "biz-1", "doc-1", chunks);

    expect(result.ok).toBe(true);

    // Verify update was called for processing status
    const updateCall = db._calls.find((c) => c.method === "update");
    expect(updateCall).toBeDefined();
    expect(updateCall!.args[0]).toEqual({ processing_status: "processing" });

    // Verify insert was called with correct rows
    const insertCall = db._calls.find((c) => c.method === "insert");
    expect(insertCall).toBeDefined();
    const rows = insertCall!.args[0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0].workspace_id).toBe("ws-1");
    expect(rows[0].business_id).toBe("biz-1");
    expect(rows[0].source_document_id).toBe("doc-1");
    expect(rows[0].chunk_index).toBe(0);
    expect(rows[0].heading_path).toEqual(["Intro"]);
    expect(rows[0].content).toBe("Hello");
    expect(rows[0].locator).toEqual({ page: 1 });
    expect(rows[0].embedding).toEqual([0.1, 0.2]);
    expect(rows[0].embedding_model).toBe("text-embedding-3-small");
  });

  it("deletes only target document chunks (not other docs)", async () => {
    const db = makeFlexibleSupabase();
    const repo = new SourceRepository(db as never);

    db._mock.data = null;
    db._mock.error = null;

    await repo.replaceDocumentChunks("ws-1", "biz-1", "doc-1", []);

    // Verify delete was called with workspace_id and source_document_id filters
    const deleteCalls = db._calls.filter((c) => c.method === "delete");
    expect(deleteCalls.length).toBe(1);
    // After delete(), eq() chains are called
    const eqCalls = db._calls.filter((c) => c.method === "eq");
    const docIdEq = eqCalls.find(
      (c) => c.args[0] === "source_document_id" && c.args[1] === "doc-1",
    );
    expect(docIdEq).toBeDefined();
  });

  it("sets processingStatus to 'processing'", async () => {
    const db = makeFlexibleSupabase();
    const repo = new SourceRepository(db as never);

    db._mock.data = { id: "doc-1", processing_status: "processing" };
    db._mock.error = null;

    await repo.replaceDocumentChunks("ws-1", "biz-1", "doc-1", []);

    const updateCall = db._calls.find((c) => c.method === "update");
    expect(updateCall!.args[0]).toEqual({ processing_status: "processing" });
  });
});

describe("SourceRepository — updateSourceDocument", () => {
  it("can update processedStoragePath, processingStatus, embeddingModel, indexedAt", async () => {
    const db = makeFlexibleSupabase();
    const repo = new SourceRepository(db as never);

    const updatedRow = {
      id: "doc-1",
      workspace_id: "ws-1",
      business_id: "biz-1",
      source_id: "src-1",
      processed_storage_path: "/processed/doc-1.json",
      processing_status: "indexed",
      embedding_model: "text-embedding-3-small",
      indexed_at: new Date("2025-01-15").toISOString(),
      metadata: {},
      retrieved_at: new Date().toISOString(),
    };
    db._mock.data = updatedRow;
    db._mock.error = null;

    const indexedAt = new Date("2025-01-15");
    const result = await repo.updateSourceDocument("ws-1", "doc-1", {
      processedStoragePath: "/processed/doc-1.json",
      processingStatus: "indexed",
      embeddingModel: "text-embedding-3-small",
      indexedAt,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.processedStoragePath).toBe("/processed/doc-1.json");
      expect(result.data.processingStatus).toBe("indexed");
      expect(result.data.embeddingModel).toBe("text-embedding-3-small");
    }

    // Verify update was called with correct snake_case keys
    const updateCall = db._calls.find((c) => c.method === "update");
    expect(updateCall!.args[0]).toEqual({
      processed_storage_path: "/processed/doc-1.json",
      processing_status: "indexed",
      embedding_model: "text-embedding-3-small",
      indexed_at: indexedAt.toISOString(),
    });
  });

  it("cannot update document in different workspace", async () => {
    const db = makeFlexibleSupabase();
    const repo = new SourceRepository(db as never);

    // Simulate no matching document (wrong workspace)
    db._mock.data = null;
    db._mock.error = { code: "PGRST116", message: "No rows found" };

    const result = await repo.updateSourceDocument("ws-wrong", "doc-1", {
      processingStatus: "indexed",
    });

    // PGRST116 on update means no row matched the workspace_id filter
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPDATE_FAILED");
    }

    // Verify workspace_id filter was applied
    const eqCalls = db._calls.filter((c) => c.method === "eq");
    const wsEq = eqCalls.find((c) => c.args[0] === "workspace_id" && c.args[1] === "ws-wrong");
    expect(wsEq).toBeDefined();
  });
});
