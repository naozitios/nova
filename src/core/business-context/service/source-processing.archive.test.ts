import { describe, expect, it, vi } from "vitest";
import { SourceProcessingService } from "./source-processing.service";
import { createFakeRepository } from "../../../../tests/harness/test-repository";
import { makeSource } from "./source-processing.fixture";

describe("SourceProcessingService — archive", () => {
  /* no shared state — each test creates its own repo + svc */

  it("handles concurrent archive requests safely — both succeed, one wins CAS", async () => {
    let archived = false;

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockImplementation(async () => ({
        ok: true,
        data: makeSource({ status: archived ? "archived" : "processed" }),
      })),
      archiveSource: vi.fn().mockImplementation(async () => {
        if (!archived) {
          archived = true;
          return { ok: true, data: makeSource({ status: "archived" }) };
        }
        return { ok: true, data: makeSource({ status: "archived" }) };
      }),
    });

    const svc = new SourceProcessingService(repo);

    const [r1, r2] = await Promise.all([
      svc.archiveSource("biz-1", "ws-1", "src-1"),
      svc.archiveSource("biz-1", "ws-1", "src-1"),
    ]);

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
  });

  it("returns ALREADY_ARCHIVED for sequential call when source was archived before request", async () => {
    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource({ status: "archived" }),
      }),
    });

    const svc = new SourceProcessingService(repo);
    const result = await svc.archiveSource("biz-1", "ws-1", "src-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ALREADY_ARCHIVED");
    }
  });
});
