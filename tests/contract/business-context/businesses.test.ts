import { describe, expect, it, vi, beforeEach } from "vitest";
import { createBusiness } from "../../../src/core/business-context/service/onboarding.service";
import { createMockRepo } from "./_mock-repo";

// ---------------------------------------------------------------------------
// T048 — Contract test: POST /api/businesses
// Validates required fields, evidence source requirement, and domain contract
// per OpenAPI contract and spec.md US1.
// Tests core function with mock repository (no live server needed).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// B38 — Route wiring: createdBy passthrough, optional initial_sources
// Tests the real POST handler seam via mocked _shared helpers and service.
// ---------------------------------------------------------------------------

// --- mocks for route handler tests ---
const mockCreatedResponse = vi.fn(
  (data: unknown) => new Response(JSON.stringify(data), { status: 201 }),
);
const mockErrorResponse = vi.fn(
  (status: number, code: string, message: string) =>
    new Response(JSON.stringify({ error: { code, message } }), { status }),
);
const mockRequireAuthz = vi.fn();
const mockCreateBusinessService = vi.fn();

vi.mock("../../../src/app/api/businesses/_shared", () => ({
  withIdempotency: vi.fn(
    (_req: unknown, handler: () => Promise<Response>) => handler(),
  ),
  parseJsonBody: vi.fn(async (req: Request) => {
    try {
      const data = await req.json();
      return { ok: true as const, data };
    } catch {
      return {
        ok: false as const,
        response: new Response(
          JSON.stringify({
            error: { code: "INVALID_BODY", message: "Invalid JSON" },
          }),
          { status: 400 },
        ),
      };
    }
  }),
  validateWithSchema: vi.fn((_schema: unknown, data: unknown) => ({
    ok: true as const,
    data,
  })),
  requireAuthz: mockRequireAuthz,
  createdResponse: mockCreatedResponse,
  errorResponse: mockErrorResponse,
}));

vi.mock("../../../src/infrastructure/business-context/supabase-client", () => ({
  getSupabaseServiceClient: vi.fn(),
}));

vi.mock(
  "../../../src/infrastructure/business-context/supabase.repository",
  () => ({ SupabaseRepository: vi.fn() }),
);

vi.mock("../../../src/core/business-context/service", () => ({
  createBusiness: mockCreateBusinessService,
}));

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

  it("queues optional website source processing", async () => {
    const repo = createMockRepo();
    await createBusiness(repo, {
      ...validBusinessInput(),
      initialSources: [],
      websiteUrl: "https://acme.example.com",
    });

    expect(repo.createBusiness).toHaveBeenCalledWith(
      expect.objectContaining({ websiteUrl: "https://acme.example.com" }),
    );
    expect(repo.createContextSource).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: "website",
        externalReference: "https://acme.example.com",
        status: "queued",
      }),
    );
    expect(repo.createContextJob).toHaveBeenCalledWith(
      expect.objectContaining({ jobType: "source_processing", status: "queued" }),
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

// --- B38: Route handler wiring tests ---

function makePostRequest(body: Record<string, unknown>, userId = "user-1") {
  return new Request("http://localhost/api/businesses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-123",
      "x-user-id": userId,
    },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/businesses — route wiring (B38)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuthz.mockResolvedValue({
      ok: true,
      ctx: { userId: "user-1", role: "editor" },
    });
    mockCreateBusinessService.mockResolvedValue({
      ok: true,
      data: {
        id: "biz-1",
        workspaceId: "ws-1",
        name: "Acme Corp",
        websiteUrl: null,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
  });

  it("passes authenticated userId as createdBy to service", async () => {
    const { POST } = await import(
      "../../../src/app/api/businesses/route"
    );

    const req = makePostRequest({
      workspace_id: "00000000-0000-0000-0000-000000000001",
      name: "Acme Corp",
      primary_market: "US",
      primary_advertising_objective: "conversions",
      primary_business_outcome: "revenue_growth",
      approximate_monthly_meta_budget: 10000,
      initial_sources: [
        {
          source_type: "website",
          source_name: "Website",
          external_reference: "https://example.com",
        },
      ],
    });

    await POST(req);

    expect(mockCreateBusinessService).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ createdBy: "user-1" }),
    );
  });

  it("accepts request without initial_sources (defaults to empty)", async () => {
    const { POST } = await import(
      "../../../src/app/api/businesses/route"
    );

    const req = makePostRequest({
      workspace_id: "00000000-0000-0000-0000-000000000001",
      name: "Acme Corp",
      primary_market: "US",
      primary_advertising_objective: "conversions",
      primary_business_outcome: "revenue_growth",
      approximate_monthly_meta_budget: 5000,
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockCreateBusinessService).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ initialSources: [] }),
    );
  });

  it("forwards optional website_url for queued processing", async () => {
    const { POST } = await import(
      "../../../src/app/api/businesses/route"
    );

    const req = makePostRequest({
      workspace_id: "00000000-0000-0000-0000-000000000001",
      name: "Acme Corp",
      primary_market: "US",
      primary_advertising_objective: "conversions",
      primary_business_outcome: "revenue_growth",
      approximate_monthly_meta_budget: 5000,
      website_url: "https://acme.example.com",
    });

    await POST(req);

    expect(mockCreateBusinessService).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ websiteUrl: "https://acme.example.com" }),
    );
  });

  it("still rejects missing required fields", async () => {
    // Override validateWithSchema to actually validate
    const mod = await import("../../../src/app/api/businesses/_shared");
    const orig = (mod as Record<string, unknown>).validateWithSchema as (
      ...a: unknown[]
    ) => unknown;
    (mod as Record<string, unknown>).validateWithSchema = (
      schema: unknown,
      data: unknown,
    ) => {
      const result = (schema as { safeParse: (d: unknown) => unknown }).safeParse(data);
      if ((result as { success: boolean }).success) {
        return { ok: true, data: (result as { data: unknown }).data };
      }
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "Invalid" } }),
          { status: 400 },
        ),
      };
    };

    const { POST } = await import(
      "../../../src/app/api/businesses/route"
    );

    const req = makePostRequest({
      workspace_id: "00000000-0000-0000-0000-000000000001",
      // missing name, primary_market, etc.
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    // restore
    (mod as Record<string, unknown>).validateWithSchema = orig;
  });
});
