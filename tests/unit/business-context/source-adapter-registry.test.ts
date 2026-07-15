import { describe, expect, it, vi } from "vitest";
import { SourceType } from "@/core/business-context/types/enums";
import {
  SourceAdapterRegistry,
  RegistryErrors,
} from "@/infrastructure/business-context/source-adapter-registry";
import type { SourceAdapterPort } from "@/core/business-context/source-adapter.port";

function makeAdapter(supports: string[]): SourceAdapterPort {
  return {
    supports: vi.fn().mockImplementation((t: string) => supports.includes(t)),
    collect: vi.fn().mockResolvedValue({ ok: true, data: {} as any }),
  };
}

describe("SourceAdapterRegistry", () => {
  it("registers adapter under every source type it supports", () => {
    const registry = new SourceAdapterRegistry();
    const adapter = makeAdapter(["website", "brand_deck"]);

    registry.register(adapter);

    expect(registry.hasAdapter("website")).toBe(true);
    expect(registry.hasAdapter("brand_deck")).toBe(true);
    expect(registry.hasAdapter("meta")).toBe(false);
  });

  it("returns adapter via getAdapter", () => {
    const registry = new SourceAdapterRegistry();
    const adapter = makeAdapter(["website"]);
    registry.register(adapter);

    expect(registry.getAdapter("website")).toBe(adapter);
    expect(registry.getAdapter("meta")).toBeNull();
  });

  it("resolve returns adapter for supported type", () => {
    const registry = new SourceAdapterRegistry();
    const adapter = makeAdapter(["user_answer"]);
    registry.register(adapter);

    const result = registry.resolve("user_answer");
    expect("adapter" in result).toBe(true);
    if ("adapter" in result) {
      expect(result.adapter).toBe(adapter);
    }
  });

  it("resolve returns error for unsupported type", () => {
    const registry = new SourceAdapterRegistry();

    const result = registry.resolve("unknown_type");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.code).toBe(RegistryErrors.UNSUPPORTED_SOURCE_TYPE);
    }
  });

  it("resolve uses custom unsupported message when registered", () => {
    const registry = new SourceAdapterRegistry();
    registry.registerUnsupported("meta", "Meta Ads API not configured");

    const result = registry.resolve("meta");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.message).toBe("Meta Ads API not configured");
    }
  });

  it("resolve falls back to default message when no custom message", () => {
    const registry = new SourceAdapterRegistry();

    const result = registry.resolve("meta");
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error.message).toContain("No adapter registered");
    }
  });

  it("listSupportedTypes returns all registered source types", () => {
    const registry = new SourceAdapterRegistry();
    registry.register(makeAdapter(["website", "brand_deck"]));
    registry.register(makeAdapter(["meta"]));

    const types = registry.listSupportedTypes();
    expect(types).toContain("website");
    expect(types).toContain("brand_deck");
    expect(types).toContain("meta");
    expect(types).not.toContain("user_answer");
  });

  it("last registered adapter wins for overlapping source types", () => {
    const registry = new SourceAdapterRegistry();
    const first = makeAdapter(["website"]);
    const second = makeAdapter(["website"]);

    registry.register(first);
    registry.register(second);

    expect(registry.getAdapter("website")).toBe(second);
  });

  it("hasAdapter returns false for unregistered type", () => {
    const registry = new SourceAdapterRegistry();
    registry.register(makeAdapter(["website"]));

    expect(registry.hasAdapter("meta")).toBe(false);
  });

  it("adapter supporting zero types registers none", () => {
    const registry = new SourceAdapterRegistry();
    const adapter = makeAdapter([]);

    registry.register(adapter);

    expect(registry.listSupportedTypes()).toEqual([]);
  });

  it("adapter supporting all SourceType values registers every type", () => {
    const registry = new SourceAdapterRegistry();
    const allTypes = Object.values(SourceType);
    const adapter = makeAdapter(allTypes);

    registry.register(adapter);

    const registered = registry.listSupportedTypes();
    expect(registered.sort()).toEqual(allTypes.sort());
  });
});
