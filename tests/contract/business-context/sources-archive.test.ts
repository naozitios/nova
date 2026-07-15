import { describe, expect, it, vi } from "vitest";
import { archiveSource } from "../../../src/core/business-context/service/source.service";
import { createMockRepo } from "./_mock-repo";
import {
  BUSINESS_ID,
  WORKSPACE_ID,
  SOURCE_ID,
  NONEXISTENT_SOURCE,
} from "./_source-fixtures";

// ---------------------------------------------------------------------------
// T065 — Contract test: archiveSource
// ---------------------------------------------------------------------------

describe("archiveSource — contract", () => {
  it("returns archived source", async () => {
    const repo = createMockRepo();
    const result = await archiveSource(repo, BUSINESS_ID, WORKSPACE_ID, SOURCE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("id");
      expect(result.data.status).toBe("archived");
    }
  });

  it("returns 404 for nonexistent source", async () => {
    const repo = createMockRepo();
    const result = await archiveSource(repo, BUSINESS_ID, WORKSPACE_ID, NONEXISTENT_SOURCE);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("does not hard-delete source", async () => {
    const repo = createMockRepo();
    await archiveSource(repo, BUSINESS_ID, WORKSPACE_ID, SOURCE_ID);

    expect(repo.archiveSource).toHaveBeenCalledWith(
      WORKSPACE_ID,
      SOURCE_ID,
    );
  });

  it("returns ALREADY_ARCHIVED when source was already archived before request", async () => {
    const repo = createMockRepo({
      getContextSource: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: SOURCE_ID,
          workspaceId: WORKSPACE_ID,
          businessId: BUSINESS_ID,
          sourceType: "website",
          sourceName: "Company Website",
          externalReference: "https://acme.example.com",
          status: "archived",
          currentStage: null,
          terminalOutcome: "archived",
          metadata: {},
          collectedAt: new Date(),
          createdAt: new Date(),
        },
      }),
    });

    const result = await archiveSource(repo, BUSINESS_ID, WORKSPACE_ID, SOURCE_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("ALREADY_ARCHIVED");
    }
  });

  it("uses atomic repository archive when available", async () => {
    const archiveSpy = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        id: SOURCE_ID,
        workspaceId: WORKSPACE_ID,
        businessId: BUSINESS_ID,
        sourceType: "website",
        sourceName: "Company Website",
        externalReference: "https://acme.example.com",
        status: "archived",
        currentStage: null,
        terminalOutcome: "archived",
        metadata: {},
        collectedAt: new Date(),
        createdAt: new Date(),
      },
    });

    const repo = createMockRepo({
      archiveSource: archiveSpy,
    });

    const result = await archiveSource(repo, BUSINESS_ID, WORKSPACE_ID, SOURCE_ID);

    expect(result.ok).toBe(true);
    expect(archiveSpy).toHaveBeenCalledWith(WORKSPACE_ID, SOURCE_ID);
  });

  it("CAS loser after initial non-archived read returns success with re-read", async () => {
    let callCount = 0;
    const repo = createMockRepo({
      getContextSource: vi.fn().mockImplementation(async () => ({
        ok: true,
        data: {
          id: SOURCE_ID,
          workspaceId: WORKSPACE_ID,
          businessId: BUSINESS_ID,
          sourceType: "website",
          sourceName: "Company Website",
          externalReference: "https://acme.example.com",
          status: callCount++ === 0 ? "processed" : "archived",
          currentStage: null,
          terminalOutcome: null,
          metadata: {},
          collectedAt: new Date(),
          createdAt: new Date(),
        },
      })),
      archiveSource: vi.fn().mockResolvedValue({ ok: true, data: null }),
    });

    const result = await archiveSource(repo, BUSINESS_ID, WORKSPACE_ID, SOURCE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("archived");
    }
  });
});
