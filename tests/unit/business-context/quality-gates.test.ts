import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// T023 — Quality gate pure-function tests
// Self-contained: defines types and functions inline.
// Tests document gates, fact gates, blocking approval failures,
// and non-blocking warning summaries.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

type GateScope = "document" | "fact";
type GateStatus = "passed" | "warning" | "failed_blocking" | "failed_non_blocking";

interface QualityGateResult {
  gate_scope: GateScope;
  gate_name: string;
  status: GateStatus;
  measured_value?: unknown;
  threshold?: unknown;
  reason?: string;
}

interface DocumentGateInput {
  mime_type: string;
  extension: string;
  malware_scanned: boolean;
  content_hash: string | null;
  page_or_slide_count: number | null;
  pages_or_slides_covered: number | null;
  ocr_confidence_mean: number | null;
  truncated: boolean;
  required_sections_removed: boolean;
  has_parser_warnings: boolean;
  has_evidence_locators: boolean;
  parser_produced_content: boolean;
}

interface FactGateInput {
  fact_key: string;
  value: unknown;
  has_source_id: boolean;
  has_source_excerpt: boolean;
  has_evidence_locator: boolean;
  confidence: number;
  verification_status: "extracted" | "inferred" | "user_verified" | "rejected" | "superseded";
  has_material_conflict: boolean;
  has_authority_metadata: boolean;
  has_effective_date: boolean;
}

interface GateEvaluationResult {
  results: QualityGateResult[];
  has_blocking_failure: boolean;
  summary: {
    total: number;
    passed: number;
    warnings: number;
    blocking_failures: number;
    non_blocking_failures: number;
  };
}

// ── MIME/extension allowlists (V1) ────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/html",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".html",
  ".htm",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
]);

const OCR_CONFIDENCE_THRESHOLD = 0.65;
const PAGE_COVERAGE_THRESHOLD = 0.9;

// ── Gate evaluation functions ──────────────────────────────────────────────

function evaluateDocumentGates(input: DocumentGateInput): GateEvaluationResult {
  const results: QualityGateResult[] = [];

  // MIME validation
  results.push({
    gate_scope: "document",
    gate_name: "mime_validation",
    status: ALLOWED_MIME_TYPES.has(input.mime_type) ? "passed" : "failed_blocking",
    measured_value: input.mime_type,
    reason: ALLOWED_MIME_TYPES.has(input.mime_type) ? undefined : `MIME type ${input.mime_type} not in allowlist`,
  });

  // Extension validation
  results.push({
    gate_scope: "document",
    gate_name: "extension_validation",
    status: ALLOWED_EXTENSIONS.has(input.extension) ? "passed" : "failed_blocking",
    measured_value: input.extension,
    reason: ALLOWED_EXTENSIONS.has(input.extension) ? undefined : `Extension ${input.extension} not in allowlist`,
  });

  // Malware scan
  results.push({
    gate_scope: "document",
    gate_name: "malware_scan",
    status: input.malware_scanned ? "passed" : "warning",
    measured_value: input.malware_scanned,
    reason: input.malware_scanned ? undefined : "Malware scan unavailable in local dev",
  });

  // Content hash
  results.push({
    gate_scope: "document",
    gate_name: "content_hash",
    status: input.content_hash ? "passed" : "failed_blocking",
    measured_value: input.content_hash,
  });

  // Page coverage
  if (input.page_or_slide_count !== null && input.page_or_slide_count > 0 && input.pages_or_slides_covered !== null) {
    const coverage = input.pages_or_slides_covered / input.page_or_slide_count;
    results.push({
      gate_scope: "document",
      gate_name: "page_coverage",
      status: coverage >= PAGE_COVERAGE_THRESHOLD ? "passed" : "failed_blocking",
      measured_value: { coverage, covered: input.pages_or_slides_covered, total: input.page_or_slide_count },
      threshold: { min: PAGE_COVERAGE_THRESHOLD },
    });
  }

  // OCR confidence
  if (input.ocr_confidence_mean !== null) {
    results.push({
      gate_scope: "document",
      gate_name: "ocr_confidence",
      status: input.ocr_confidence_mean >= OCR_CONFIDENCE_THRESHOLD ? "passed" : "warning",
      measured_value: input.ocr_confidence_mean,
      threshold: { min: OCR_CONFIDENCE_THRESHOLD },
      reason: input.ocr_confidence_mean >= OCR_CONFIDENCE_THRESHOLD ? undefined : "OCR confidence below threshold",
    });
  }

  // Truncation / required sections
  if (input.truncated && input.required_sections_removed) {
    results.push({
      gate_scope: "document",
      gate_name: "truncation",
      status: "failed_blocking",
      reason: "Required sections removed by truncation",
    });
  } else if (input.truncated) {
    results.push({
      gate_scope: "document",
      gate_name: "truncation",
      status: "warning",
      reason: "Document truncated but no required sections removed",
    });
  }

  // Parser warnings
  if (input.has_parser_warnings) {
    results.push({
      gate_scope: "document",
      gate_name: "parser_warnings",
      status: "warning",
    });
  }

  // Evidence locators
  results.push({
    gate_scope: "document",
    gate_name: "evidence_locators",
    status: input.has_evidence_locators ? "passed" : "warning",
  });

  // Content production
  results.push({
    gate_scope: "document",
    gate_name: "content_production",
    status: input.parser_produced_content ? "passed" : "failed_blocking",
  });

  return buildGateResult(results);
}

