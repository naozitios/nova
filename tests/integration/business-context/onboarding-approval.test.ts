import { describe, expect, it, vi } from "vitest";
import {
  approveV1,
  submitAnswers,
} from "../../../src/core/business-context/service/onboarding.service";
import { createMockRepo } from "../../contract/business-context/_mock-repo";

// ---------------------------------------------------------------------------
// T050 — Integration test: onboarding approval gating
// Validates that the atomic approveV1 delegates to repo.approveOnboardingV1
// and that error mapping preserves existing route API contract.
// ---------------------------------------------------------------------------

const BUSINESS_ID = "biz-1";
const WORKSPACE_ID = "ws-1";
const USER_ID = "user-1";

describe("Approval gating — atomic RPC delegation", () => {
  it("delegates to repo.approveOnboardingV1", async () => {
    const repo = createMockRepo();
    await approveV1(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(repo.approveOnboardingV1).toHaveBeenCalledWith(
      WORKSPACE_ID,
      BUSINESS_ID,
      USER_ID,
    );
  });

  it("returns success when RPC succeeds", async () => {
    const repo = createMockRepo();
    const result = await approveV1(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("id");
      expect(result.data).toHaveProperty("version");
      expect(result.data).toHaveProperty("profile");
      expect(result.data.status).toBe("current");
    }
  });

  it("maps NO_SESSION error from RPC", async () => {
    const repo = createMockRepo({
      approveOnboardingV1: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "NO_SESSION", message: "No onboarding session found" },
      }),
    });

    const result = await approveV1(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NO_SESSION");
    }
  });

  it("maps PROFILE_INCOMPLETE error from RPC", async () => {
    const repo = createMockRepo({
      approveOnboardingV1: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: "PROFILE_INCOMPLETE",
          message: "Missing required sections: business",
          details: { missingSections: ["business"], unresolvedConflicts: 0 },
        },
      }),
    });

    const result = await approveV1(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("PROFILE_INCOMPLETE");
    }
  });

  it("does not call sequential repo methods (compile/validate/versioning)", async () => {
    const repo = createMockRepo();
    await approveV1(repo, BUSINESS_ID, WORKSPACE_ID, USER_ID);

    // These should NOT be called since we use atomic RPC
    expect(repo.listOnboardingSessions).not.toHaveBeenCalled();
    expect(repo.listOnboardingQuestions).not.toHaveBeenCalled();
    expect(repo.listContextConflicts).not.toHaveBeenCalled();
    expect(repo.getCurrentProfileVersion).not.toHaveBeenCalled();
    expect(repo.supersedeProfileVersions).not.toHaveBeenCalled();
    expect(repo.createProfileVersion).not.toHaveBeenCalled();
    expect(repo.createAuditLog).not.toHaveBeenCalled();
  });
});

describe("Approval gating — explicit unknowns", () => {
  it("accepts explicit 'unknown' answers as satisfying required fields", async () => {
    const repo = createMockRepo({
      createOnboardingQuestion: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "q-1", factKey: "brand.tone_of_voice", status: "answered" },
      }),
      updateOnboardingSession: vi.fn().mockResolvedValue({ ok: true, data: {} }),
    });

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
