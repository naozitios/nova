import { describe, expect, it } from "vitest";
import { z } from "zod";

// ---------------------------------------------------------------------------
// T020 — Domain Zod schema tests
// Self-contained: defines schemas inline (implementation doesn't exist yet).
// These tests define the expected validation contracts per data-model.md.
// ---------------------------------------------------------------------------

// ── Enums ──────────────────────────────────────────────────────────────────

const OnboardingStatusSchema = z.enum([
  "created",
  "scanning",
  "extracting",
  "awaiting_review",
  "awaiting_answers",
  "ready_for_approval",
  "approved",
  "failed",
]);

const SourceTypeSchema = z.enum([
  "website",
  "brand_deck",
  "brand_playbook",
  "product_document",
  "campaign_brief",
  "research_document",
  "user_answer",
  "meta",
  "system_inference",
]);

const SourceProcessingStageSchema = z.enum([
  "registered",
  "queued",
  "acquiring",
  "stored",
  "parsing",
  "normalizing",
  "extracting",
  "reconciling",
  "quality_checking",
  "completed",
]);

const TerminalSourceOutcomeSchema = z.enum([
  "processed",
  "processed_with_warnings",
  "blocked_needs_user_action",
  "failed_permanent",
  "archived",
]);

const JobStatusSchema = z.enum([
  "queued",
  "scheduled",
  "running",
  "retry_waiting",
  "succeeded",
  "failed_retryable",
  "failed_permanent",
  "stalled",
  "dead_lettered",
  "cancelled",
]);

const VerificationStatusSchema = z.enum([
  "extracted",
  "inferred",
  "user_verified",
  "rejected",
  "superseded",
]);

const ProfileVersionStatusSchema = z.enum([
  "draft",
  "current",
  "superseded",
  "restored_snapshot",
]);

const StageEventStatusSchema = z.enum([
  "started",
  "succeeded",
  "warned",
  "failed_retryable",
  "failed_permanent",
  "skipped",
]);

const QualityGateScopeSchema = z.enum(["document", "fact"]);

const QualityGateStatusSchema = z.enum([
  "passed",
  "warning",
  "failed_blocking",
  "failed_non_blocking",
]);

const CircuitBreakerStateSchema = z.enum(["closed", "open", "half_open"]);

const CompilePurposeSchema = z.enum([
  "campaign_setup",
  "performance_analysis",
  "optimization",
  "hypothesis_generation",
  "creative_brief",
  "tracking_audit",
]);

// ── Complex schemas ────────────────────────────────────────────────────────

const FactConfidenceSchema = z.number().min(0).max(1);

const ExtractionOutputSchema = z.object({
  facts: z.array(
    z.object({
      fact_key: z.string().min(1),
      value: z.unknown(),
      confidence: FactConfidenceSchema,
      source_excerpt: z.string().optional(),
      evidence_locator: z
        .object({
          url: z.string().url().optional(),
          page: z.number().int().positive().optional(),
          slide: z.number().int().positive().optional(),
        })
        .optional(),
    }),
  ),
  warnings: z.array(z.string()).optional(),
});

const QualityGateResultSchema = z.object({
  gate_scope: QualityGateScopeSchema,
  gate_name: z.string().min(1),
  status: QualityGateStatusSchema,
  measured_value: z.unknown().optional(),
  threshold: z.unknown().optional(),
  reason: z.string().optional(),
});