function evaluateFactGates(input: FactGateInput): GateEvaluationResult {
  const results: QualityGateResult[] = [];

  // Schema validity (source link)
  results.push({
    gate_scope: "fact",
    gate_name: "source_link",
    status: input.has_source_id ? "passed" : "failed_blocking",
  });

  // Source excerpt
  results.push({
    gate_scope: "fact",
    gate_name: "source_excerpt",
    status: input.has_source_excerpt ? "passed" : "warning",
  });

  // Evidence locator
  results.push({
    gate_scope: "fact",
    gate_name: "evidence_locator",
    status: input.has_evidence_locator ? "passed" : "warning",
  });

  // Confidence threshold
  let confidenceStatus: GateStatus;
  let confidenceReason: string | undefined;
  if (input.verification_status === "user_verified") {
    confidenceStatus = "passed";
    confidenceReason = undefined;
  } else if (input.confidence >= 0.7) {
    confidenceStatus = "passed";
  } else if (input.confidence >= 0.5) {
    confidenceStatus = "warning";
    confidenceReason = "Confidence requires review";
  } else {
    confidenceStatus = "failed_non_blocking";
    confidenceReason = "Confidence below minimum threshold";
  }
  results.push({
    gate_scope: "fact",
    gate_name: "confidence_threshold",
    status: confidenceStatus,
    measured_value: input.confidence,
    reason: confidenceReason,
  });

  // Material conflict
  results.push({
    gate_scope: "fact",
    gate_name: "material_conflict",
    status: input.has_material_conflict ? "failed_blocking" : "passed",
  });

  // Authority metadata
  if (input.has_authority_metadata) {
    results.push({
      gate_scope: "fact",
      gate_name: "authority_metadata",
      status: input.has_effective_date ? "passed" : "warning",
      reason: input.has_effective_date ? undefined : "Authority source missing effective date",
    });
  }

  return buildGateResult(results);
}

