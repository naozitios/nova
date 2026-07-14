import { describe, expect, it } from "vitest";
import {
  OnboardingStatusSchema,
  SourceTypeSchema,
  SourceProcessingStageSchema,
  JobStatusSchema,
  VerificationStatusSchema,
  ProfileVersionStatusSchema,
  QualityGateStatusSchema,
  CircuitBreakerStateSchema,
  CompilePurposeSchema,
  ErrorClassSchema,
  ExtractedFactSchema,
  ExtractionOutputSchema,
  CreateBusinessSchema,
  JsonValueSchema,
  isValidStageTransition,
  isTerminalStage,
} from "@/core/business-context/schemas";
import { REQUIRED_PROFILE_SECTIONS } from "@/core/business-context/types";

describe("enum schemas", () => {
  it("OnboardingStatusSchema accepts known values", () => {
    expect(OnboardingStatusSchema.parse("created")).toBe("created");
    expect(OnboardingStatusSchema.parse("approved")).toBe("approved");
  });

  it("OnboardingStatusSchema rejects unknown values", () => {
    expect(() => OnboardingStatusSchema.parse("nope")).toThrow();
  });

  it("SourceTypeSchema accepts known source types", () => {
    expect(SourceTypeSchema.parse("website")).toBe("website");
    expect(SourceTypeSchema.parse("meta")).toBe("meta");
  });

  it("SourceProcessingStageSchema accepts known stages", () => {
    expect(SourceProcessingStageSchema.parse("parsing")).toBe("parsing");
    expect(SourceProcessingStageSchema.parse("completed")).toBe("completed");
  });

  it("JobStatusSchema accepts known statuses", () => {
    expect(JobStatusSchema.parse("queued")).toBe("queued");
    expect(JobStatusSchema.parse("dead_lettered")).toBe("dead_lettered");
  });

  it("VerificationStatusSchema accepts known statuses", () => {
    expect(VerificationStatusSchema.parse("user_verified")).toBe("user_verified");
  });

  it("ProfileVersionStatusSchema accepts known statuses", () => {
    expect(ProfileVersionStatusSchema.parse("current")).toBe("current");
  });

  it("QualityGateStatusSchema accepts known statuses", () => {
    expect(QualityGateStatusSchema.parse("failed_blocking")).toBe("failed_blocking");
  });

  it("CircuitBreakerStateSchema accepts known states", () => {
    expect(CircuitBreakerStateSchema.parse("half_open")).toBe("half_open");
  });

  it("CompilePurposeSchema accepts known purposes", () => {
    expect(CompilePurposeSchema.parse("creative_brief")).toBe("creative_brief");
  });

  it("ErrorClassSchema accepts known classes", () => {
    expect(ErrorClassSchema.parse("worker_oom")).toBe("worker_oom");
  });
});

describe("ExtractedFactSchema and ExtractionOutputSchema", () => {
  it("accepts a well-formed extracted fact", () => {
    const r = ExtractedFactSchema.parse({
      factKey: "business.name",
      value: "Acme",
      confidence: 0.9,
      sourceExcerpt: "Acme Corp",
      evidenceLocator: null,
    });
    expect(r.factKey).toBe("business.name");
  });

  it("rejects confidence out of range", () => {
    expect(() =>
      ExtractedFactSchema.parse({
        factKey: "x",
        value: 1,
        confidence: 1.4,
        sourceExcerpt: null,
        evidenceLocator: null,
      })
    ).toThrow();
  });

  it("accepts a well-formed extraction output", () => {
    const r = ExtractionOutputSchema.parse({
      facts: [
        {
          factKey: "business.name",
          value: "Acme",
          confidence: 0.9,
          sourceExcerpt: "x",
          evidenceLocator: null,
        },
      ],
      conflicts: [],
      warnings: [],
    });
    expect(r.facts).toHaveLength(1);
  });
});

describe("CreateBusinessSchema", () => {
  it("accepts a complete business payload", () => {
    const r = CreateBusinessSchema.parse({
      workspaceId: "00000000-0000-0000-0000-000000000001",
      name: "Acme",
      primaryMarket: "US",
      primaryAdvertisingObjective: "conversions",
      primaryBusinessOutcome: "revenue_growth",
      approximateMonthlyMetaBudget: 10000,
    });
    expect(r.name).toBe("Acme");
  });

  it("rejects negative budget", () => {
    expect(() =>
      CreateBusinessSchema.parse({
        workspaceId: "00000000-0000-0000-0000-000000000001",
        name: "Acme",
        primaryMarket: "US",
        primaryAdvertisingObjective: "conversions",
        primaryBusinessOutcome: "revenue_growth",
        approximateMonthlyMetaBudget: -1,
      })
    ).toThrow();
  });
});

describe("stage helpers", () => {
  it("isValidStageTransition allows forward progress", () => {
    expect(isValidStageTransition("registered", "queued")).toBe(true);
  });

  it("isValidStageTransition blocks skipping", () => {
    expect(isValidStageTransition("registered", "completed")).toBe(false);
  });

  it("isTerminalStage is true for completed", () => {
    expect(isTerminalStage("completed")).toBe(true);
  });

  it("isTerminalStage is false for parsing", () => {
    expect(isTerminalStage("parsing")).toBe(false);
  });
});

describe("JsonValueSchema", () => {
  it("accepts primitive values", () => {
    expect(JsonValueSchema.parse("x")).toBe("x");
    expect(JsonValueSchema.parse(1)).toBe(1);
    expect(JsonValueSchema.parse(true)).toBe(true);
    expect(JsonValueSchema.parse(null)).toBe(null);
  });

  it("accepts nested object", () => {
    const r = JsonValueSchema.parse({ a: 1, b: { c: "x" } });
    expect(r).toEqual({ a: 1, b: { c: "x" } });
  });
});

describe("REQUIRED_PROFILE_SECTIONS", () => {
  it("contains the 8 required business sections", () => {
    expect(REQUIRED_PROFILE_SECTIONS).toEqual(
      expect.arrayContaining([
        "business",
        "offers",
        "customers",
        "conversion_journey",
        "economics",
        "brand",
        "creative_capacity",
        "measurement",
      ])
    );
  });
});