const CircuitBreakerRecordSchema = z.object({
  provider: z.string().min(1),
  state: CircuitBreakerStateSchema,
  failure_count: z.number().int().min(0),
  success_count: z.number().int().min(0),
  timeout_count: z.number().int().min(0),
  quota_exhausted: z.boolean(),
  opened_at: z.string().datetime().nullable().optional(),
  half_open_after: z.string().datetime().nullable().optional(),
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("OnboardingStatusSchema", () => {
  it("accepts all valid statuses", () => {
    const valid = [
      "created",
      "scanning",
      "extracting",
      "awaiting_review",
      "awaiting_answers",
      "ready_for_approval",
      "approved",
      "failed",
    ];
    for (const v of valid) {
      expect(OnboardingStatusSchema.parse(v)).toBe(v);
    }
  });

  it("rejects invalid status", () => {
    expect(() => OnboardingStatusSchema.parse("pending")).toThrow();
    expect(() => OnboardingStatusSchema.parse("")).toThrow();
    expect(() => OnboardingStatusSchema.parse("CREATED")).toThrow();
  });
});

describe("SourceTypeSchema", () => {
  it("accepts all 9 V1 source types", () => {
    const valid = [
      "website",
      "brand_deck",
      "brand_playbook",
      "product_document",
      "campaign_brief",
      "research_document",
      "user_answer",
      "meta",
      "system_inference",
    ];
    for (const v of valid) {
      expect(SourceTypeSchema.parse(v)).toBe(v);
    }
  });

  it("rejects reserved-but-not-implemented types", () => {
    expect(() => SourceTypeSchema.parse("shopify")).toThrow();
    expect(() => SourceTypeSchema.parse("crm")).toThrow();
    expect(() => SourceTypeSchema.parse("payments")).toThrow();
    expect(() => SourceTypeSchema.parse("csv")).toThrow();
    expect(() => SourceTypeSchema.parse("webhook")).toThrow();
  });
});

describe("SourceProcessingStageSchema", () => {
  it("accepts all 10 processing stages", () => {
    const valid = [
      "registered",
      "queued",
      "acquiring",
      "stored",
      "parsing",
      "normalizing",
      "extracting",
      "reconciling",
      "quality_checking",
      "completed",
    ];
    for (const v of valid) {
      expect(SourceProcessingStageSchema.parse(v)).toBe(v);
    }
  });

  it("rejects unknown stage", () => {
    expect(() => SourceProcessingStageSchema.parse("processing")).toThrow();
  });
});

describe("TerminalSourceOutcomeSchema", () => {
  it("accepts all terminal outcomes", () => {
    const valid = [
      "processed",
      "processed_with_warnings",
      "blocked_needs_user_action",
      "failed_permanent",
      "archived",
    ];
    for (const v of valid) {
      expect(TerminalSourceOutcomeSchema.parse(v)).toBe(v);
    }
  });
});

describe("JobStatusSchema", () => {
  it("accepts all 10 job statuses", () => {
    const valid = [
      "queued",
      "scheduled",
      "running",
      "retry_waiting",
      "succeeded",
      "failed_retryable",
      "failed_permanent",
      "stalled",
      "dead_lettered",
      "cancelled",
    ];
    for (const v of valid) {
      expect(JobStatusSchema.parse(v)).toBe(v);
    }
  });

  it("rejects invalid job status", () => {
    expect(() => JobStatusSchema.parse("done")).toThrow();
    expect(() => JobStatusSchema.parse("in_progress")).toThrow();
  });
});

describe("FactConfidenceSchema", () => {
  it("accepts 0 and 1 boundaries", () => {
    expect(FactConfidenceSchema.parse(0)).toBe(0);
    expect(FactConfidenceSchema.parse(1)).toBe(1);
  });

  it("accepts values in [0, 1]", () => {
    expect(FactConfidenceSchema.parse(0.5)).toBe(0.5);
    expect(FactConfidenceSchema.parse(0.73)).toBe(0.73);
  });

  it("rejects values below 0", () => {
    expect(() => FactConfidenceSchema.parse(-0.01)).toThrow();
    expect(() => FactConfidenceSchema.parse(-1)).toThrow();
  });

  it("rejects values above 1", () => {
    expect(() => FactConfidenceSchema.parse(1.01)).toThrow();
    expect(() => FactConfidenceSchema.parse(2)).toThrow();
  });

  it("rejects non-numbers", () => {
    expect(() => FactConfidenceSchema.parse("0.5")).toThrow();
    expect(() => FactConfidenceSchema.parse(NaN)).toThrow();
  });
});

describe("ExtractionOutputSchema", () => {
  it("accepts valid extraction with facts", () => {
    const output = ExtractionOutputSchema.parse({
      facts: [
        {
          fact_key: "offers.primary",
          value: { name: "Test Product", price: 29.99 },
          confidence: 0.85,
          source_excerpt: "Our product costs $29.99",
        },
      ],
      warnings: [],
    });
    expect(output.facts).toHaveLength(1);
    expect(output.facts[0].fact_key).toBe("offers.primary");
  });

  it("accepts extraction with optional fields omitted", () => {
    const output = ExtractionOutputSchema.parse({
      facts: [
        {
          fact_key: "business.name",
          value: "Acme Corp",
          confidence: 1.0,
        },
      ],
    });
    expect(output.facts[0].source_excerpt).toBeUndefined();
  });

  it("rejects extraction with empty fact_key", () => {
    expect(() =>
      ExtractionOutputSchema.parse({
        facts: [
          {
            fact_key: "",
            value: "test",
            confidence: 0.5,
          },
        ],
      }),
    ).toThrow();
  });

  it("rejects extraction with confidence out of bounds", () => {
    expect(() =>
      ExtractionOutputSchema.parse({
        facts: [
          {
            fact_key: "test",
            value: "test",
            confidence: 1.5,
          },
        ],
      }),
    ).toThrow();
  });
});

describe("QualityGateResultSchema", () => {
  it("accepts valid document gate result", () => {
    const result = QualityGateResultSchema.parse({
      gate_scope: "document",
      gate_name: "mime_validation",
      status: "passed",
    });
    expect(result.gate_scope).toBe("document");
  });

  it("accepts valid fact gate result with measured value", () => {
    const result = QualityGateResultSchema.parse({
      gate_scope: "fact",
      gate_name: "confidence_threshold",
      status: "warning",
      measured_value: { value: 0.55, unit: "ratio" },
      threshold: { value: 0.7, unit: "ratio" },
      reason: "Confidence below recommended threshold",
    });
    expect(result.gate_scope).toBe("fact");
  });

  it("rejects invalid gate scope", () => {
    expect(() =>
      QualityGateResultSchema.parse({
        gate_scope: "pipeline",
        gate_name: "test",
        status: "passed",
      }),
    ).toThrow();
  });

  it("rejects invalid gate status", () => {
    expect(() =>
      QualityGateResultSchema.parse({
        gate_scope: "document",
        gate_name: "test",
        status: "skipped",
      }),
    ).toThrow();
  });
});

describe("CircuitBreakerRecordSchema", () => {
  it("accepts closed state with zero counts", () => {
    const cb = CircuitBreakerRecordSchema.parse({
      provider: "firecrawl",
      state: "closed",
      failure_count: 0,
      success_count: 0,
      timeout_count: 0,
      quota_exhausted: false,
    });
    expect(cb.state).toBe("closed");
  });

  it("accepts open state with timestamps", () => {
    const cb = CircuitBreakerRecordSchema.parse({
      provider: "llm_extraction",
      state: "open",
      failure_count: 5,
      success_count: 0,
      timeout_count: 3,
      quota_exhausted: false,
      opened_at: "2026-01-15T10:30:00Z",
      half_open_after: "2026-01-15T10:35:00Z",
    });
    expect(cb.state).toBe("open");
  });

  it("rejects negative counts", () => {
    expect(() =>
      CircuitBreakerRecordSchema.parse({
        provider: "firecrawl",
        state: "closed",
        failure_count: -1,
        success_count: 0,
        timeout_count: 0,
        quota_exhausted: false,
      }),
    ).toThrow();
  });

  it("rejects unknown state", () => {
    expect(() =>
      CircuitBreakerRecordSchema.parse({
        provider: "firecrawl",
        state: "recovering",
        failure_count: 0,
        success_count: 0,
        timeout_count: 0,
        quota_exhausted: false,
      }),
    ).toThrow();
  });
});

describe("CompilePurposeSchema", () => {
  it("accepts all 6 compile purposes", () => {
    const valid = [
      "campaign_setup",
      "performance_analysis",
      "optimization",
      "hypothesis_generation",
      "creative_brief",
      "tracking_audit",
    ];
    for (const v of valid) {
      expect(CompilePurposeSchema.parse(v)).toBe(v);
    }
  });

  it("rejects unknown purpose", () => {
    expect(() => CompilePurposeSchema.parse("reporting")).toThrow();
    expect(() => CompilePurposeSchema.parse("analytics")).toThrow();
  });
});

describe("StageEventStatusSchema", () => {
  it("accepts all stage event statuses", () => {
    const valid = [
      "started",
      "succeeded",
      "warned",
      "failed_retryable",
      "failed_permanent",
      "skipped",
    ];
    for (const v of valid) {
      expect(StageEventStatusSchema.parse(v)).toBe(v);
    }
  });
});

describe("VerificationStatusSchema", () => {
  it("accepts all verification statuses", () => {
    const valid = ["extracted", "inferred", "user_verified", "rejected", "superseded"];
    for (const v of valid) {
      expect(VerificationStatusSchema.parse(v)).toBe(v);
    }
  });

  it("rejects unknown status", () => {
    expect(() => VerificationStatusSchema.parse("verified")).toThrow();
    expect(() => VerificationStatusSchema.parse("pending")).toThrow();
  });
});

describe("ProfileVersionStatusSchema", () => {
  it("accepts all profile version statuses", () => {
    const valid = ["draft", "current", "superseded", "restored_snapshot"];
    for (const v of valid) {
      expect(ProfileVersionStatusSchema.parse(v)).toBe(v);
    }
  });
});
