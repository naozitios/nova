import { describe, expect, it, vi } from "vitest";
import { SourceProcessingService } from "./source-processing.service";
import { createFakeRepository } from "../../../../tests/harness/test-repository";
import { makeSource, makeJob, makeAdapter } from "./source-processing.fixture";

describe("SourceProcessingService — pipeline stages", () => {
  /* no shared state — each test creates its own repo + svc */

  it("executes stages in claim → parse → extract → reconcile → quality order", async () => {
    const stageOrder: string[] = [];
    const stageNames = [
      "claim",
      "parse",
      "extract",
      "reconcile",
      "quality",
    ];

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
        data: makeSource({ status: "processing" }),
      }),
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      createStageEvent: vi.fn().mockImplementation(async (data: { stage: string }) => {
        stageOrder.push(data.stage);
        return { ok: true, data: { id: "evt-1" } };
      }),
    });

    const svc = new SourceProcessingService(repo);
    const adapter = makeAdapter();
    svc.registerAdapter(adapter);

    await svc.processSource("biz-1", "ws-1", "src-1");

    expect(stageOrder).toEqual(stageNames);
  });

  it("skips parse stage for manual source types that need no parsing", async () => {
    const stageOrder: string[] = [];

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource({ sourceType: "user_answer" }),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob({ input: { sourceId: "src-1", sourceType: "user_answer" } }),
      }),
      updateContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource({ status: "processing" }),
      }),
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      createStageEvent: vi.fn().mockImplementation(async (data: { stage: string; status?: string }) => {
        stageOrder.push(data.stage);
        return { ok: true, data: { id: "evt-1" } };
      }),
    });

    const svc = new SourceProcessingService(repo);
    const adapter = makeAdapter();
    svc.registerAdapter(adapter);

    await svc.processSource("biz-1", "ws-1", "src-1");

    expect(stageOrder).not.toContain("parsing");
  });

  it("records skipped stage event with reason when stage is skipped", async () => {
    const stageEvents: Array<{ stage: string; status: string }> = [];

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource({ sourceType: "user_answer" }),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob({ input: { sourceId: "src-1", sourceType: "user_answer" } }),
      }),
      updateContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource({ status: "processing" }),
      }),
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      createStageEvent: vi.fn().mockImplementation(async (data: { stage: string; status: string }) => {
        stageEvents.push({ stage: data.stage, status: data.status });
        return { ok: true, data: { id: "evt-1" } };
      }),
    });

    const svc = new SourceProcessingService(repo);
    const adapter = makeAdapter();
    svc.registerAdapter(adapter);

    await svc.processSource("biz-1", "ws-1", "src-1");

    const skippedEvents = stageEvents.filter((e) => e.status === "skipped");
    expect(skippedEvents.length).toBeGreaterThan(0);
  });
});
