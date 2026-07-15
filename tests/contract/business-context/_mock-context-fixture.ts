import { ProfileVersionStatus } from "../../../src/core/business-context/types";
import type {
  BusinessProfileVersion,
  ContextConflict,
  ContextSource,
} from "../../../src/core/business-context/types";

export function createContextSourceData(now: Date): ContextSource {
  return {
    id: "src-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    sourceType: "website",
    sourceName: "Company Website",
    externalReference: "https://acme.example.com",
    status: "registered",
    currentStage: null,
    terminalOutcome: null,
    metadata: {},
    collectedAt: now,
  };
}

export function createContextSourceFromId(
  sourceId: string,
  now: Date,
): ContextSource | null {
  if (sourceId === "00000000-0000-0000-0000-000000000099") return null;
  return {
    id: sourceId,
    workspaceId: "ws-1",
    businessId: "biz-1",
    sourceType: "website",
    sourceName: "Company Website",
    externalReference: "https://acme.example.com",
    status: "registered",
    currentStage: null,
    terminalOutcome: null,
    metadata: {},
    collectedAt: now,
  };
}

export function createArchivedSourceData(now: Date): ContextSource {
  return {
    id: "src-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    sourceType: "website",
    sourceName: "Company Website",
    externalReference: "https://acme.example.com",
    status: "archived",
    currentStage: null,
    terminalOutcome: "archived",
    metadata: {},
    collectedAt: now,
  };
}

export function createContextConflictData(
  conflictId: string,
  now: Date,
): ContextConflict | null {
  if (conflictId === "00000000-0000-0000-0000-000000000099") return null;
  return {
    id: conflictId,
    workspaceId: "ws-1",
    businessId: "biz-1",
    factKey: "offers.pricing",
    factIds: ["f-1", "f-2"],
    status: "open",
    resolutionFactId: null,
    resolutionNote: null,
    resolvedBy: null,
    createdAt: now,
    resolvedAt: null,
  };
}

export function createContextConflictListData(now: Date): ContextConflict[] {
  return [
    {
      id: "c-1",
      workspaceId: "ws-1",
      businessId: "biz-1",
      factKey: "offers.pricing",
      factIds: ["f-1", "f-2"],
      status: "open",
      resolutionFactId: null,
      resolutionNote: null,
      resolvedBy: null,
      createdAt: now,
      resolvedAt: null,
    },
  ];
}

export function createResolvedConflictData(
  conflictId: string,
  resFactId: string,
  note: string | undefined,
  now: Date,
): ContextConflict {
  return {
    id: conflictId,
    workspaceId: "ws-1",
    businessId: "biz-1",
    factKey: "offers.pricing",
    factIds: ["f-1", "f-2"],
    status: "resolved",
    resolutionFactId: resFactId,
    resolutionNote: note ?? null,
    resolvedBy: "user-1",
    createdAt: now,
    resolvedAt: now,
  };
}

export function createProfileVersionData(now: Date): BusinessProfileVersion {
  return {
    id: "pv-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    version: 1,
    profile: {},
    profileMarkdown: null,
    status: ProfileVersionStatus.CURRENT,
    changeSummary: "Initial",
    createdBy: "user-1",
    createdAt: now,
    approvedBy: "user-1",
    approvedAt: now,
  };
}
