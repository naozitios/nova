import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// T049 — Contract test: onboarding session create/get
// POST /api/businesses/{id}/onboarding creates session with status "created"
// GET /api/businesses/{id}/onboarding returns current session
// Workspace authorization enforced on both endpoints.
// Route handlers do not exist yet → all tests fail (RED phase).
// ---------------------------------------------------------------------------

const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const BUSINESS_ID = "10000000-0000-0000-0000-000000000002";
const EDITOR_USER_ID = "10000000-0000-0000-0000-000000000010";
const VIEWER_USER_ID = "10000000-0000-0000-0000-000000000011";
const UNAFFILIATED_USER_ID = "00000000-0000-0000-0000-000000000099";

describe("POST /api/businesses/{id}/onboarding — contract", () => {
  it("creates session with status 'created' and required fields", async () => {
    const res = await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/onboarding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.status).toBe("created");
    expect(body.business_id).toBe(BUSINESS_ID);
    expect(body).toHaveProperty("workspace_id");
    expect(body).toHaveProperty("started_by");
    expect(body).toHaveProperty("started_at");
  });

  it("rejects request without idempotency key", async () => {
    const res = await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/onboarding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("rejects unauthenticated request", async () => {
    const res = await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/onboarding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
      },
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe("GET /api/businesses/{id}/onboarding — contract", () => {
  it("returns current onboarding session", async () => {
    const res = await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/onboarding`, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("status");
    expect(body.business_id).toBe(BUSINESS_ID);
    expect(body).toHaveProperty("workspace_id");
  });

  it("rejects unauthenticated request", async () => {
    const res = await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/onboarding`, {
      method: "GET",
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects viewer role for mutating onboarding actions", async () => {
    const res = await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/onboarding`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": VIEWER_USER_ID,
      },
    });

    expect([401, 403]).toContain(res.status);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects user not in workspace", async () => {
    const res = await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/onboarding`, {
      method: "GET",
      headers: {
        "X-User-Id": UNAFFILIATED_USER_ID,
      },
    });

    expect([401, 403]).toContain(res.status);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});
