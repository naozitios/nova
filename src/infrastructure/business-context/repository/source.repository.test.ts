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

    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
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
