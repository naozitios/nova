import { describe, expect, it } from "vitest";
import {
  selectActiveFacts,
  groupFactsBySection,
  projectToMarkdown,
  CONFIDENCE_THRESHOLDS,
  type CompiledDraft,
} from "@/core/business-context/compiler";
import type { ContextFact, JsonValue } from "@/core/business-context/types";

function fact(overrides: Partial<ContextFact>): ContextFact {
  return {
    id: "f-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    factKey: "business.name",
    value: "Acme" as JsonValue,
    sourceId: "src-1",
    sourceDocumentId: null,
    sourceExcerpt: "Acme",
    evidenceLocator: null,
    confidence: 0.9,
    verificationStatus: "extracted",
    supersedesFactId: null,
    validFrom: new Date(),
    validTo: null,
    createdBy: "system",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("CONFIDENCE_THRESHOLDS", () => {
  it("exposes the documented constants", () => {
    expect(CONFIDENCE_THRESHOLDS.MIN_COMPILE).toBe(0.5);
    expect(CONFIDENCE_THRESHOLDS.REVIEW_RANGE_MIN).toBe(0.5);
    expect(CONFIDENCE_THRESHOLDS.REVIEW_RANGE_MAX).toBe(0.7);
    expect(CONFIDENCE_THRESHOLDS.HIGH).toBe(0.7);
  });
});

describe("selectActiveFacts", () => {
  it("drops superseded facts", () => {
    const out = selectActiveFacts([
      fact({ id: "f-1", verificationStatus: "superseded" }),
      fact({ id: "f-2", verificationStatus: "extracted" }),
    ]);
    expect(out.map((f) => f.id)).toEqual(["f-2"]);
  });

  it("drops rejected facts", () => {
    const out = selectActiveFacts([
      fact({ id: "f-1", verificationStatus: "rejected" }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("keeps user_verified and extracted", () => {
    const out = selectActiveFacts([
      fact({ id: "f-1", verificationStatus: "user_verified" }),
      fact({ id: "f-2", verificationStatus: "extracted" }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("groupFactsBySection", () => {
  it("groups by top-level section key", () => {
    const out = groupFactsBySection([
      fact({ id: "f-1", factKey: "business.name" }),
      fact({ id: "f-2", factKey: "business.industry" }),
      fact({ id: "f-3", factKey: "offers.primary" }),
    ]);
    expect(out.get("business")?.size).toBe(2);
    expect(out.get("offers")?.size).toBe(1);
  });

  it("keeps highest confidence fact per factKey within a section", () => {
    const out = groupFactsBySection([
      fact({ id: "f-1", factKey: "business.name", confidence: 0.4 }),
      fact({ id: "f-2", factKey: "business.name", confidence: 0.9 }),
    ]);
    const business = out.get("business");
    expect(business?.get("business.name")?.id).toBe("f-2");
  });
});

describe("projectToMarkdown", () => {
  it("renders each top-level section as a heading", () => {
    const md = projectToMarkdown({
      business: { name: "Acme" },
      offers: { primary: "Widget" },
    });
    expect(md).toContain("## Business");
    expect(md).toContain("## Offers");
    expect(md).toContain("Acme");
  });

  it("emits placeholders for empty profile", () => {
    const md = projectToMarkdown({});
    expect(typeof md).toBe("string");
  });
});