function buildGateResult(results: QualityGateResult[]): GateEvaluationResult {
  const summary = {
    total: results.length,
    passed: results.filter((r) => r.status === "passed").length,
    warnings: results.filter((r) => r.status === "warning").length,
    blocking_failures: results.filter((r) => r.status === "failed_blocking").length,
    non_blocking_failures: results.filter((r) => r.status === "failed_non_blocking").length,
  };
  return {
    results,
    has_blocking_failure: summary.blocking_failures > 0,
    summary,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Document quality gates", () => {
  const validInput: DocumentGateInput = {
    mime_type: "application/pdf",
    extension: ".pdf",
    malware_scanned: true,
    content_hash: "sha256:abc123",
    page_or_slide_count: 10,
    pages_or_slides_covered: 10,
    ocr_confidence_mean: null,
    truncated: false,
    required_sections_removed: false,
    has_parser_warnings: false,
    has_evidence_locators: true,
    parser_produced_content: true,
  };

  it("returns all passed for a clean PDF", () => {
    const result = evaluateDocumentGates(validInput);
    expect(result.has_blocking_failure).toBe(false);
    expect(result.summary.blocking_failures).toBe(0);
    expect(result.summary.passed).toBeGreaterThan(0);
  });

  it("fails blocking when MIME type is not allowed", () => {
    const result = evaluateDocumentGates({ ...validInput, mime_type: "application/x-executable" });
    expect(result.has_blocking_failure).toBe(true);
    const mimeGate = result.results.find((r) => r.gate_name === "mime_validation");
    expect(mimeGate?.status).toBe("failed_blocking");
  });

  it("fails blocking when extension is not allowed", () => {
    const result = evaluateDocumentGates({ ...validInput, extension: ".exe" });
    expect(result.has_blocking_failure).toBe(true);
  });

  it("warns when malware scan is unavailable", () => {
    const result = evaluateDocumentGates({ ...validInput, malware_scanned: false });
    const malwareGate = result.results.find((r) => r.gate_name === "malware_scan");
    expect(malwareGate?.status).toBe("warning");
    expect(result.has_blocking_failure).toBe(false);
  });

  it("fails blocking when content hash is missing", () => {
    const result = evaluateDocumentGates({ ...validInput, content_hash: null });
    expect(result.has_blocking_failure).toBe(true);
  });

  it("fails blocking when page coverage is below 90%", () => {
    const result = evaluateDocumentGates({
      ...validInput,
      page_or_slide_count: 100,
      pages_or_slides_covered: 80, // 80% < 90%
    });
    expect(result.has_blocking_failure).toBe(true);
    const coverageGate = result.results.find((r) => r.gate_name === "page_coverage");
    expect(coverageGate?.status).toBe("failed_blocking");
  });

  it("passes when page coverage is exactly 90%", () => {
    const result = evaluateDocumentGates({
      ...validInput,
      page_or_slide_count: 100,
      pages_or_slides_covered: 90,
    });
    const coverageGate = result.results.find((r) => r.gate_name === "page_coverage");
    expect(coverageGate?.status).toBe("passed");
  });

  it("warns when OCR confidence is below 0.65", () => {
    const result = evaluateDocumentGates({
      ...validInput,
      ocr_confidence_mean: 0.6,
    });
    const ocrGate = result.results.find((r) => r.gate_name === "ocr_confidence");
    expect(ocrGate?.status).toBe("warning");
    expect(result.has_blocking_failure).toBe(false);
  });

  it("fails blocking when truncation removes required sections", () => {
    const result = evaluateDocumentGates({
      ...validInput,
      truncated: true,
      required_sections_removed: true,
    });
    expect(result.has_blocking_failure).toBe(true);
    const truncGate = result.results.find((r) => r.gate_name === "truncation");
    expect(truncGate?.status).toBe("failed_blocking");
  });

  it("warns when truncation does not remove required sections", () => {
    const result = evaluateDocumentGates({
      ...validInput,
      truncated: true,
      required_sections_removed: false,
    });
    expect(result.has_blocking_failure).toBe(false);
    const truncGate = result.results.find((r) => r.gate_name === "truncation");
    expect(truncGate?.status).toBe("warning");
  });

  it("fails blocking when parser produced no content", () => {
    const result = evaluateDocumentGates({
      ...validInput,
      parser_produced_content: false,
    });
    expect(result.has_blocking_failure).toBe(true);
  });
});

