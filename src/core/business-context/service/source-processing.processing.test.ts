import { describe, expect, it, vi } from "vitest";
import { SourceProcessingService } from "./source-processing.service";
import { createFakeRepository } from "../../../../tests/harness/test-repository";
import { makeSource, makeJob, makeCollectedSource, makeAdapter } from "./source-processing.fixture";
import type { ExtractionPort } from "@/core/business-context/extraction.port";

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

  it("sets source to failed_permanent and job to FAILED_PERMANENT when adapter collect fails", async () => {
    const updateSourceSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: makeSource({ status: "failed_permanent" }),
    });
    const updateJobSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: makeJob({ status: "failed_permanent" }),
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
      updateContextSource: updateSourceSpy,
      updateContextJob: updateJobSpy,
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
        ok: false,
        error: { code: "SSRF_BLOCKED", message: "Private network target blocked" },
      }),
    });

    const svc = new SourceProcessingService(repo);
    svc.registerAdapter(adapter);

    const result = await svc.processSource("biz-1", "ws-1", "src-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_BLOCKED");
    }
    expect(updateSourceSpy).toHaveBeenCalledWith(
      "ws-1",
      "src-1",
      expect.objectContaining({
        status: "failed_permanent",
        terminalOutcome: "failed_permanent",
      }),
    );
    expect(updateJobSpy).toHaveBeenCalledWith(
      "ws-1",
      "job-1",
      expect.objectContaining({
        status: "failed_permanent",
        error: expect.stringContaining("SSRF_BLOCKED"),
      }),
    );
    // Source update called twice: first to 'processing', then to 'failed_permanent'
    expect(updateSourceSpy).toHaveBeenCalledTimes(2);
    expect(updateSourceSpy).toHaveBeenNthCalledWith(
      1,
      "ws-1",
      "src-1",
      expect.objectContaining({ status: "processing" }),
    );
    expect(updateSourceSpy).toHaveBeenNthCalledWith(
      2,
      "ws-1",
      "src-1",
      expect.objectContaining({
        status: "failed_permanent",
        terminalOutcome: "failed_permanent",
      }),
    );
    // Job update called once
    expect(updateJobSpy).toHaveBeenCalledTimes(1);
  });

  it("sets source to failed_permanent on SSRF_REDIRECT_BLOCKED error", async () => {
    const updateSourceSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: makeSource({ status: "failed_permanent" }),
    });
    const updateJobSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: makeJob({ status: "failed_permanent" }),
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
      updateContextSource: updateSourceSpy,
      updateContextJob: updateJobSpy,
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
        ok: false,
        error: { code: "SSRF_REDIRECT_BLOCKED", message: "Redirect targets private network" },
      }),
    });

    const svc = new SourceProcessingService(repo);
    svc.registerAdapter(adapter);

    const result = await svc.processSource("biz-1", "ws-1", "src-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("SSRF_REDIRECT_BLOCKED");
    }
    expect(updateSourceSpy).toHaveBeenCalledWith(
      "ws-1",
      "src-1",
      expect.objectContaining({
        status: "failed_permanent",
        terminalOutcome: "failed_permanent",
      }),
    );
    expect(updateJobSpy).toHaveBeenCalledWith(
      "ws-1",
      "job-1",
      expect.objectContaining({
        status: "failed_permanent",
      }),
    );
  });

  it("returns error and stops pipeline when createOnboardingQuestion fails", async () => {
    const createQuestionSpy = vi.fn().mockResolvedValue({
      ok: false,
      error: { code: "CREATE_FAILED", message: "insert failed" },
    });
    const dismissSpy = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const updateRunSpy = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const updateJobSpy = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const updateSourceSpy = vi.fn().mockResolvedValue({ ok: true, data: undefined });

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob(),
      }),
      updateContextSource: updateSourceSpy,
      updateContextJob: updateJobSpy,
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-1" },
      }),
      updateProcessingRun: updateRunSpy,
      createStageEvent: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "evt-1" },
      }),
      createSourceDocument: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "doc-1" },
      }),
      createQualityGateResult: vi.fn().mockResolvedValue({
        ok: true,
        data: undefined,
      }),
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            {
              id: "fact-1",
              workspaceId: "ws-1",
              businessId: "biz-1",
              factKey: "company_name",
              value: "Acme",
              sourceId: "src-1",
              sourceDocumentId: "doc-1",
              sourceExcerpt: null,
              evidenceLocator: null,
              confidence: 0.4,
              verificationStatus: "pending",
              supersedesFactId: null,
              validFrom: new Date(),
              validTo: null,
              createdAt: new Date(),
              createdBy: "system",
            },
          ],
          total: 1,
        },
      }),
      persistFactReconciliation: vi.fn().mockResolvedValue({
        ok: true,
        data: { created_fact_ids: ["f1"], superseded_fact_ids: [] },
      }),
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
      createOnboardingQuestion: createQuestionSpy,
      dismissOnboardingQuestion: dismissSpy,
    });

    const extractionPort: ExtractionPort = {
      extractFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          facts: [
            {
              factKey: "company_name",
              value: "Acme Corp",
              confidence: 0.9,
              sourceExcerpt: "Acme Corp is a company",
              evidenceLocator: null,
            },
          ],
          warnings: [],
        },
      }),
      reconcileFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { created: [], superseded: [], conflicts: [] },
      }),
    };

    const adapter = makeAdapter();
    const svc = new SourceProcessingService(repo, extractionPort);
    svc.registerAdapter(adapter);

    const result = await svc.processSource("biz-1", "ws-1", "src-1", {
      sessionId: "session-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CREATE_FAILED");
    }
    expect(createQuestionSpy).toHaveBeenCalled();
    expect(dismissSpy).not.toHaveBeenCalled();
    expect(updateRunSpy).not.toHaveBeenCalled();
    expect(updateJobSpy).not.toHaveBeenCalled();
    // updateSource called once for initial 'processing' status, but NOT for terminal status
    expect(updateSourceSpy).toHaveBeenCalledTimes(1);
    expect(updateSourceSpy).toHaveBeenCalledWith(
      "ws-1",
      "src-1",
      expect.objectContaining({ status: "processing" }),
    );
  });

  it("persists terminal run and failed visibility event when collection fails", async () => {
    const updateRun = vi.fn().mockResolvedValue({ ok: true, data: { id: "run-1" } });
    const createEvent = vi.fn().mockResolvedValue({ ok: true, data: { id: "event-1" } });
    const updateSource = vi.fn().mockResolvedValue({ ok: true, data: makeSource() });
    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({ ok: true, data: makeSource() }),
      createContextJob: vi.fn().mockResolvedValue({ ok: true, data: makeJob() }),
      createProcessingRun: vi.fn().mockResolvedValue({ ok: true, data: { id: "run-1" } }),
      updateContextJob: vi.fn().mockResolvedValue({ ok: true, data: makeJob() }),
      updateProcessingRun: updateRun,
      createStageEvent: createEvent,
      updateContextSource: updateSource,
    });
    const adapter = makeAdapter({
      collect: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "BUDGET_EXCEEDED", message: "Page budget 1 exceeded" },
      }),
    });
    const service = new SourceProcessingService(repo);
    service.registerAdapter(adapter);

    const result = await service.processSource("biz-1", "ws-1", "src-1");

    expect(result).toEqual({
      ok: false,
      error: { code: "BUDGET_EXCEEDED", message: "Page budget 1 exceeded" },
    });
    expect(updateRun).toHaveBeenCalledWith("ws-1", "run-1", expect.objectContaining({
      status: "failed",
      terminalOutcome: "failed_permanent",
      completedAt: expect.any(Date),
    }));
    expect(createEvent).toHaveBeenCalledWith(expect.objectContaining({
      runId: "run-1",
      status: "failed_permanent",
      errorClass: "budget_exceeded",
    }));
    expect(updateSource).toHaveBeenLastCalledWith("ws-1", "src-1", {
      status: "failed_permanent",
      terminalOutcome: "failed_permanent",
    });
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
