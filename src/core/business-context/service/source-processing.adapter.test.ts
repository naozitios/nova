import { describe, expect, it, beforeEach } from "vitest";
import { SourceProcessingService } from "./source-processing.service";
import { createFakeRepository } from "../../../../tests/harness/test-repository";
import { makeSource, makeAdapter } from "./source-processing.fixture";

describe("SourceProcessingService — adapter selection", () => {
  let service: SourceProcessingService;

  beforeEach(() => {
    service = new SourceProcessingService(createFakeRepository());
  });

  it("selects website adapter for website source type", async () => {
    const websiteAdapter = makeAdapter({
      supports: (t) => t === "website",
    });
    const manualAdapter = makeAdapter({
      supports: (t) => t === "user_answer",
    });

    service.registerAdapter(websiteAdapter);
    service.registerAdapter(manualAdapter);

    const source = makeSource({ sourceType: "website" });
    const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

    expect(collected.ok).toBe(true);
    expect(websiteAdapter.collect).toHaveBeenCalled();
    expect(manualAdapter.collect).not.toHaveBeenCalled();
  });

  it("selects document adapter for stored-document source type", async () => {
    const documentAdapter = makeAdapter({
      supports: (t) => t === "brand_deck",
    });

    service.registerAdapter(documentAdapter);

    const source = makeSource({ sourceType: "brand_deck" });
    const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

    expect(collected.ok).toBe(true);
    expect(documentAdapter.collect).toHaveBeenCalled();
  });

  it("selects meta adapter for meta_ads source type", async () => {
    const metaAdapter = makeAdapter({
      supports: (t) => t === "meta",
    });

    service.registerAdapter(metaAdapter);

    const source = makeSource({ sourceType: "meta" });
    const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

    expect(collected.ok).toBe(true);
    expect(metaAdapter.collect).toHaveBeenCalled();
  });

  it("selects manual adapter for user_answer source type", async () => {
    const manualAdapter = makeAdapter({
      supports: (t) => t === "user_answer",
    });

    service.registerAdapter(manualAdapter);

    const source = makeSource({ sourceType: "user_answer" });
    const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

    expect(collected.ok).toBe(true);
    expect(manualAdapter.collect).toHaveBeenCalled();
  });

  it("selects inference adapter for system_inference source type", async () => {
    const inferenceAdapter = makeAdapter({
      supports: (t) => t === "system_inference",
    });

    service.registerAdapter(inferenceAdapter);

    const source = makeSource({ sourceType: "system_inference" });
    const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

    expect(collected.ok).toBe(true);
    expect(inferenceAdapter.collect).toHaveBeenCalled();
  });

  it("returns error when no adapter registered for source type", async () => {
    const source = makeSource({ sourceType: "brand_playbook" });
    const collected = await service.collectWithAdapter("ws-1", "biz-1", source);

    expect(collected.ok).toBe(false);
    if (!collected.ok) {
      expect(collected.error.code).toBe("NO_ADAPTER");
    }
  });
});