describe("Fact quality gates", () => {
  const validInput: FactGateInput = {
    fact_key: "offers.primary",
    value: { name: "Product" },
    has_source_id: true,
    has_source_excerpt: true,
    has_evidence_locator: true,
    confidence: 0.85,
    verification_status: "extracted",
    has_material_conflict: false,
    has_authority_metadata: false,
    has_effective_date: false,
  };

  it("returns all passed for a well-formed fact", () => {
    const result = evaluateFactGates(validInput);
    expect(result.has_blocking_failure).toBe(false);
    expect(result.summary.blocking_failures).toBe(0);
  });

  it("fails blocking when source_id is missing", () => {
    const result = evaluateFactGates({ ...validInput, has_source_id: false });
    expect(result.has_blocking_failure).toBe(true);
  });

  it("warns when source_excerpt is missing", () => {
    const result = evaluateFactGates({ ...validInput, has_source_excerpt: false });
    const excerptGate = result.results.find((r) => r.gate_name === "source_excerpt");
    expect(excerptGate?.status).toBe("warning");
    expect(result.has_blocking_failure).toBe(false);
  });

  it("passes confidence when >= 0.70", () => {
    const result = evaluateFactGates({ ...validInput, confidence: 0.7 });
    const confGate = result.results.find((r) => r.gate_name === "confidence_threshold");
    expect(confGate?.status).toBe("passed");
  });

  it("warns when confidence is 0.50-0.69 (requires review)", () => {
    const result = evaluateFactGates({ ...validInput, confidence: 0.55 });
    const confGate = result.results.find((r) => r.gate_name === "confidence_threshold");
    expect(confGate?.status).toBe("warning");
  });

  it("fails non-blocking when confidence < 0.50", () => {
    const result = evaluateFactGates({ ...validInput, confidence: 0.3 });
    const confGate = result.results.find((r) => r.gate_name === "confidence_threshold");
    expect(confGate?.status).toBe("failed_non_blocking");
  });

  it("user_verified facts bypass confidence thresholds", () => {
    const result = evaluateFactGates({
      ...validInput,
      confidence: 0.1,
      verification_status: "user_verified",
    });
    const confGate = result.results.find((r) => r.gate_name === "confidence_threshold");
    expect(confGate?.status).toBe("passed");
  });

  it("fails blocking when material conflict exists", () => {
    const result = evaluateFactGates({ ...validInput, has_material_conflict: true });
    expect(result.has_blocking_failure).toBe(true);
    const conflictGate = result.results.find((r) => r.gate_name === "material_conflict");
    expect(conflictGate?.status).toBe("failed_blocking");
  });

  it("warns when authority source lacks effective date", () => {
    const result = evaluateFactGates({
      ...validInput,
      has_authority_metadata: true,
      has_effective_date: false,
    });
    const authGate = result.results.find((r) => r.gate_name === "authority_metadata");
    expect(authGate?.status).toBe("warning");
  });
});

describe("Gate summary aggregation", () => {
  it("correctly counts all gate statuses", () => {
    const results: QualityGateResult[] = [
      { gate_scope: "document", gate_name: "a", status: "passed" },
      { gate_scope: "document", gate_name: "b", status: "passed" },
      { gate_scope: "document", gate_name: "c", status: "warning" },
      { gate_scope: "document", gate_name: "d", status: "failed_blocking" },
      { gate_scope: "document", gate_name: "e", status: "failed_non_blocking" },
    ];
    const summary = buildGateResult(results).summary;
    expect(summary.total).toBe(5);
    expect(summary.passed).toBe(2);
    expect(summary.warnings).toBe(1);
    expect(summary.blocking_failures).toBe(1);
    expect(summary.non_blocking_failures).toBe(1);
  });

  it("has_blocking_failure is false when no blocking failures exist", () => {
    const results: QualityGateResult[] = [
      { gate_scope: "fact", gate_name: "a", status: "passed" },
      { gate_scope: "fact", gate_name: "b", status: "warning" },
    ];
    expect(buildGateResult(results).has_blocking_failure).toBe(false);
  });

  it("has_blocking_failure is true when at least one blocking failure exists", () => {
    const results: QualityGateResult[] = [
      { gate_scope: "fact", gate_name: "a", status: "passed" },
      { gate_scope: "fact", gate_name: "b", status: "failed_blocking" },
    ];
    expect(buildGateResult(results).has_blocking_failure).toBe(true);
  });
});
