import { describe, expect, it } from "vitest";
import { buildMetaEvidenceDocuments } from "@/infrastructure/business-context/meta/meta-evidence.builder";

const input = {
  metaAdAccountId: "act_123",
  dataWindow: { since: "2026-07-01", until: "2026-07-07" },
  freshness: { latestDate: "2026-07-07", missingWindowCount: 0, gapCount: 0 },
  campaigns: [
    { id: "camp-1", name: "Spring Sale", objective: "OUTCOME_SALES", status: "ACTIVE" },
  ],
  ads: [
    {
      id: "ad-1",
      name: "Discount Ad",
      status: "ACTIVE",
      creative: { body: "Save 20% today", title: "Sale", call_to_action_type: "SHOP_NOW" },
    },
  ],
  insights: [
    {
      metaAdId: "ad-1",
      dateStart: "2026-07-01",
      dateStop: "2026-07-07",
      spend: 123.45,
      impressions: 1000,
      clicks: 50,
      actions: [{ action_type: "purchase", value: "5" }],
      actionValues: [{ action_type: "purchase", value: "250" }],
    },
  ],
};

describe("buildMetaEvidenceDocuments", () => {
  it("returns an array of evidence documents", () => {
    const docs = buildMetaEvidenceDocuments(input);
    expect(Array.isArray(docs)).toBe(true);
    expect(docs.length).toBeGreaterThan(0);
  });

  it("creates a JSON document for campaign objectives", () => {
    const docs = buildMetaEvidenceDocuments(input);
    const campaignDoc = docs.find(
      (d: { type?: string; title?: string }) =>
        d.type === "campaign_objectives" || d.title?.toLowerCase().includes("campaign"),
    );
    expect(campaignDoc).toBeDefined();
    expect(campaignDoc!.mimeType).toBe("application/json");
    const parsed = JSON.parse(campaignDoc!.content);
    expect(parsed.campaigns).toBeDefined();
    expect(parsed.campaigns).toContainEqual(
      expect.objectContaining({ id: "camp-1", objective: "OUTCOME_SALES" }),
    );
  });

  it("creates a JSON document for active ads and creative copy", () => {
    const docs = buildMetaEvidenceDocuments(input);
    const adsDoc = docs.find(
      (d: { type?: string; title?: string }) =>
        d.type === "active_ads_creative" || d.title?.toLowerCase().includes("creative"),
    );
    expect(adsDoc).toBeDefined();
    expect(adsDoc!.mimeType).toBe("application/json");
    const parsed = JSON.parse(adsDoc!.content);
    expect(parsed.ads).toBeDefined();
    expect(parsed.ads).toContainEqual(
      expect.objectContaining({
        id: "ad-1",
        creative: expect.objectContaining({ body: "Save 20% today" }),
      }),
    );
  });

  it("creates a JSON document for spend ranges and performance", () => {
    const docs = buildMetaEvidenceDocuments(input);
    const spendDoc = docs.find(
      (d: { type?: string; title?: string }) =>
        d.type === "spend_performance" || d.title?.toLowerCase().includes("spend"),
    );
    expect(spendDoc).toBeDefined();
    expect(spendDoc!.mimeType).toBe("application/json");
    const parsed = JSON.parse(spendDoc!.content);
    expect(parsed.insights).toBeDefined();
    expect(parsed.insights).toContainEqual(
      expect.objectContaining({ metaAdId: "ad-1", spend: 123.45 }),
    );
  });

  it("creates a JSON document for optimization and conversion fields", () => {
    const docs = buildMetaEvidenceDocuments(input);
    const optDoc = docs.find(
      (d: { type?: string; title?: string }) =>
        d.type === "optimization_conversions" || d.title?.toLowerCase().includes("conversion"),
    );
    expect(optDoc).toBeDefined();
    expect(optDoc!.mimeType).toBe("application/json");
    const parsed = JSON.parse(optDoc!.content);
    expect(parsed.insights || parsed.conversions).toBeDefined();
  });

  it("every document has mimeType application/json", () => {
    const docs = buildMetaEvidenceDocuments(input);
    for (const doc of docs) {
      expect(doc.mimeType).toBe("application/json");
    }
  });

  it("every document has human-readable contentText with account ID", () => {
    const docs = buildMetaEvidenceDocuments(input);
    for (const doc of docs) {
      expect(doc.contentText).toBeDefined();
      expect(doc.contentText.length).toBeGreaterThan(0);
      expect(doc.contentText).toContain("act_123");
    }
  });

  it("every document contentText includes the data window", () => {
    const docs = buildMetaEvidenceDocuments(input);
    for (const doc of docs) {
      expect(doc.contentText).toContain("2026-07-01");
      expect(doc.contentText).toContain("2026-07-07");
    }
  });

  it("every document contentText includes the freshness date", () => {
    const docs = buildMetaEvidenceDocuments(input);
    for (const doc of docs) {
      expect(doc.contentText).toContain("2026-07-07");
    }
  });

  it("every document metadata includes metaAdAccountId", () => {
    const docs = buildMetaEvidenceDocuments(input);
    for (const doc of docs) {
      expect(doc.metaAdAccountId).toBe("act_123");
    }
  });

  it("every document metadata includes dataWindow", () => {
    const docs = buildMetaEvidenceDocuments(input);
    for (const doc of docs) {
      expect(doc.dataWindow).toEqual({ since: "2026-07-01", until: "2026-07-07" });
    }
  });

  it("every document metadata includes freshness", () => {
    const docs = buildMetaEvidenceDocuments(input);
    for (const doc of docs) {
      expect(doc.freshness).toEqual({
        latestDate: "2026-07-07",
        missingWindowCount: 0,
        gapCount: 0,
      });
    }
  });

  it("documents include raw row arrays or counts as appropriate", () => {
    const docs = buildMetaEvidenceDocuments(input);
    for (const doc of docs) {
      const parsed = JSON.parse(doc.content);
      const hasRowData =
        Array.isArray(parsed.campaigns) ||
        Array.isArray(parsed.ads) ||
        Array.isArray(parsed.insights) ||
        typeof parsed.campaignCount === "number" ||
        typeof parsed.adCount === "number" ||
        typeof parsed.insightCount === "number";
      expect(hasRowData).toBe(true);
    }
  });
});
