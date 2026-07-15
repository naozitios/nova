import { describe, expect, it, vi } from "vitest";
import {
  registerSource,
  listSources,
  getSource,
  processSource,
  archiveSource,
} from "../../../src/core/business-context/service/source.service";
import { createMockRepo } from "./_mock-repo";

// ---------------------------------------------------------------------------
// T065 — Contract test: source APIs
// Tests registerSource, listSources, getSource, processSource, archiveSource
// with mock repository (no live server needed).
// ---------------------------------------------------------------------------

const BUSINESS_ID = "biz-1";
const WORKSPACE_ID = "ws-1";
const SOURCE_ID = "src-1";
const NONEXISTENT_SOURCE = "00000000-0000-0000-0000-000000000099";

// ---------------------------------------------------------------------------
// registerSource
// ---------------------------------------------------------------------------

describe("registerSource — contract", () => {
  it("returns source with required fields", async () => {
    const repo = createMockRepo();
    const result = await registerSource(repo, BUSINESS_ID, WORKSPACE_ID, {
      sourceType: "website",
      sourceName: "Company Website",
      externalReference: "https://acme.example.com",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("id");
      expect(result.data.sourceType).toBe("website");
      expect(result.data.sourceName).toBe("Company Website");
      expect(result.data.status).toBe("registered");
    }
  });

  it("registers source with upload source_type", async () => {
    const repo = createMockRepo();
    const result = await registerSource(repo, BUSINESS_ID, WORKSPACE_ID, {
      sourceType: "product_document",
      sourceName: "Product Spec v2",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sourceType).toBe("product_document");
      expect(result.data.sourceName).toBe("Product Spec v2");
    }
  });

  it("registers source with meta source_type", async () => {
    const repo = createMockRepo();
    const result = await registerSource(repo, BUSINESS_ID, WORKSPACE_ID, {
      sourceType: "meta",
      sourceName: "Meta Ads Account",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.sourceType).toBe("meta");
    }
  });

  it("returns error when business not found", async () => {
    const repo = createMockRepo({
      getBusiness: vi.fn().mockResolvedValue({
        ok: true,
        data: null,
      }),
    });

    const result = await registerSource(repo, "nonexistent", WORKSPACE_ID, {
      sourceType: "website",
      sourceName: "Test",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});

// ---------------------------------------------------------------------------
// listSources
// ---------------------------------------------------------------------------

describe("listSources — contract", () => {
  it("returns source list", async () => {
    const repo = createMockRepo();
    const result = await listSources(repo, BUSINESS_ID, WORKSPACE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Array.isArray(result.data.items)).toBe(true);
      expect(result.data.items.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("each source has required fields", async () => {
    const repo = createMockRepo();
    const result = await listSources(repo, BUSINESS_ID, WORKSPACE_ID);

    expect(result.ok).toBe(true);
    if (result.ok && result.data.items.length > 0) {
      const source = result.data.items[0];
      expect(source).toHaveProperty("id");
      expect(source).toHaveProperty("sourceType");
      expect(source).toHaveProperty("sourceName");
      expect(source).toHaveProperty("status");
      expect(source).toHaveProperty("collectedAt");
    }
  });
});

// ---------------------------------------------------------------------------
// getSource
// ---------------------------------------------------------------------------

describe("getSource — contract", () => {
  it("returns source detail", async () => {
    const repo = createMockRepo();
    const result = await getSource(repo, BUSINESS_ID, WORKSPACE_ID, SOURCE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).not.toBeNull();
      expect(result.data?.id).toBe(SOURCE_ID);
      expect(result.data).toHaveProperty("sourceType");
      expect(result.data).toHaveProperty("sourceName");
      expect(result.data).toHaveProperty("status");
    }
  });

  it("returns null for nonexistent source", async () => {
    const repo = createMockRepo();
    const result = await getSource(repo, BUSINESS_ID, WORKSPACE_ID, NONEXISTENT_SOURCE);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// processSource
// ---------------------------------------------------------------------------

describe("processSource — contract", () => {
  it("returns queued job with required fields", async () => {
    const repo = createMockRepo();
    const result = await processSource(repo, BUSINESS_ID, WORKSPACE_ID, SOURCE_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("id");
      expect(result.data).toHaveProperty("status");
      expect(result.data).toHaveProperty("jobType");
      expect(result.data).toHaveProperty("attemptCount");
      expect(result.data).toHaveProperty("idempotencyKey");
    }
  });

  it("returns 404 for nonexistent source", async () => {
    const repo = createMockRepo();
    const result = await processSource(repo, BUSINESS_ID, WORKSPACE_ID, NONEXISTENT_SOURCE);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  it("updates source status to queued", async () => {
    const repo = createMockRepo();
    await processSource(repo, BUSINESS_ID, WORKSPACE_ID, SOURCE_ID);

    expect(repo.updateContextSource).toHaveBeenCalledWith(
      WORKSPACE_ID,
      SOURCE_ID,
      expect.objectContaining({ status: "queued" }),
    );
  });
});

// ---------------------------------------------------------------------------
// archiveSource
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
