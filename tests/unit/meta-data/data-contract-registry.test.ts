import { describe, expect, it } from "vitest";
import {
  META_DATA_CONTRACTS,
  getMetaContractsForObject,
} from "@/core/meta-data/data-contract-registry";

describe("data-contract-registry", () => {
  describe("META_DATA_CONTRACTS", () => {
    it("exports an array of contracts", () => {
      expect(Array.isArray(META_DATA_CONTRACTS)).toBe(true);
      expect(META_DATA_CONTRACTS.length).toBeGreaterThan(0);
    });

    it("each contract has required shape", () => {
      for (const contract of META_DATA_CONTRACTS) {
        expect(contract).toHaveProperty("contractId");
        expect(contract).toHaveProperty("version");
        expect(contract).toHaveProperty("objectType");
        expect(contract).toHaveProperty("endpoint");
        expect(contract).toHaveProperty("fields");
        expect(contract).toHaveProperty("requiredPermissions");
        expect(contract).toHaveProperty("grain");
        expect(contract).toHaveProperty("validationKeys");
        expect(Array.isArray(contract.fields)).toBe(true);
        expect(Array.isArray(contract.requiredPermissions)).toBe(true);
        expect(Array.isArray(contract.validationKeys)).toBe(true);
      }
    });

    it("includes account.campaigns contract", () => {
      const contract = META_DATA_CONTRACTS.find(
        (c) => c.contractId === "account.campaigns",
      );
      expect(contract).toBeDefined();
      expect(contract!.objectType).toBe("campaign");
      expect(contract!.fields).toContain("id");
      expect(contract!.fields).toContain("name");
      expect(contract!.fields).toContain("objective");
      expect(contract!.fields).toContain("effective_status");
      expect(contract!.fields).toContain("configured_status");
      expect(contract!.fields).toContain("buying_type");
      expect(contract!.fields).toContain("start_time");
      expect(contract!.fields).toContain("stop_time");
      expect(contract!.fields).toContain("created_time");
      expect(contract!.fields).toContain("updated_time");
    });

    it("includes account.adsets contract", () => {
      const contract = META_DATA_CONTRACTS.find(
        (c) => c.contractId === "account.adsets",
      );
      expect(contract).toBeDefined();
      expect(contract!.objectType).toBe("ad_set");
      expect(contract!.fields).toContain("id");
      expect(contract!.fields).toContain("campaign_id");
      expect(contract!.fields).toContain("name");
      expect(contract!.fields).toContain("optimization_goal");
      expect(contract!.fields).toContain("billing_event");
      expect(contract!.fields).toContain("effective_status");
      expect(contract!.fields).toContain("configured_status");
      expect(contract!.fields).toContain("daily_budget");
      expect(contract!.fields).toContain("lifetime_budget");
      expect(contract!.fields).toContain("start_time");
      expect(contract!.fields).toContain("end_time");
      expect(contract!.fields).toContain("created_time");
      expect(contract!.fields).toContain("updated_time");
    });

    it("includes account.ads contract", () => {
      const contract = META_DATA_CONTRACTS.find(
        (c) => c.contractId === "account.ads",
      );
      expect(contract).toBeDefined();
      expect(contract!.objectType).toBe("ad");
      expect(contract!.fields).toContain("id");
      expect(contract!.fields).toContain("campaign_id");
      expect(contract!.fields).toContain("adset_id");
      expect(contract!.fields).toContain("name");
      expect(contract!.fields).toContain("effective_status");
      expect(contract!.fields).toContain("configured_status");
      expect(contract!.fields).toContain("creative{id}");
      expect(contract!.fields).toContain("created_time");
      expect(contract!.fields).toContain("updated_time");
    });

    it("includes account.creatives contract", () => {
      const contract = META_DATA_CONTRACTS.find(
        (c) => c.contractId === "account.creatives",
      );
      expect(contract).toBeDefined();
      expect(contract!.objectType).toBe("creative");
      expect(contract!.fields).toContain("id");
      expect(contract!.fields).toContain("name");
      expect(contract!.fields).toContain("title");
      expect(contract!.fields).toContain("body");
      expect(contract!.fields).toContain("object_story_spec");
      expect(contract!.fields).toContain("asset_feed_spec");
      expect(contract!.fields).toContain("thumbnail_url");
      expect(contract!.fields).toContain("image_url");
      expect(contract!.fields).toContain("video_id");
      expect(contract!.fields).toContain("effective_object_story_id");
    });
  });

  describe("getMetaContractsForObject", () => {
    it("returns contracts for campaign objectType", () => {
      const result = getMetaContractsForObject("campaign");
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.objectType === "campaign")).toBe(true);
    });

    it("returns contracts for ad_set objectType", () => {
      const result = getMetaContractsForObject("ad_set");
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.objectType === "ad_set")).toBe(true);
    });

    it("returns contracts for ad objectType", () => {
      const result = getMetaContractsForObject("ad");
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.objectType === "ad")).toBe(true);
    });

    it("returns contracts for creative objectType", () => {
      const result = getMetaContractsForObject("creative");
      expect(result.length).toBeGreaterThan(0);
      expect(result.every((c) => c.objectType === "creative")).toBe(true);
    });

    it("returns empty array for unknown objectType", () => {
      const result = getMetaContractsForObject("unknown" as never);
      expect(result).toEqual([]);
    });
  });
});
