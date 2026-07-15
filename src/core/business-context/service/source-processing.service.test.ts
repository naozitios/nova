import { describe, expect, it, vi, beforeEach } from "vitest";
import { SourceProcessingService } from "./source-processing.service";
import type { SourceAdapterPort } from "@/core/business-context/source-adapter.port";
import type { CollectedSource } from "@/core/business-context/source-adapter.port";
import type { RepositoryPort, ContextSource, ContextJob } from "@/core/business-context/types";
import { SourceProcessingStage, JobStatus } from "@/core/business-context/types";
import { createFakeRepository } from "../../../tests/harness/test-repository";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSource(overrides: Partial<ContextSource> = {}): ContextSource {
  return {
    id: "src-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    sourceType: "website",
    sourceName: "Acme Site",
    externalReference: "https://example.com",
    status: "registered",
    currentStage: null,
    terminalOutcome: null,
    metadata: {},
    collectedAt: new Date(),
    ...overrides,
  };
}

function makeJob(overrides: Partial<ContextJob> = {}): ContextJob {
  return {
    id: "job-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    sessionId: null,
    jobType: "source_processing",
    status: JobStatus.QUEUED,
    attemptCount: 0,
    maxAttempts: 3,
    idempotencyKey: "process-src-1-1234",
    stage: SourceProcessingStage.QUEUED,
    input: { sourceId: "src-1", sourceType: "website" },
    output: null,
    error: null,
    errorClass: null,
    retryPolicy: {},
    nextRunAt: null,
    lockedBy: null,
    lockedAt: null,
    heartbeatAt: null,
    stageTimeoutSeconds: null,
    createdAt: new Date(),
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

function makeCollectedSource(overrides: Partial<CollectedSource> = {}): CollectedSource {
  return {
    sourceType: "website",
    sourceName: "Acme Site",
    externalReference: "https://example.com",
    metadata: {},
    documents: [
      {
        url: "https://example.com",
        title: "Home",
        contentText: "# Hello",
        mimeType: "text/markdown",
        httpStatus: 200,
      },
    ],
    ...overrides,
  };
}

function makeAdapter(
  overrides: Partial<SourceAdapterPort> = {},
): SourceAdapterPort {
  return {
    supports: vi.fn().mockReturnValue(true),
    collect: vi.fn().mockResolvedValue({
      ok: true,
      data: makeCollectedSource(),
    }),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SourceProcessingService", () => {
  let repo: RepositoryPort;
  let service: SourceProcessingService;

  beforeEach(() => {
    repo = createFakeRepository();
    service = new SourceProcessingService(repo);
  });

  // ─── Adapter selection ────────────────────────────────────────────────────

  describe("adapter selection", () => {
    it("selects website adapter for website source type", async () => {
      const websiteAdapter = makeAdapter({
        supports: (t) => t === "website",
      });
      const manualAdapter = makeAdapter({
        supports: (t) => t === "user_answer",
      });

      service.registerAdapter(websiteAdapter);
      service.registerAdapter(manualAdapter);

      const source = makeSource({ sourceType: "website" });
      const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

      expect(collected.ok).toBe(true);
      expect(websiteAdapter.collect).toHaveBeenCalled();
      expect(manualAdapter.collect).not.toHaveBeenCalled();
    });

    it("selects document adapter for stored-document source type", async () => {
      const documentAdapter = makeAdapter({
        supports: (t) => t === "brand_deck",
      });

      service.registerAdapter(documentAdapter);

      const source = makeSource({ sourceType: "brand_deck" });
      const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

      expect(collected.ok).toBe(true);
      expect(documentAdapter.collect).toHaveBeenCalled();
    });

    it("selects meta adapter for meta_ads source type", async () => {
      const metaAdapter = makeAdapter({
        supports: (t) => t === "meta",
      });

      service.registerAdapter(metaAdapter);

      const source = makeSource({ sourceType: "meta" });
      const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

      expect(collected.ok).toBe(true);
      expect(metaAdapter.collect).toHaveBeenCalled();
    });

    it("selects manual adapter for user_answer source type", async () => {
      const manualAdapter = makeAdapter({
        supports: (t) => t === "user_answer",
      });

      service.registerAdapter(manualAdapter);

      const source = makeSource({ sourceType: "user_answer" });
      const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

      expect(collected.ok).toBe(true);
      expect(manualAdapter.collect).toHaveBeenCalled();
    });

    it("selects inference adapter for system_inference source type", async () => {
      const inferenceAdapter = makeAdapter({
        supports: (t) => t === "system_inference",
      });

      service.registerAdapter(inferenceAdapter);

      const source = makeSource({ sourceType: "system_inference" });
      const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

      expect(collected.ok).toBe(true);
      expect(inferenceAdapter.collect).toHaveBeenCalled();
    });

    it("returns error when no adapter registered for source type", async () => {
      const source = makeSource({ sourceType: "brand_playbook" });
      const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

      expect(collected.ok).toBe(false);
      if (!collected.ok) {
        expect(collected.error.code).toBe("NO_ADAPTER");
      }
    });
  });

  // ─── Ordered stages ───────────────────────────────────────────────────────

  describe("ordered stages", () => {
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
  });

  // ─── Skipped stages ──────────────────────────────────────────────────────

  describe("skipped stages", () => {
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

  // ─── Idempotent persistence ──────────────────────────────────────────────

  describe("idempotent persistence", () => {
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
  });

  // ─── Partial warnings ────────────────────────────────────────────────────

  describe("partial warnings", () => {
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
  });

  // ─── OCR block ───────────────────────────────────────────────────────────

  describe("OCR block", () => {
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

  // ─── Archive race ─────────────────────────────────────────────────────────

  describe("archive race", () => {
    it("handles concurrent archive requests safely without double-archive", async () => {
      let archiveCount = 0;

      const repo = createFakeRepository({
        getContextSource: vi.fn().mockImplementation(
          async (_ws: string, _srcId: string) => ({
            ok: true,
            data: makeSource({
              status: archiveCount > 0 ? "archived" : "processed",
            }),
          }),
        ),
        updateContextSource: vi.fn().mockImplementation(
          async (_ws: string, _srcId: string, data: { status?: string }) => {
            if (data.status === "archived") archiveCount++;
            return { ok: true, data: makeSource({ status: "archived" }) };
          },
        ),
      });

      const svc = new SourceProcessingService(repo);

      const [r1, r2] = await Promise.all([
        svc.archiveSource("biz-1", "ws-1", "src-1"),
        svc.archiveSource("biz-1", "ws-1", "src-1"),
      ]);

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      expect(archiveCount).toBeLessThanOrEqual(1);
    });

    it("rejects archive when source is already archived", async () => {
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
});
