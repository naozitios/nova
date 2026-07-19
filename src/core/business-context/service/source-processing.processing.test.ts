import { describe, expect, it, vi } from "vitest";
import { SourceProcessingService } from "./source-processing.service";
import type { SourceFactPipeline } from "./source-fact-pipeline";
import { createFakeRepository } from "../../../../tests/harness/test-repository";
import { makeSource, makeJob, makeCollectedSource, makeAdapter } from "./source-processing.fixture";
import type { ExtractionPort } from "@/core/business-context/extraction.port";
import type { UploadedDocumentProcessor } from "./uploaded-document.processor";
import type { DocumentParserPort } from "@/core/business-context/document-parser.port";
import type { CanonicalDocumentIndexer } from "./canonical-document-indexer";

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

  it("sends sourceDocumentId and parserName in factPipeline documents (passthrough when no raw HTML)", async () => {
    const processSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: { factsExtracted: 0, warnings: [] },
    });

    const factPipeline = {
      process: processSpy,
    } as unknown as SourceFactPipeline;

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob(),
      }),
      updateContextSource: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-doc" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createStageEvent: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createSourceDocument: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "persisted-doc-1" },
      }),
      createQualityGateResult: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [] },
      }),
    });

    const adapter = makeAdapter();
    const extractionPort: ExtractionPort = {
      extractFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { facts: [], warnings: [] },
      }),
      reconcileFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { created: [], superseded: [], conflicts: [] },
      }),
    };
    // No documentParser/documentIndexer → passthrough parser
    const svc = new SourceProcessingService(repo, extractionPort, undefined, factPipeline);
    svc.registerAdapter(adapter);

    await svc.processSource("biz-1", "ws-1", "src-1");

    expect(processSpy).toHaveBeenCalledTimes(1);
    const input = processSpy.mock.calls[0][0];
    expect(input.documents).toHaveLength(1);
    const doc = input.documents[0];
    expect(doc).toHaveProperty("sourceDocumentId", "persisted-doc-1");
    expect(doc).toHaveProperty("contentText", "# Hello");
    expect(doc).toHaveProperty("parserName", "passthrough");
    // Must NOT have legacy id/mimeType keys
    expect(doc).not.toHaveProperty("id");
    expect(doc).not.toHaveProperty("mimeType");
  });

  it("passes top-level runId and sessionId (not jobId/nested options) to factPipeline.process", async () => {
    const processSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: { factsExtracted: 0, warnings: [] },
    });

    const factPipeline = {
      process: processSpy,
    } as unknown as SourceFactPipeline;

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob(),
      }),
      updateContextSource: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-42" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createStageEvent: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createSourceDocument: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "doc-1" },
      }),
      createQualityGateResult: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [] },
      }),
    });

    const extractionPort: ExtractionPort = {
      extractFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { facts: [], warnings: [] },
      }),
      reconcileFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { created: [], superseded: [], conflicts: [] },
      }),
    };

    const adapter = makeAdapter();
    const svc = new SourceProcessingService(repo, extractionPort, undefined, factPipeline);
    svc.registerAdapter(adapter);

    await svc.processSource("biz-1", "ws-1", "src-1", {
      sessionId: "session-99",
    });

    expect(processSpy).toHaveBeenCalledTimes(1);
    const input = processSpy.mock.calls[0][0];

    // Must have top-level runId and sessionId
    expect(input).toHaveProperty("runId", "run-42");
    expect(input).toHaveProperty("sessionId", "session-99");

    // Must NOT have jobId or nested options
    expect(input).not.toHaveProperty("jobId");
    expect(input).not.toHaveProperty("options");
  });

  it("returns error when fact pipeline returns failure", async () => {
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
        data: { items: [] },
      }),
    });

    const extractionPort: ExtractionPort = {
      extractFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { facts: [], warnings: [] },
      }),
      reconcileFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { created: [], superseded: [], conflicts: [] },
      }),
    };

    const factPipeline = {
      process: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "EXTRACTION_FAILED", message: "API error" },
      }),
    } as unknown as SourceFactPipeline;

    const adapter = makeAdapter();
    const svc = new SourceProcessingService(repo, extractionPort, undefined, factPipeline);
    svc.registerAdapter(adapter);

    const result = await svc.processSource("biz-1", "ws-1", "src-1", {
      sessionId: "session-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("EXTRACTION_FAILED");
    }
    expect(factPipeline.process).toHaveBeenCalledTimes(1);
    // Job and source updated to failed; run NOT updated (pipeline error prevents terminal)
    expect(updateJobSpy).toHaveBeenCalledWith(
      "ws-1",
      "job-1",
      expect.objectContaining({ status: "failed_permanent" }),
    );
    expect(updateSourceSpy).toHaveBeenCalledWith(
      "ws-1",
      "src-1",
      expect.objectContaining({ status: "failed_permanent" }),
    );
    expect(updateRunSpy).not.toHaveBeenCalled();
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

  it("forwards runId and sessionId to uploadedProcessor.process", async () => {
    const processSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: { status: "processed", warnings: [] },
    });
    const uploadedProcessor = { process: processSpy } as unknown as UploadedDocumentProcessor;

    const existingJob = makeJob({
      id: "job-upload-1",
      sessionId: "session-upload-1",
      input: { sourceId: "src-1", sourceType: "upload", documentId: "doc-upload-1" },
    });

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      getContextJobByIdempotencyKey: vi.fn().mockResolvedValue({
        ok: false,
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: existingJob,
      }),
      listProcessingRuns: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [{ id: "run-upload-1" }] },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      updateContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      updateContextJob: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    });

    const svc = new SourceProcessingService(repo, undefined, uploadedProcessor);
    const result = await svc.processSource("biz-1", "ws-1", "src-1", {
      sessionId: "session-upload-1",
      job: existingJob,
    });

    expect(result.ok).toBe(true);
    expect(processSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: "run-upload-1",
        sessionId: "session-upload-1",
      }),
    );
  });

  it("sets run status to succeeded_with_warnings when uploaded processor returns processed_with_warnings", async () => {
    const updateRunSpy = vi.fn().mockResolvedValue({ ok: true, data: undefined });
    const updateSourceSpy = vi.fn().mockResolvedValue({ ok: true, data: undefined });

    const processSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: { status: "processed_with_warnings", warnings: ["Low confidence parsing"] },
    });
    const uploadedProcessor = { process: processSpy } as unknown as UploadedDocumentProcessor;

    const existingJob = makeJob({
      id: "job-upload-warn",
      sessionId: "session-upload-warn",
      input: { sourceId: "src-1", sourceType: "upload", documentId: "doc-upload-warn" },
    });

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      getContextJobByIdempotencyKey: vi.fn().mockResolvedValue({ ok: false }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: existingJob,
      }),
      listProcessingRuns: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [{ id: "run-upload-warn" }] },
      }),
      updateProcessingRun: updateRunSpy,
      updateContextSource: updateSourceSpy,
      updateContextJob: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
    });

    const svc = new SourceProcessingService(repo, undefined, uploadedProcessor);
    const result = await svc.processSource("biz-1", "ws-1", "src-1", {
      sessionId: "session-upload-warn",
      job: existingJob,
    });

    expect(result.ok).toBe(true);
    // Run status must be succeeded_with_warnings, not hardcoded succeeded
    expect(updateRunSpy).toHaveBeenCalledWith(
      "ws-1",
      "run-upload-warn",
      expect.objectContaining({
        status: "succeeded_with_warnings",
        terminalOutcome: "processed_with_warnings",
      }),
    );
    // Source status/outcome remain processed_with_warnings
    expect(updateSourceSpy).toHaveBeenCalledWith(
      "ws-1",
      "src-1",
      expect.objectContaining({
        status: "processed_with_warnings",
        terminalOutcome: "processed_with_warnings",
      }),
    );
  });

  it("calls documentIndexer.index with full contract for website raw content and skips redundant metadata write", async () => {
    const indexSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: { processedStoragePath: "websites/ws-1/biz-1/src-1/abc123.md", chunkCount: 1 },
    });

    const documentIndexer = { index: indexSpy } as unknown as CanonicalDocumentIndexer;
    const documentParser = {
      parseContent: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          contentText: "# Parsed markdown",
          parserName: "docling",
          parserVersion: "2.1.0",
        },
      }),
    } as unknown as DocumentParserPort;

    const updateSourceDocSpy = vi.fn().mockResolvedValue({ ok: true, data: undefined });

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob(),
      }),
      updateContextSource: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-raw" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createStageEvent: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createSourceDocument: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "doc-raw-1" },
      }),
      updateSourceDocument: updateSourceDocSpy,
      createQualityGateResult: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [] },
      }),
    });

    const adapter = makeAdapter({
      collect: vi.fn().mockResolvedValue({
        ok: true,
        data: makeCollectedSource({
          documents: [
            {
              url: "https://example.com/page",
              title: "Page",
              contentText: "# Raw",
              rawContent: "<html>raw</html>",
              rawMimeType: "text/html",
              mimeType: "text/html",
              httpStatus: 200,
              pageOrSlideCount: 3,
            },
          ],
        }),
      }),
    });

    const extractionPort: ExtractionPort = {
      extractFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { facts: [], warnings: [] },
      }),
      reconcileFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { created: [], superseded: [], conflicts: [] },
      }),
    };

    const svc = new SourceProcessingService(
      repo,
      extractionPort,
      undefined,
      undefined,
      documentParser,
      documentIndexer,
    );
    svc.registerAdapter(adapter);

    const result = await svc.processSource("biz-1", "ws-1", "src-1");

    expect(result.ok).toBe(true);

    // index must receive full contract, not legacy storagePath
    expect(indexSpy).toHaveBeenCalledTimes(1);
    const indexCall = indexSpy.mock.calls[0][0];
    expect(indexCall).toHaveProperty("processedStoragePath");
    expect(indexCall.processedStoragePath).toMatch(/\.md$/);
    expect(indexCall).toHaveProperty("parserName", "docling");
    expect(indexCall).toHaveProperty("parserVersion", "2.1.0");
    expect(indexCall).toHaveProperty("pageOrSlideCount", 3);
    expect(indexCall).toHaveProperty("baseLocator");
    expect(indexCall.baseLocator).toEqual({ url: "https://example.com/page" });
    expect(indexCall).not.toHaveProperty("storagePath");

    // No redundant updateSourceDocument after index (indexer persists metadata)
    expect(updateSourceDocSpy).not.toHaveBeenCalled();
  });

  it("produces same processedStoragePath for identical raw documents regardless of array position", async () => {
    const indexSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: { processedStoragePath: "websites/ws-1/biz-1/src-1/placeholder.md", chunkCount: 1 },
    });
    const documentIndexer = { index: indexSpy } as unknown as CanonicalDocumentIndexer;
    const documentParser = {
      parseContent: vi.fn().mockImplementation(({ content }: { content: Buffer }) =>
        Promise.resolve({
          ok: true,
          data: {
            contentText: content.toString("utf-8"),
            parserName: "docling",
            parserVersion: "2.1.0",
          },
        }),
      ),
    } as unknown as DocumentParserPort;

    const sharedRaw = "<html>same content</html>";

    const repo = createFakeRepository({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: makeSource(),
      }),
      createContextJob: vi.fn().mockResolvedValue({
        ok: true,
        data: makeJob(),
      }),
      updateContextSource: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createProcessingRun: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "run-pos" },
      }),
      updateProcessingRun: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createStageEvent: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      createSourceDocument: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "doc-pos" },
      }),
      createQualityGateResult: vi.fn().mockResolvedValue({ ok: true, data: undefined }),
      listContextFacts: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [] },
      }),
    });

    const adapter = makeAdapter({
      collect: vi.fn().mockResolvedValue({
        ok: true,
        data: makeCollectedSource({
          documents: [
            { rawContent: sharedRaw, rawMimeType: "text/html", mimeType: "text/html", title: "A", contentText: "shared content A" },
            { rawContent: sharedRaw, rawMimeType: "text/html", mimeType: "text/html", title: "B", contentText: "shared content B" },
          ],
        }),
      }),
    });

    const extractionPort: ExtractionPort = {
      extractFacts: vi.fn().mockResolvedValue({ ok: true, data: { facts: [], warnings: [] } }),
      reconcileFacts: vi.fn().mockResolvedValue({ ok: true, data: { created: [], superseded: [], conflicts: [] } }),
    };

    const svc = new SourceProcessingService(repo, extractionPort, undefined, undefined, documentParser, documentIndexer);
    svc.registerAdapter(adapter);

    const result = await svc.processSource("biz-1", "ws-1", "src-1");

    expect(result.ok).toBe(true);
    // Both documents have identical content — processedStoragePath must be identical
    expect(indexSpy).toHaveBeenCalledTimes(2);
    const path0 = indexSpy.mock.calls[0][0].processedStoragePath;
    const path1 = indexSpy.mock.calls[1][0].processedStoragePath;
    expect(path0).toBe(path1);
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
