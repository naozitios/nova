import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// T048 — Contract test: POST /api/businesses
// Validates required fields, evidence source requirement, idempotency key,
// and editor authorization per OpenAPI contract and spec.md US1.
// Route handler does not exist yet → all tests fail (RED phase).
// ---------------------------------------------------------------------------

const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const WORKSPACE_ID = "10000000-0000-0000-0000-000000000001";
const EDITOR_USER_ID = "10000000-0000-0000-0000-000000000010";
const VIEWER_USER_ID = "10000000-0000-0000-0000-000000000011";

function validBusinessBody() {
  return {
    workspace_id: WORKSPACE_ID,
    name: "Acme Corp",
    primary_market: "US",
    primary_advertising_objective: "conversions",
    primary_business_outcome: "revenue_growth",
    approximate_monthly_meta_budget: 10000,
    initial_sources: [
      {
        source_type: "website",
        source_name: "Company Website",
        external_reference: "https://acme.example.com",
      },
    ],
  };
}

describe("POST /api/businesses — contract", () => {
  it("returns 201 with valid required fields and idempotency key", async () => {
    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(validBusinessBody()),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.workspace_id).toBe(WORKSPACE_ID);
    expect(body.name).toBe("Acme Corp");
    expect(body).toHaveProperty("created_at");
    expect(body).toHaveProperty("updated_at");
  });

  it("rejects request without idempotency key", async () => {
    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(validBusinessBody()),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("rejects request without name", async () => {
    const body = validBusinessBody();
    delete (body as Record<string, unknown>).name;

    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects request without primary_market", async () => {
    const body = validBusinessBody();
    delete (body as Record<string, unknown>).primary_market;

    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects request without primary_advertising_objective", async () => {
    const body = validBusinessBody();
    delete (body as Record<string, unknown>).primary_advertising_objective;

    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects request without primary_business_outcome", async () => {
    const body = validBusinessBody();
    delete (body as Record<string, unknown>).primary_business_outcome;

    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects request without approximate_monthly_meta_budget", async () => {
    const body = validBusinessBody();
    delete (body as Record<string, unknown>).approximate_monthly_meta_budget;

    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects request without initial_sources", async () => {
    const body = validBusinessBody();
    delete (body as Record<string, unknown>).initial_sources;

    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects request with empty initial_sources array", async () => {
    const body = validBusinessBody();
    (body as Record<string, unknown>).initial_sources = [];

    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects request from viewer role (authorization)", async () => {
    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": VIEWER_USER_ID,
      },
      body: JSON.stringify(validBusinessBody()),
    });

    expect([401, 403]).toContain(res.status);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects request without authentication", async () => {
    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
      },
      body: JSON.stringify(validBusinessBody()),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toMatch(/UNAUTHENTICATED|UNAUTHORIZED/);
  });

  it("returns error envelope with code and message on validation failure", async () => {
    const res = await fetch(`${BASE}/api/businesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(typeof data.error.code).toBe("string");
    expect(typeof data.error.message).toBe("string");
  });
});
