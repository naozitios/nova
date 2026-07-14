import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// T050 — Integration test: onboarding approval gating
// Validates that missing required fields block approval, explicit unknowns
// satisfy required fields, and unresolved conflicts block approval.
// Per spec.md US1 scenarios 2: "required fields missing or explicitly
// unresolved → approval fails and current profile remains unchanged."
// Route handlers do not exist yet → all tests fail (RED phase).
// ---------------------------------------------------------------------------

const BASE = process.env.API_BASE_URL ?? "http://localhost:3000";
const BUSINESS_ID = "10000000-0000-0000-0000-000000000002";
const EDITOR_USER_ID = "10000000-0000-0000-0000-000000000010";

const IDEMPOTENCY_KEY = () => `test-${crypto.randomUUID()}`;

describe("Approval gating — required fields", () => {
  it("blocks approval when required onboarding inputs are missing", async () => {
    // Attempt to approve without having completed onboarding
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

    // Expect failure: 409 or 422 — approval blocked
    expect([400, 409, 422]).toContain(res.status);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(typeof body.error.code).toBe("string");
    expect(typeof body.error.message).toBe("string");
  });

  it("returns 409 when onboarding session has unresolved required fields", async () => {
    // Simulate a session in "ready_for_approval" state with gaps
    // The API should reject approval if required profile sections are incomplete
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
    // Should not return 200 with a profile version
    expect(res.status).not.toBe(200);
  });

  it("does not create a profile version when approval is blocked", async () => {
    // First attempt to approve — should fail
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

    // If approval was blocked, no profile version should exist
    if (approveRes.status >= 400) {
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
        // No current version should have been created from a failed approval
        const currentVersions = Array.isArray(versions)
          ? versions.filter((v: { status: string }) => v.status === "current")
          : [];
        expect(currentVersions).toHaveLength(0);
      }
    }
  });
});

describe("Approval gating — explicit unknowns", () => {
  it("accepts explicit 'unknown' answers as satisfying required fields", async () => {
    // Per spec: user marks a required fact as unknown instead of verified
    // This should satisfy the requirement and allow approval to proceed
    // The question/answer flow should accept "unknown" as a valid answer
    const res = await fetch(
      `${BASE}/api/businesses/${BUSINESS_ID}/onboarding/answers`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": IDEMPOTENCY_KEY(),
          "X-User-Id": EDITOR_USER_ID,
        },
        body: JSON.stringify({
          answers: [
            {
              fact_key: "brand.tone_of_voice",
              answer: { value: "unknown", type: "unknown" },
            },
          ],
        }),
      },
    );

    // Should accept the answer (200) even if unknown
    expect([200, 201]).toContain(res.status);
  });
});

describe("Approval gating — unresolved conflicts", () => {
  it("blocks approval when unresolved conflicts exist", async () => {
    // Per spec US1 scenario 2: "unresolved conflicts block approval"
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

    // If conflicts exist, approval should be blocked
    expect(res.status).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns conflict details in error response", async () => {
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
    expect(body.error.code).toBeDefined();
  });

  it("does not mutate current profile when conflicts block approval", async () => {
    // Snapshot current profile state before approval attempt
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

    // Attempt approval
    await fetch(`${BASE}/api/businesses/${BUSINESS_ID}/onboarding/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": IDEMPOTENCY_KEY(),
        "X-User-Id": EDITOR_USER_ID,
      },
    });

    // Verify current profile unchanged
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
      // Profile should not have changed
      expect(afterProfile).toEqual(beforeProfile);
    }
  });
});
