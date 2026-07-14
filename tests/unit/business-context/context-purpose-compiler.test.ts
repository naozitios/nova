import { describe, expect, it } from "vitest";
import {
  compileContextForPurpose,
  getAllowedSections,
  isValidPurpose,
} from "@/core/business-context/context-purpose-compiler";
import { ContextPurpose } from "@/core/business-context/types";
import type { BusinessProfileVersion, JsonValue } from "@/core/business-context/types";

function makeProfileVersion(
  profile: Record<string, JsonValue>,
): BusinessProfileVersion {
  return {
    id: "pv-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    version: 1,
    profile,
    profileMarkdown: null,
    status: "current",
    changeSummary: null,
    createdBy: "user-1",
    createdAt: new Date(),
    approvedBy: "user-1",
    approvedAt: new Date(),
  };
}

describe("compileContextForPurpose", () => {
  it("returns only allowed sections for campaign_setup", () => {
    const pv = makeProfileVersion({
      offers: { primary: "Widget" },
      customers: { segment: "B2B" },
      brand: { tone: "pro" },
      creative_capacity: { capacity: "high" },
      economics: { ltv: 500 },
    });

    const result = compileContextForPurpose(pv, ContextPurpose.CAMPAIGN_SETUP);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data.context)).toEqual(
        expect.arrayContaining(["offers", "customers", "brand", "creative_capacity"]),
      );
      expect(result.data.context.economics).toBeUndefined();
      expect(result.data.purpose).toBe("campaign_setup");
      expect(result.data.business_context_version).toBe("pv-1");
      expect(typeof result.data.compiled_at).toBe("string");
    }
  });

  it("returns only allowed sections for performance_analysis", () => {
    const pv = makeProfileVersion({
      economics: { ltv: 500 },
      measurement: { kpis: ["roas"] },
      offers: { primary: "Widget" },
      customers: { segment: "B2B" },
    });

    const result = compileContextForPurpose(pv, ContextPurpose.PERFORMANCE_ANALYSIS);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data.context)).toEqual(
        expect.arrayContaining(["economics", "measurement", "offers"]),
      );
      expect(result.data.context.customers).toBeUndefined();
    }
  });

  it("tracks unresolved_fields for missing sections", () => {
    const pv = makeProfileVersion({
      offers: { primary: "Widget" },
    });

    const result = compileContextForPurpose(pv, ContextPurpose.CAMPAIGN_SETUP);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.unresolved_fields).toEqual(
        expect.arrayContaining(["customers", "brand", "creative_capacity"]),
      );
      expect(result.data.context.offers).toBeDefined();
    }
  });

  it("marks empty object sections as unresolved", () => {
    const pv = makeProfileVersion({
      offers: { primary: "Widget" },
      customers: {},
      brand: { tone: "pro" },
      creative_capacity: { capacity: "high" },
    });

    const result = compileContextForPurpose(pv, ContextPurpose.CAMPAIGN_SETUP);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.unresolved_fields).toContain("customers");
      expect(result.data.context.customers).toBeUndefined();
    }
  });

  it("returns error for unknown purpose", () => {
    const pv = makeProfileVersion({});
    const result = compileContextForPurpose(pv, "nonexistent" as any);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INVALID_PURPOSE");
    }
  });

  it("works with all six purposes", () => {
    const pv = makeProfileVersion({
      offers: { primary: "W" },
      customers: { segment: "B2B" },
      brand: { tone: "pro" },
      creative_capacity: { cap: "high" },
      economics: { ltv: 500 },
      measurement: { kpis: [] },
      conversion_journey: { steps: [] },
    });

    for (const purpose of Object.values(ContextPurpose)) {
      const result = compileContextForPurpose(pv, purpose);
      expect(result.ok).toBe(true);
    }
  });
});

describe("getAllowedSections", () => {
  it("returns sections for valid purpose", () => {
    const sections = getAllowedSections(ContextPurpose.CREATIVE_BRIEF);
    expect(sections).toContain("offers");
    expect(sections).toContain("brand");
  });

  it("returns empty array for unknown purpose", () => {
    const sections = getAllowedSections("unknown" as any);
    expect(sections).toEqual([]);
  });
});

describe("isValidPurpose", () => {
  it("returns true for valid purpose strings", () => {
    expect(isValidPurpose("campaign_setup")).toBe(true);
    expect(isValidPurpose("performance_analysis")).toBe(true);
    expect(isValidPurpose("tracking_audit")).toBe(true);
  });

  it("returns false for invalid strings", () => {
    expect(isValidPurpose("bogus")).toBe(false);
    expect(isValidPurpose("")).toBe(false);
  });
});
