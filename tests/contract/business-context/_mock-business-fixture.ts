import type { Business, OnboardingSession } from "../../../src/core/business-context/types";

export function createBusinessData(now: Date): Business {
  return {
    id: "biz-1",
    workspaceId: "ws-1",
    name: "Acme Corp",
    websiteUrl: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export function createOnboardingSessionData(now: Date): OnboardingSession {
  return {
    id: "os-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    status: "created",
    currentStep: null,
    startedBy: "user-1",
    startedAt: now,
    completedAt: null,
    error: null,
  };
}
