/**
 * B12 Acceptance Tests — normalized-key precedence + one-conflict-per-key.
 *
 * Proves:
 *  1. Facts with different literal keys that normalize identically share the
 *     same active set, so precedence logic applies across variants.
 *  2. When multiple incoming facts conflict against the same normalized key,
 *     the deduplication step collapses them into exactly ONE open conflict
 *     entry with all unique values/factIds merged.
 */
import { describe, expect, it } from "vitest";
import {
  resolveFacts,
  detectConflicts,
  normalizeFactKey,
} from "@/core/business-context/resolver";
import type { ExtractedFact } from "@/core/business-context/extraction.port";
import type { ContextFact } from "@/core/business-context/types";

// ── helpers ────────────────────────────────────────────────────────────────

function incoming(overrides: Partial<ExtractedFact>): ExtractedFact {
  return {
    factKey: "business.name",
    value: "Acme",
    confidence: 0.9,
    sourceExcerpt: null,
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
    sourceExcerpt: null,
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

// ── B12.1  Normalized-key precedence ──────────────────────────────────────

describe("B12 — normalized-key precedence", () => {
  it("user_verified fact blocks supersede regardless of literal key variant", () => {
    // Existing fact stored under "Business_Name" (literal)
    // Incoming uses "business.name" (normalized equivalent).
    // user_verified should NOT be superseded → conflict.
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "Business_Name",
          value: "Acme",
          verificationStatus: "user_verified",
        }),
      ],
      [incoming({ factKey: "business.name", value: "Globex", confidence: 1.0 })]
    );
    expect(r.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(r.superseded).toHaveLength(0);
    expect(r.toCreate).toHaveLength(0);
  });

  it("lower-precedence active fact is superseded by incoming LLM fact", () => {
    // Existing "extracted" (non-user_verified) → precedenceSourceOf returns 'llm'
    // Incoming also 'llm' precedence. Same precedence → higher confidence wins.
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "business.name",
          value: "Old",
          confidence: 0.5,
          verificationStatus: "extracted",
        }),
      ],
      [incoming({ factKey: "business.name", value: "New", confidence: 0.9 })]
    );
    expect(r.superseded).toHaveLength(1);
    expect(r.superseded[0].oldFactId).toBe("f-1");
    expect(r.toCreate).toHaveLength(1);
  });

  it("equal-precedence, lower-confidence incoming creates conflict", () => {
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "business.name",
          value: "High",
          confidence: 0.95,
          verificationStatus: "extracted",
        }),
      ],
      [incoming({ factKey: "business.name", value: "Low", confidence: 0.3 })]
    );
    expect(r.conflicts.length).toBeGreaterThanOrEqual(1);
    expect(r.superseded).toHaveLength(0);
    expect(r.toCreate).toHaveLength(0);
  });

  it("different literal keys that normalize identically share active set", () => {
    // Two existing facts under different literal keys, same normalized key.
    // Both are active and have different values → incoming should see BOTH.
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "Business_Name",
          value: "Acme",
          verificationStatus: "extracted",
        }),
        existing({
          id: "f-2",
          factKey: "business_name",
          value: "Globex",
          verificationStatus: "extracted",
        }),
      ],
      [incoming({ factKey: "business.name", value: "Initech" })]
    );
    // Multiple active facts with different values → conflict (not supersede)
    expect(r.conflicts.length).toBeGreaterThanOrEqual(1);
    const conflict = r.conflicts.find((c) =>
      normalizeFactKey(c.factKey) === normalizeFactKey("business.name")
    );
    expect(conflict).toBeDefined();
    expect(conflict!.factIds).toContain("f-1");
    expect(conflict!.factIds).toContain("f-2");
  });

  it("superseded facts are excluded from active set even with variant keys", () => {
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "Business_Name",
          value: "Old",
          verificationStatus: "superseded",
        }),
        existing({
          id: "f-2",
          factKey: "business_name",
          value: "AlsoOld",
          verificationStatus: "rejected",
        }),
      ],
      [incoming({ factKey: "business.name", value: "New" })]
    );
    // Both existing are inactive → should create, not conflict
    expect(r.toCreate).toHaveLength(1);
    expect(r.conflicts).toHaveLength(0);
  });
});

// ── B12.2  Exactly one open conflict per normalized key ───────────────────

describe("B12 — exactly one open conflict per key", () => {
  it("multiple conflicting incoming facts → one deduped conflict entry", () => {
    // One existing user_verified fact. Two incoming facts with different
    // literal keys that both normalize to the same key and conflict.
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
        incoming({ factKey: "Business_Name", value: "Initech" }),
        incoming({ factKey: "BUSINESS_NAME", value: "Umbrella" }),
      ]
    );
    // B29: exactly ONE conflict entry for the normalized key
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].factIds).toContain("f-1");
    // All unique values should be merged into the single conflict
    const values = r.conflicts[0].values.map((v) =>
      JSON.stringify(v)
    );
    expect(values).toContain(JSON.stringify("Acme"));
    expect(values).toContain(JSON.stringify("Globex"));
    expect(values).toContain(JSON.stringify("Initech"));
    expect(values).toContain(JSON.stringify("Umbrella"));
  });

  it("detectConflicts: normalized duplicate contradictions → exactly one", () => {
    const c = detectConflicts([
      existing({ id: "f-1", factKey: "Business_Name", value: "Acme" }),
      existing({ id: "f-2", factKey: "business.name", value: "Globex" }),
      existing({ id: "f-3", factKey: "BUSINESS_NAME", value: "Initech" }),
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].factIds).toHaveLength(3);
    expect(c[0].values).toHaveLength(3);
  });

  it("conflicts across multiple normalized keys remain separate", () => {
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "business.name",
          value: "Acme",
          verificationStatus: "user_verified",
        }),
        existing({
          id: "f-2",
          factKey: "offers.primary",
          value: "Consulting",
          verificationStatus: "user_verified",
        }),
      ],
      [
        incoming({ factKey: "business.name", value: "Globex" }),
        incoming({ factKey: "offers.primary", value: "SaaS" }),
      ]
    );
    // Two distinct normalized keys → two conflict entries
    expect(r.conflicts).toHaveLength(2);
    const keys = r.conflicts.map((c) => normalizeFactKey(c.factKey));
    expect(keys).toContain(normalizeFactKey("business.name"));
    expect(keys).toContain(normalizeFactKey("offers.primary"));
  });

  it("no conflicts when all incoming values match existing", () => {
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "Business_Name",
          value: "Acme",
          verificationStatus: "user_verified",
        }),
      ],
      [incoming({ factKey: "business.name", value: "Acme" })]
    );
    // Matching value → update, not conflict
    expect(r.conflicts).toHaveLength(0);
    expect(r.toUpdate.length).toBeGreaterThanOrEqual(1);
  });

  it("mixed supersede and conflict across keys produce correct counts", () => {
    const r = resolveFacts(
      [
        existing({
          id: "f-1",
          factKey: "business.name",
          value: "Old",
          confidence: 0.4,
          verificationStatus: "extracted",
        }),
        existing({
          id: "f-2",
          factKey: "offers.primary",
          value: "Consulting",
          verificationStatus: "user_verified",
        }),
      ],
      [
        incoming({ factKey: "business.name", value: "New", confidence: 0.9 }),
        incoming({ factKey: "offers.primary", value: "SaaS" }),
      ]
    );
    // f-1 superseded (extracted, lower confidence), f-2 conflicts (user_verified)
    expect(r.superseded).toHaveLength(1);
    expect(r.superseded[0].oldFactId).toBe("f-1");
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].factIds).toContain("f-2");
  });
});
