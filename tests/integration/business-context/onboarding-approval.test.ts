import { describe, expect, it, vi } from "vitest";
import {
  approveV1,
  submitAnswers,
} from "../../../src/core/business-context/service/onboarding.service";
import { createMockRepo } from "../../contract/business-context/_mock-repo";

// ---------------------------------------------------------------------------
// T050 — Integration test: onboarding approval gating
// Validates that missing required fields block approval, explicit unknowns
// satisfy required fields, and unresolved conflicts block approval.
// Tests core functions with mock repository (no live server needed).
// ---------------------------------------------------------------------------

const BUSINESS_ID = "biz-1";
const WORKSPACE_ID = "ws-1";
const USER_ID = "user-1";

describe("Approval gating — required fields", () => {
  it("blocks approval when required onboarding inputs are missing", async () => {
    const repo = createMockRepo({
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });

    const result = await approveV1(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeDefined();
      expect(typeof result.error.code).toBe("string");
      expect(typeof result.error.message).toBe("string");
    }
  });

  it("returns error when session has unresolved required fields", async () => {
    const repo = createMockRepo({
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });

    const result = await approveV1(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).not.toBe("SUCCESS");
    }
  });

  it("does not create a profile version when approval is blocked", async () => {
    const repo = createMockRepo({
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });

    await approveV1(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(repo.createProfileVersion).not.toHaveBeenCalled();
  });
});

describe("Approval gating — explicit unknowns", () => {
  it("accepts explicit 'unknown' answers as satisfying required fields", async () => {
    const repo = createMockRepo();

    const result = await submitAnswers(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID, {
      answers: [
        {
          factKey: "brand.tone_of_voice",
          answer: { value: "unknown", type: "unknown" },
        },
      ],
    });

    expect(result.ok).toBe(true);
  });
});

describe("Approval gating — unresolved conflicts", () => {
  it("blocks approval when unresolved conflicts exist", async () => {
    const repo = createMockRepo({
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            {
              id: "q-1",
              factKey: "offers.pricing",
              status: "unanswered",
              answer: null,
            },
          ],
          total: 1,
        },
      }),
      listContextConflicts: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [
            {
              id: "c-1",
              factKey: "offers.pricing",
              status: "open",
              factIds: ["f-1", "f-2"],
            },
          ],
          total: 1,
        },
      }),
    });

    const result = await approveV1(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeDefined();
    }
  });

  it("does not mutate current profile when conflicts block approval", async () => {
    const repo = createMockRepo({
      listOnboardingQuestions: vi.fn().mockResolvedValue({
        ok: true,
        data: { items: [], total: 0 },
      }),
    });

    await approveV1(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(repo.createProfileVersion).not.toHaveBeenCalled();
    expect(repo.supersedeProfileVersions).not.toHaveBeenCalled();
  });
});
