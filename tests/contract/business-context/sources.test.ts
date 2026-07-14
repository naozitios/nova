import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// T065 — Contract test: source APIs
// POST   /api/businesses/:id/context/sources              — register source
// GET    /api/businesses/:id/context/sources              — list sources
// GET    /api/businesses/:id/context/sources/:sourceId   — inspect source
// POST   /api/businesses/:id/context/sources/:sourceId/process — queue processing
// POST   /api/businesses/:id/context/sources/:sourceId/archive — archive source
// Idempotency behavior on mutating endpoints.
// Route handlers do not exist yet → all tests fail (RED phase).
// ---------------------------------------------------------------------------

const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const BUSINESS_ID = "10000000-0000-0000-0000-000000000002";
const SOURCE_ID = "20000000-0000-0000-0000-000000000001";
const EDITOR_USER_ID = "10000000-0000-0000-0000-000000000010";
const VIEWER_USER_ID = "10000000-0000-0000-0000-000000000011";

const SOURCE_BASE = `${BASE}/api/businesses/${BUSINESS_ID}/context/sources`;

function validRegisterBody() {
  return {
    source_type: "website",
    source_name: "Company Website",
    external_reference: "https://acme.example.com",
    metadata: { crawl_budget: 50 },
  };
}

// ---------------------------------------------------------------------------
// POST /api/businesses/:id/context/sources — register source
// ---------------------------------------------------------------------------

