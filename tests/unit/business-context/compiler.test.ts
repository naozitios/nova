import { describe, expect, it, vi } from "vitest";
import {
  selectActiveFacts,
  groupFactsBySection,
  compileDraftFromFacts,
  projectToMarkdown,
  CONFIDENCE_THRESHOLDS,
  type CompiledDraft,
} from "@/core/business-context/compiler";
import type { ContextFact, JsonValue } from "@/core/business-context/types";
import type { RepositoryPort } from "@/core/business-context/repository.port";

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

// ─── compileDraftFromFacts — nested compilation ──────────────────────────────

function makeRepo(facts: ContextFact[]): RepositoryPort {
  return {
    listContextFacts: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: facts, total: facts.length },
    }),
    listContextConflicts: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: [], total: 0 },
    }),
  } as unknown as RepositoryPort;
}

describe("compileDraftFromFacts", () => {
  it("nests dotted keys within section objects", async () => {
    const repo = makeRepo([
      fact({ factKey: "offers.pricing.tier_count", value: 3 }),
      fact({ factKey: "offers.pricing.tier_name", value: "Pro" }),
    ]);
    const result = await compileDraftFromFacts(repo, "biz-1", "ws-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.profile.offers).toEqual({
      pricing: { tier_count: 3, tier_name: "Pro" },
    });
  });

  it("nests deeply dotted keys three levels deep", async () => {
    const repo = makeRepo([
      fact({
        factKey: "offers.pricing.enterprise.monthly",
        value: 999,
      }),
    ]);
    const result = await compileDraftFromFacts(repo, "biz-1", "ws-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.profile.offers).toEqual({
      pricing: { enterprise: { monthly: 999 } },
    });
  });

  it("keeps top-level section keys as direct values", async () => {
    const repo = makeRepo([
      fact({ factKey: "business.name", value: "Acme" }),
      fact({ factKey: "business.industry", value: "SaaS" }),
    ]);
    const result = await compileDraftFromFacts(repo, "biz-1", "ws-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.profile.business).toEqual({
      name: "Acme",
      industry: "SaaS",
    });
  });

  it("uses shared precedence (groupFactsBySection) — highest confidence wins per key", async () => {
    const repo = makeRepo([
      fact({
        factKey: "business.name",
        value: "Old Name",
        confidence: 0.6,
        id: "f-low",
      }),
      fact({
        factKey: "business.name",
        value: "New Name",
        confidence: 0.9,
        id: "f-high",
      }),
    ]);
    const result = await compileDraftFromFacts(repo, "biz-1", "ws-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.profile.business).toEqual({ name: "New Name" });
  });

  it("mixes nested and flat keys within one section", async () => {
    const repo = makeRepo([
      fact({ factKey: "offers.product_names", value: "Widget" }),
      fact({ factKey: "offers.pricing.tier_count", value: 3 }),
      fact({ factKey: "offers.pricing.tier_name", value: "Pro" }),
    ]);
    const result = await compileDraftFromFacts(repo, "biz-1", "ws-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.profile.offers).toEqual({
      product_names: "Widget",
      pricing: { tier_count: 3, tier_name: "Pro" },
    });
  });

  it("marks section unresolved when all facts below MIN_COMPILE", async () => {
    const repo = makeRepo([
      fact({
        factKey: "offers.product_names",
        value: "Maybe",
        confidence: 0.3,
      }),
    ]);
    const result = await compileDraftFromFacts(repo, "biz-1", "ws-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.profile.offers).toBeUndefined();
    expect(result.data.unresolvedFields).toContain("offers");
  });

  it("includes user_verified facts even below MIN_COMPILE", async () => {
    const repo = makeRepo([
      fact({
        factKey: "offers.pricing.tier_count",
        value: 2,
        confidence: 0.3,
        verificationStatus: "user_verified",
      }),
    ]);
    const result = await compileDraftFromFacts(repo, "biz-1", "ws-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.profile.offers).toEqual({
      pricing: { tier_count: 2 },
    });
    expect(result.data.unresolvedFields).not.toContain("offers");
  });

  it("includes market.primary and advertising.primary_objective in result.data.profile", async () => {
    const repo = makeRepo([
      fact({ factKey: "market.primary", value: "US SMBs" }),
      fact({ factKey: "advertising.primary_objective", value: "Lead generation" }),
    ]);
    const result = await compileDraftFromFacts(repo, "biz-1", "ws-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.profile.market).toEqual({ primary: "US SMBs" });
    expect(result.data.profile.advertising).toEqual({ primary_objective: "Lead generation" });
  });

  it("nests across multiple sections simultaneously", async () => {
    const repo = makeRepo([
      fact({ factKey: "business.name", value: "Acme" }),
      fact({ factKey: "business.location.city", value: "SF" }),
      fact({ factKey: "offers.pricing.tier_count", value: 3 }),
      fact({ factKey: "customers.primary_persona", value: "CTO" }),
    ]);
    const result = await compileDraftFromFacts(repo, "biz-1", "ws-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.profile.business).toEqual({
      name: "Acme",
      location: { city: "SF" },
    });
    expect(result.data.profile.offers).toEqual({
      pricing: { tier_count: 3 },
    });
    expect(result.data.profile.customers).toEqual({
      primary_persona: "CTO",
    });
  });
});
