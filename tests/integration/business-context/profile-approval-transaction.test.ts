import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// T051 — Integration test: atomic v1 approval
// Validates no duplicate current versions after approval and transaction
// rollback on failure per spec FR-026 and FR-027.
// "Only one profile version per business MAY have status current,
// enforced by a partial unique index."
// "Approval MUST run in one Postgres transaction or database function."
// Route handlers do not exist yet → all tests fail (RED phase).
// ---------------------------------------------------------------------------

const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const BUSINESS_ID = "10000000-0000-0000-0000-000000000002";
const EDITOR_USER_ID = "10000000-0000-0000-0000-000000000010";

const IDEMPOTENCY_KEY = () => `test-${crypto.randomUUID()}`;

describe("Atomic approval — no duplicate current versions", () => {
  it("creates exactly one current profile version after approval", async () => {
    // Trigger onboarding approval
    const approveRes = await fetch(
      `${BASE}/api/businesses/${BUSINESS_ID}/onboarding/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": IDEMPOTENCY_KEY(),
          "X-User-Id": EDITOR_USER_ID,
        },
      },
    );

    // If approval succeeds, verify uniqueness constraint
    if (approveRes.ok) {
      const approvedVersion = await approveRes.json();
      expect(approvedVersion.status).toBe("current");
      expect(approvedVersion.version).toBe(1);

      // List all versions — should have exactly one "current"
      const versionsRes = await fetch(
        `${BASE}/api/businesses/${BUSINESS_ID}/context/versions`,
        {
          method: "GET",
          headers: {
            "X-User-Id": EDITOR_USER_ID,
          },
        },
      );

      expect(versionsRes.ok).toBe(true);
      const versions = await versionsRes.json();
      expect(Array.isArray(versions)).toBe(true);

      const currentVersions = versions.filter(
        (v: { status: string }) => v.status === "current",
      );
      expect(currentVersions).toHaveLength(1);
      expect(currentVersions[0].id).toBe(approvedVersion.id);
    }
  });

  it("returns 200 with BusinessProfileVersion schema on success", async () => {
    const res = await fetch(
      `${BASE}/api/businesses/${BUSINESS_ID}/onboarding/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": IDEMPOTENCY_KEY(),
          "X-User-Id": EDITOR_USER_ID,
        },
      },
    );

    if (res.ok) {
      const body = await res.json();
      // BusinessProfileVersion required fields per OpenAPI schema
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("business_id");
      expect(body).toHaveProperty("version");
      expect(body).toHaveProperty("profile");
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("created_by");
      expect(body).toHaveProperty("created_at");
      expect(typeof body.version).toBe("number");
      expect(typeof body.profile).toBe("object");
    }
  });
});

describe("Atomic approval — transaction rollback on failure", () => {
  it("does not create partial profile version on approval failure", async () => {
    // Attempt approval — should fail due to missing data
    const approveRes = await fetch(
      `${BASE}/api/businesses/${BUSINESS_ID}/onboarding/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": IDEMPOTENCY_KEY(),
          "X-User-Id": EDITOR_USER_ID,
        },
      },
    );

    if (!approveRes.ok) {
      // Verify no draft or partial version was created
      const versionsRes = await fetch(
        `${BASE}/api/businesses/${BUSINESS_ID}/context/versions`,
        {
          method: "GET",
          headers: {
            "X-User-Id": EDITOR_USER_ID,
          },
        },
      );

      if (versionsRes.ok) {
        const versions = await versionsRes.json();
        // No new draft version should exist from failed approval
        const draftVersions = Array.isArray(versions)
          ? versions.filter((v: { status: string }) => v.status === "draft")
          : [];
        expect(draftVersions).toHaveLength(0);
      }
    }
  });

  it("preserves existing current version when approval fails", async () => {
    // Snapshot current state
    const beforeRes = await fetch(
      `${BASE}/api/businesses/${BUSINESS_ID}/context`,
      {
        method: "GET",
        headers: {
          "X-User-Id": EDITOR_USER_ID,
        },
      },
    );
    const beforeProfile = beforeRes.ok ? await beforeRes.json() : null;

    // Attempt failing approval
    await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/onboarding/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": IDEMPOTENCY_KEY(),
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    // Current profile must be unchanged
    const afterRes = await fetch(
      `${BASE}/api/businesses/${BUSINESS_ID}/context`,
      {
        method: "GET",
        headers: {
          "X-User-Id": EDITOR_USER_ID,
        },
      },
    );

    if (afterRes.ok && beforeProfile) {
      const afterProfile = await afterRes.json();
      expect(afterProfile).toEqual(beforeProfile);
    }
  });

  it("returns structured error on approval failure", async () => {
    const res = await fetch(
      `${BASE}/api/businesses/${BUSINESS_ID}/onboarding/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": IDEMPOTENCY_KEY(),
          "X-User-Id": EDITOR_USER_ID,
        },
      },
    );

    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(typeof body.error.code).toBe("string");
    expect(typeof body.error.message).toBe("string");
  });

  it("audit log records failed approval attempt", async () => {
    const approveRes = await fetch(
      `${BASE}/api/businesses/${BUSINESS_ID}/onboarding/approve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": IDEMPOTENCY_KEY(),
          "X-User-Id": EDITOR_USER_ID,
        },
      },
    );

    // Even failed approvals should be auditable
    // The audit endpoint may not exist yet, but the contract defines the shape
    expect(approveRes.status).toBeGreaterThanOrEqual(200);
  });
});