describe("POST /api/businesses/:id/context/sources — contract", () => {
  it("returns 201 with valid source fields and idempotency key", async () => {
    const res = await fetch(SOURCE_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(validRegisterBody()),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.workspace_id).toBeDefined();
    expect(body.business_id).toBe(BUSINESS_ID);
    expect(body.source_type).toBe("website");
    expect(body.source_name).toBe("Company Website");
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("metadata");
    expect(body).toHaveProperty("collected_at");
  });

  it("rejects request without idempotency key", async () => {
    const res = await fetch(SOURCE_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(validRegisterBody()),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("rejects request without source_type", async () => {
    const body = validRegisterBody();
    delete (body as Record<string, unknown>).source_type;

    const res = await fetch(SOURCE_BASE, {
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

  it("rejects request without source_name", async () => {
    const body = validRegisterBody();
    delete (body as Record<string, unknown>).source_name;

    const res = await fetch(SOURCE_BASE, {
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
    const res = await fetch(SOURCE_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": VIEWER_USER_ID,
      },
      body: JSON.stringify(validRegisterBody()),
    });

    expect([401, 403]).toContain(res.status);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("rejects unauthenticated request", async () => {
    const res = await fetch(SOURCE_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
      },
      body: JSON.stringify(validRegisterBody()),
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.error.code).toMatch(/UNAUTHENTICATED|UNAUTHORIZED/);
  });

  it("returns error envelope with code and message on validation failure", async () => {
    const res = await fetch(SOURCE_BASE, {
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

  it("registers source with upload source_type", async () => {
    const res = await fetch(SOURCE_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify({
        source_type: "product_document",
        source_name: "Product Spec v2",
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.source_type).toBe("product_document");
    expect(body.source_name).toBe("Product Spec v2");
  });

  it("registers source with meta source_type", async () => {
    const res = await fetch(SOURCE_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify({
        source_type: "meta",
        source_name: "Meta Ads Account",
        metadata: { account_id: "act_123456" },
      }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.source_type).toBe("meta");
    expect(body.source_name).toBe("Meta Ads Account");
  });
});

// ---------------------------------------------------------------------------
// GET /api/businesses/:id/context/sources — list sources
// ---------------------------------------------------------------------------

describe("GET /api/businesses/:id/context/sources — contract", () => {
  it("returns 200 with source list", async () => {
    const res = await fetch(SOURCE_BASE, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.sources) || Array.isArray(body)).toBe(true);
  });

  it("rejects unauthenticated request", async () => {
    const res = await fetch(SOURCE_BASE, {
      method: "GET",
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  it("allows viewer role to list sources (read-only)", async () => {
    const res = await fetch(SOURCE_BASE, {
      method: "GET",
      headers: {
        "X-User-Id": VIEWER_USER_ID,
      },
    });

    expect([200, 401, 403]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// GET /api/businesses/:id/context/sources/:sourceId — inspect source
// ---------------------------------------------------------------------------

describe("GET /api/businesses/:id/context/sources/:sourceId — contract", () => {
  const sourceUrl = `${SOURCE_BASE}/${SOURCE_ID}`;

  it("returns 200 with source detail", async () => {
    const res = await fetch(sourceUrl, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body.id).toBe(SOURCE_ID);
    expect(body).toHaveProperty("source_type");
    expect(body).toHaveProperty("source_name");
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("metadata");
    expect(body).toHaveProperty("collected_at");
  });

  it("returns 404 for nonexistent source", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000099";
    const res = await fetch(`${SOURCE_BASE}/${fakeId}`, {
      method: "GET",
      headers: {
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect([404, 403]).toContain(res.status);
  });

  it("rejects unauthenticated request", async () => {
    const res = await fetch(sourceUrl, {
      method: "GET",
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/businesses/:id/context/sources/:sourceId/process — queue processing
// ---------------------------------------------------------------------------

describe("POST /api/businesses/:id/context/sources/:sourceId/process — contract", () => {
  const processUrl = `${SOURCE_BASE}/${SOURCE_ID}/process`;

  it("returns 202 with queued job and required fields", async () => {
    const res = await fetch(processUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("job_type");
    expect(body).toHaveProperty("attempt_count");
    expect(body).toHaveProperty("idempotency_key");
    expect(body).toHaveProperty("input");
    expect(body).toHaveProperty("created_at");
  });

  it("rejects request without idempotency key", async () => {
    const res = await fetch(processUrl, {
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
    const res = await fetch(processUrl, {
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

  it("rejects viewer role (no mutation)", async () => {
    const res = await fetch(processUrl, {
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

  it("returns 404 for nonexistent source", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000099";
    const res = await fetch(`${SOURCE_BASE}/${fakeId}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect([404, 403]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// POST /api/businesses/:id/context/sources/:sourceId/archive — archive source
// ---------------------------------------------------------------------------

describe("POST /api/businesses/:id/context/sources/:sourceId/archive — contract", () => {
  const archiveUrl = `${SOURCE_BASE}/${SOURCE_ID}/archive`;

  it("returns 200 with archived source", async () => {
    const res = await fetch(archiveUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(body).toHaveProperty("status");
  });

  it("rejects request without idempotency key", async () => {
    const res = await fetch(archiveUrl, {
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
    const res = await fetch(archiveUrl, {
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

  it("rejects viewer role (no mutation)", async () => {
    const res = await fetch(archiveUrl, {
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

  it("returns 404 for nonexistent source", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000099";
    const res = await fetch(`${SOURCE_BASE}/${fakeId}/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `test-${crypto.randomUUID()}`,
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect([404, 403]).toContain(res.status);
  });
});

// ---------------------------------------------------------------------------
// Idempotency behavior — register + process + archive
// ---------------------------------------------------------------------------

describe("Idempotency — source APIs", () => {
  it("register returns same source on duplicate idempotency key", async () => {
    const key = `test-idempotent-${crypto.randomUUID()}`;

    const first = await fetch(SOURCE_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(validRegisterBody()),
    });

    const second = await fetch(SOURCE_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "X-User-Id": EDITOR_USER_ID,
      },
      body: JSON.stringify(validRegisterBody()),
    });

    // Both should succeed (201 or 200 on replay)
    expect(first.status).toBe(201);
    expect([200, 201]).toContain(second.status);

    const a = await first.json();
    const b = await second.json();
    expect(a.id).toBe(b.id);
  });

  it("process returns same job on duplicate idempotency key", async () => {
    const key = `test-idempotent-process-${crypto.randomUUID()}`;

    const first = await fetch(`${SOURCE_BASE}/${SOURCE_ID}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    const second = await fetch(`${SOURCE_BASE}/${SOURCE_ID}/process`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(first.status).toBe(202);
    expect([200, 202]).toContain(second.status);

    const a = await first.json();
    const b = await second.json();
    expect(a.id).toBe(b.id);
  });

  it("archive returns same result on duplicate idempotency key", async () => {
    const key = `test-idempotent-archive-${crypto.randomUUID()}`;

    const first = await fetch(`${SOURCE_BASE}/${SOURCE_ID}/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    const second = await fetch(`${SOURCE_BASE}/${SOURCE_ID}/archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    expect(first.status).toBe(200);
    expect([200, 409]).toContain(second.status); // 409 if already archived

    const a = await first.json();
    const b = await second.json();
    expect(a.id).toBe(b.id);
  });
});
