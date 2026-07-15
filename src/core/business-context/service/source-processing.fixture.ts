import { vi } from "vitest";
import type { SourceAdapterPort } from "@/core/business-context/source-adapter.port";
import type { CollectedSource } from "@/core/business-context/source-adapter.port";
import type { ContextSource, ContextJob } from "@/core/business-context/types";
import { SourceProcessingStage, JobStatus } from "@/core/business-context/types";

export function makeSource(overrides: Partial<ContextSource> = {}): ContextSource {
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

export function makeJob(overrides: Partial<ContextJob> = {}): ContextJob {
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

export function makeCollectedSource(overrides: Partial<CollectedSource> = {}): CollectedSource {
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

export function makeAdapter(
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
