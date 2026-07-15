import { describe, expect, it, vi } from "vitest";
import { SourceProcessingService } from "./source-processing.service";
import { createFakeRepository } from "../../../../tests/harness/test-repository";
import { makeSource, makeJob, makeCollectedSource, makeAdapter } from "./source-processing.fixture";

describe("SourceProcessingService — processing", () => {
  /* no shared state — each test creates its own repo + svc */

  it("does not create duplicate jobs for same source+job idempotency key", async () => {
    const existingJob = makeJob({ idempotencyKey: "process-src-1-existing" });

    const createJobSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: existingJob,
    });

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      getContextJobByIdempotencyKey: vi.fn().mockResolvedValue({
        ok: true,
        data: existingJob,
      }),
      createContextJob: createJobSpy,
      updateContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
    });

    const svc = new SourceProcessingService(repo);
    const result = await svc.processSource("biz-1", "ws-1", "src-1");

    expect(result.ok).toBe(true);
    expect(createJobSpy).not.toHaveBeenCalled();
  });

  it("completes with warnings when extraction returns non-fatal issues", async () => {
    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob(),
      }),
      updateContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      createStageEvent: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "evt-1" },
      }),
    });

    const adapter = makeAdapter({
      collect: vi.fn().mockResolvedValue({
        ok: true,
        data: makeCollectedSource({
          documents: [
            {
              url: "https://example.com",
              title: "Home",
              contentText: "# Low quality content",
              mimeType: "text/markdown",
              httpStatus: 200,
              metadata: { warnings: ["Thin content detected"] },
            },
          ],
        }),
      }),
    });

    const svc = new SourceProcessingService(repo);
    svc.registerAdapter(adapter);

    const result = await svc.processSource("biz-1", "ws-1", "src-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.warnings).toContain("Thin content detected");
    }
  });

  it("does not fail pipeline when warnings are present but no blocking errors", async () => {
    const updateSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: makeSource({ status: "processed_with_warnings" }),
    });

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob(),
      }),
      updateContextSource: updateSpy,
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      createStageEvent: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "evt-1" },
      }),
    });

    const adapter = makeAdapter({
      collect: vi.fn().mockResolvedValue({
        ok: true,
        data: makeCollectedSource({
          documents: [
            {
              url: "https://example.com",
              contentText: "Some content",
              metadata: { warnings: ["Partial parse"] },
            },
          ],
        }),
      }),
    });

    const svc = new SourceProcessingService(repo);
    svc.registerAdapter(adapter);

    const result = await svc.processSource("biz-1", "ws-1", "src-1");

    expect(result.ok).toBe(true);
  });

  it("blocks extraction when document requires OCR and OCR is not resolved", async () => {
    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource({
          metadata: { ocrRequired: true, ocrResolved: false },
        }),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob(),
      }),
      updateContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      createStageEvent: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "evt-1" },
      }),
    });

    const adapter = makeAdapter();
    const svc = new SourceProcessingService(repo);
    svc.registerAdapter(adapter);

    const result = await svc.processSource("biz-1", "ws-1", "src-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("blocked_needs_user_action");
    }
  });

  it("sets terminalOutcome to blocked_needs_user_action when OCR blocks", async () => {
    const updateSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: makeSource({ status: "blocked_needs_user_action" }),
    });

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource({
          metadata: { ocrRequired: true, ocrResolved: false },
        }),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob(),
      }),
      updateContextSource: updateSpy,
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      createStageEvent: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "evt-1" },
      }),
    });

    const adapter = makeAdapter();
    const svc = new SourceProcessingService(repo);
    svc.registerAdapter(adapter);

    await svc.processSource("biz-1", "ws-1", "src-1");

    expect(updateSpy).toHaveBeenCalledWith(
      "ws-1",
      "src-1",
      expect.objectContaining({
        terminalOutcome: "blocked_needs_user_action",
      }),
    );
  });
});
