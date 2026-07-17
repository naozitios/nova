import { describe, expect, it } from "vitest";
import {
  META_DATA_CONTRACTS,
  getMetaContractsForObject,
} from "@/core/meta-data/data-contract-registry";

describe("insights.ad_daily.v1 contract", () => {
  const contract = META_DATA_CONTRACTS.find(
    (c) => c.contractId === "insights.ad_daily.v1",
  );

  it("exists in the registry", () => {
    expect(contract).toBeDefined();
  });

  it("has objectType insight", () => {
    expect(contract!.objectType).toBe("insight");
  });

  it("uses the insights endpoint", () => {
    expect(contract!.endpoint).toBe("/{ad_account_id}/insights");
  });

  it("includes all required fields", () => {
    const expected = [
      "date_start",
      "date_stop",
      "campaign_id",
      "adset_id",
      "ad_id",
      "spend",
      "impressions",
      "reach",
      "clicks",
      "actions",
      "action_values",
    ];
    for (const field of expected) {
      expect(contract!.fields).toContain(field);
    }
  });

  it("has grain ad_daily", () => {
    expect(contract!.grain).toBe("ad_daily");
  });

  it("requires ads_read permission", () => {
    expect(contract!.requiredPermissions).toContain("ads_read");
  });

  it("has level ad", () => {
    expect(contract!.level).toBe("ad");
  });

  it("has cadence with initial_backfill and incremental", () => {
    expect(contract!.cadence).toBeDefined();
    expect(contract!.cadence!.initial_backfill).toBeDefined();
    expect(contract!.cadence!.incremental).toBeDefined();
  });

  it("is returned by getMetaContractsForObject('insight')", () => {
    const results = getMetaContractsForObject("insight");
    expect(results).toContainEqual(contract);
  });
});
