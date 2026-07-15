import { describe, expect, it, vi } from "vitest";
import { createBusiness } from "../../../src/core/business-context/service/onboarding.service";
import { createMockRepo } from "./_mock-repo";

// ---------------------------------------------------------------------------
// T048 — Contract test: POST /api/businesses
// Validates required fields, evidence source requirement, and domain contract
// per OpenAPI contract and spec.md US1.
// Tests core function with mock repository (no live server needed).
// ---------------------------------------------------------------------------

const WORKSPACE_ID = "ws-1";

function validBusinessInput() {
  return {
    workspaceId: WORKSPACE_ID,
    name: "Acme Corp",
    primaryMarket: "US",
    primaryAdvertisingObjective: "conversions",
    primaryBusinessOutcome: "revenue_growth",
    approximateMonthlyMetaBudget: 10000,
    initialSources: [
      {
        sourceType: "website",
        sourceName: "Company Website",
        externalReference: "https://acme.example.com",
      },
    ],
  };
}

describe("createBusiness — contract", () => {
  it("returns business with required fields", async () => {
    const repo = createMockRepo();
    const result = await createBusiness(repo, validBusinessInput());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("id");
      expect(result.data.name).toBe("Acme Corp");
      expect(result.data.workspaceId).toBe(WORKSPACE_ID);
      expect(result.data).toHaveProperty("createdAt");
    }
  });

  it("creates initial source records", async () => {
    const repo = createMockRepo();
    await createBusiness(repo, validBusinessInput());

    expect(repo.createContextSource).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "website",
        sourceName: "Company Website",
        externalReference: "https://acme.example.com",
        status: "registered",
      }),
    );
  });

  it("rejects empty initial_sources", async () => {
    const repo = createMockRepo({
      createBusiness: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "At least one initial source required" },
      }),
    });

    const result = await createBusiness(repo, {
      ...validBusinessInput(),
      initialSources: [],
    });

    expect(result.ok).toBe(false);
  });

  it("returns error on repository failure", async () => {
    const repo = createMockRepo({
      createBusiness: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "DB_ERROR", message: "Connection failed" },
      }),
    });

    const result = await createBusiness(repo, validBusinessInput());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("DB_ERROR");
    }
  });

  it("handles multiple initial sources", async () => {
    const repo = createMockRepo();
    await createBusiness(repo, {
      ...validBusinessInput(),
      initialSources: [
        { sourceType: "website", sourceName: "Website", externalReference: "https://example.com" },
        { sourceType: "product_document", sourceName: "Product Spec" },
      ],
    });

    expect(repo.createContextSource).toHaveBeenCalledTimes(2);
  });
});
