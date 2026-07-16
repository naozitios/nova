import { describe, expect, it } from "vitest";
import {
  normalizeFactKey,
  deduplicateFacts,
  resolveFacts,
  detectConflicts,
  generateQuestionsForGaps,
  SOURCE_PRECEDENCE,
} from "@/core/business-context/resolver";
import type { ExtractedFact } from "@/core/business-context/extraction.port";
import type { ContextFact } from "@/core/business-context/types";

function incoming(overrides: Partial<ExtractedFact>): ExtractedFact {
  return {
    factKey: "business.name",
    value: "Acme",
    confidence: 0.9,
    sourceExcerpt: "Acme",
    evidenceLocator: null,
    ...overrides,
  };
}

function existing(overrides: Partial<ContextFact>): ContextFact {
  return {
    id: "f-1",
    workspaceId: "ws-1",
    businessId: "biz-1",
    factKey: "business.name",
    value: "Acme",
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

describe("normalizeFactKey", () => {
  it("lowercases and replaces underscores with dots", () => {
    expect(normalizeFactKey("Business_Name")).toBe("business.name");
  });
  it("trims and collapses dots", () => {
    expect(normalizeFactKey("  a..b  ")).toBe("a.b");
  });
  it("strips leading/trailing dots", () => {
    expect(normalizeFactKey(".a.b.")).toBe("a.b");
  });
});

describe("SOURCE_PRECEDENCE", () => {
  it("ranks user_verified highest", () => {
    expect(SOURCE_PRECEDENCE.user_verified).toBeLessThan(SOURCE_PRECEDENCE.llm);
  });
});

describe("deduplicateFacts", () => {
  it("keeps highest confidence per factKey when values match", () => {
    const out = deduplicateFacts([
      incoming({ factKey: "a", value: 1, confidence: 0.4 }),
      incoming({ factKey: "a", value: 1, confidence: 0.9 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe(0.9);
  });

  it("does not collapse different values for the same key", () => {
    const out = deduplicateFacts([
      incoming({ factKey: "a", value: 1, confidence: 0.5 }),
      incoming({ factKey: "a", value: 2, confidence: 0.5 }),
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("resolveFacts", () => {
  it("creates new fact when none existing", () => {
    const r = resolveFacts([], [incoming({ factKey: "x", value: 1 })]);
    expect(r.toCreate.length).toBeGreaterThanOrEqual(1);
  });

  it("conflicts when existing is user_verified with different value", () => {
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "x",
          value: "old",
          verificationStatus: "user_verified",
        }),
      ],
      [incoming({ factKey: "x", value: "new" })]
    );
    expect(r.conflicts.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores superseded facts", () => {
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "x",
          value: 1,
          verificationStatus: "superseded",
        }),
      ],
      [incoming({ factKey: "x", value: 1 })]
    );
    expect(r.toCreate.length).toBeGreaterThanOrEqual(1);
  });
});

describe("detectConflicts", () => {
  it("normalized duplicate contradictions yield exactly one open conflict", () => {
    const c = detectConflicts([
      existing({ id: "f-1", factKey: "Business_Name", value: "Acme" }),
      existing({ id: "f-2", factKey: "business.name", value: "Globex" }),
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].factIds).toContain("f-1");
    expect(c[0].factIds).toContain("f-2");
    expect(c[0].values).toHaveLength(2);
  });

  it("resolveFacts deduplicates conflicts by normalized key", () => {
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "Business_Name",
          value: "Acme",
          verificationStatus: "user_verified",
        }),
      ],
      [
        incoming({ factKey: "business.name", value: "Globex" }),
        incoming({ factKey: "Business_Name", value: "Globex" }),
      ],
    );
    // B29: exactly one open conflict for normalized duplicate contradictions
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].factIds).toContain("f-1");
    expect(r.conflicts[0].values).toHaveLength(2);
  });

  it("returns no conflicts when values are aligned", () => {
    const c = detectConflicts([
      existing({ id: "f-1", factKey: "x", value: 1 }),
      existing({ id: "f-2", factKey: "x", value: 1 }),
    ]);
    expect(c).toHaveLength(0);
  });

  it("skips superseded facts in conflict detection", () => {
    const c = detectConflicts([
      existing({ id: "f-1", factKey: "x", value: 1 }),
      existing({ id: "f-2", factKey: "x", value: 2, verificationStatus: "superseded" }),
    ]);
    expect(c).toHaveLength(0);
  });
});

describe("generateQuestionsForGaps", () => {
  it("returns a question per gap factKey", () => {
    const q = generateQuestionsForGaps(
      ["business.industry", "offers.primary"],
      "biz-1",
      "ws-1",
      "sess-1"
    );
    expect(q).toHaveLength(2);
    expect(q[0].factKey).toBe("business.industry");
  });
});
