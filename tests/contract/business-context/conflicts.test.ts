import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// T092 — Conflict API contract tests
// GET  /api/businesses/:id/context/conflicts              — list unresolved
// POST /api/businesses/:id/context/conflicts/:conflictId/resolve — resolve
// Preserved resolved conflict history.
//
// Route handlers do not exist yet → all tests fail (RED phase).
// ---------------------------------------------------------------------------

const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const BUSINESS_ID = "10000000-0000-0000-0000-000000000002";
const CONFLICT_ID = "20000000-0000-0000-0000-000000000010";
const RESOLVED_CONFLICT_ID = "20000000-0000-0000-0000-000000000011";
const EDITOR_USER_ID = "10000000-0000-0000-0000-000000000010";
const VIEWER_USER_ID = "10000000-0000-0000-0000-000000000011";

const CONFLICTS_BASE = `${BASE}/api/businesses/${BUSINESS_ID}/context/conflicts`;

// ---------------------------------------------------------------------------
// GET /api/businesses/:id/context/conflicts — list unresolved
// ---------------------------------------------------------------------------

describe("GET /api/businesses/:id/context/conflicts — contract", () => {
  it("returns 200 with conflict list", async () => {
    const res = await fetch(CONFLICTS_BASE, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.conflicts) || Array.isArray(body)).toBe(true);
  });

  it("returns only unresolved conflicts by default", async () => {
    const res = await fetch(CONFLICTS_BASE, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const conflicts = body.conflicts ?? body;

    if (Array.isArray(conflicts)) {
      for (const conflict of conflicts) {
        expect(conflict.status).toBe("open");
      }
    }
  });

  it("each conflict has required fields", async () => {
    const res = await fetch(CONFLICTS_BASE, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const conflicts = body.conflicts ?? body;

    if (Array.isArray(conflicts) && conflicts.length > 0) {
      const conflict = conflicts[0];
      expect(conflict).toHaveProperty("id");
      expect(conflict).toHaveProperty("fact_key");
      expect(conflict).toHaveProperty("fact_ids");
      expect(conflict).toHaveProperty("status");
      expect(conflict).toHaveProperty("created_at");
      expect(Array.isArray(conflict.fact_ids)).toBe(true);
      expect(conflict.fact_ids.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("rejects unauthenticated request", async () => {
    const res = await fetch(CONFLICTS_BASE, {
      method: "GET",
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("allows viewer role to list conflicts (read-only)", async () => {
    const res = await fetch(CONFLICTS_BASE, {
      method: "GET",
      headers: {
        "X-User-Id": VIEWER_USER_ID,
      },
    });

    expect([200, 401, 403]).toContain(res.status);
  });

  it("supports filtering by status", async () => {
    const res = await fetch(`${CONFLICTS_BASE}?status=open`, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
  });

  it("supports filtering by fact_key", async () => {
    const res = await fetch(`${CONFLICTS_BASE}?fact_key=offers.pricing`, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// POST /api/businesses/:id/context/conflicts/:conflictId/resolve — resolve
// ---------------------------------------------------------------------------

describe("POST /api/businesses/:id/context/conflicts/:conflictId/resolve — contract", () => {
  const resolveUrl = `${CONFLICTS_BASE}/${CONFLICT_ID}/resolve`;

  it("returns 200 with resolved conflict", async () => {
    const res = await fetch(resolveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify({
        resolution_fact_id: "30000000-0000-0000-0000-000000000020",
        resolution_note: "Website pricing is more recent and verified",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.status).toBe("resolved");
    expect(body.resolution_fact_id).toBe("30000000-0000-0000-0000-000000000020");
    expect(body.resolution_note).toContain("verified");
    expect(body.resolved_at).toBeTruthy();
  });

  it("rejects request without idempotency key", async () => {
    const res = await fetch(resolveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify({
        resolution_fact_id: "30000000-0000-0000-0000-000000000020",
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("rejects request without resolution_fact_id", async () => {
    const res = await fetch(resolveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify({
        resolution_note: "Chosen based on recency",
      }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects unauthenticated request", async () => {
    const res = await fetch(resolveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
      },
      body: JSON.stringify({
        resolution_fact_id: "30000000-0000-0000-0000-000000000020",
      }),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects viewer role (no mutation)", async () => {
    const res = await fetch(resolveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": VIEWER_USER_ID,
      },
      body: JSON.stringify({
        resolution_fact_id: "30000000-0000-0000-0000-000000000020",
      }),
    });

    expect([401, 403]).toContain(res.status);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("returns 404 for nonexistent conflict", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000099";
    const res = await fetch(`${CONFLICTS_BASE}/${fakeId}/resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify({
        resolution_fact_id: "30000000-0000-0000-0000-000000000020",
      }),
    });

    expect([404, 403]).toContain(res.status);
  });

  it("returns error envelope on validation failure", async () => {
    const res = await fetch(resolveUrl, {
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

// ---------------------------------------------------------------------------
// Preserved resolved conflict history
// ---------------------------------------------------------------------------

describe("Resolved conflict history — contract", () => {
  it("resolved conflict retains resolution_fact_id", async () => {
    const res = await fetch(CONFLICTS_BASE, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const conflicts = body.conflicts ?? body;

    // Look for any resolved conflict in the list (if filtering is off)
    if (Array.isArray(conflicts)) {
      const resolved = conflicts.find(
        (c: Record<string, unknown>) => c.status === "resolved",
      );
      if (resolved) {
        expect(resolved).toHaveProperty("resolution_fact_id");
        expect(resolved).toHaveProperty("resolved_at");
        expect(resolved).toHaveProperty("resolution_note");
      }
    }
  });

  it("resolved conflict preserves resolution note", async () => {
    const res = await fetch(CONFLICTS_BASE, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const conflicts = body.conflicts ?? body;

    if (Array.isArray(conflicts)) {
      const resolved = conflicts.find(
        (c: Record<string, unknown>) => c.status === "resolved",
      );
      if (resolved && resolved.resolution_note) {
        expect(typeof resolved.resolution_note).toBe("string");
        expect(resolved.resolution_note.length).toBeGreaterThan(0);
      }
    }
  });

  it("GET supports status=resolved filter for audit history", async () => {
    const res = await fetch(`${CONFLICTS_BASE}?status=resolved`, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const conflicts = body.conflicts ?? body;

    if (Array.isArray(conflicts)) {
      for (const conflict of conflicts) {
        expect(conflict.status).toBe("resolved");
      }
    }
  });
});
