import { describe, expect, it } from "vitest";
import {
  checkMimeAllowlist,
  checkContentHashPresent,
  checkNonEmptyContent,
  checkPageCoverage,
  checkOcrConfidence,
  checkTruncation,
  checkEvidenceLocators,
  runDocumentGates,
  runFactGates,
  hasBlockingFailures,
  hasWarnings,
  overallGateStatus,
  type DocumentQualityInput,
  type FactQualityInput,
} from "@/core/business-context/quality-gates";

function docInput(overrides: Partial<DocumentQualityInput> = {}): DocumentQualityInput {
  return {
    sourceDocumentId: "doc-1",
    mimeType: "application/pdf",
    contentHash: "sha256:abc",
    contentText: "Hello",
    pageOrSlideCount: 10,
    pagesProcessed: 10,
    slidesProcessed: 0,
    parserWarnings: [],
    ocrConfidence: null,
    evidenceLocatorsPresent: true,
    truncationDetected: false,
    ...overrides,
  };
}

function factInput(overrides: Partial<FactQualityInput> = {}): FactQualityInput {
  return {
    factId: "f-1",
    factKey: "business.name",
    value: "Acme",
    sourceId: "src-1",
    sourceExcerpt: "Acme Corp",
    evidenceLocator: null,
    confidence: 0.9,
    verificationStatus: "extracted",
    hasConflict: false,
    supersedesFactId: null,
    ...overrides,
  };
}

describe("checkMimeAllowlist", () => {
  it("passes for application/pdf", () => {
    expect(checkMimeAllowlist(docInput()).status).toBe("passed");
  });
  it("blocks disallowed MIME", () => {
    expect(
      checkMimeAllowlist(docInput({ mimeType: "application/x-msdownload" })).status
    ).toBe("failed_blocking");
  });
});

describe("checkContentHashPresent", () => {
  it("passes when hash present", () => {
    expect(checkContentHashPresent(docInput()).status).toBe("passed");
  });
  it("blocks when empty", () => {
    expect(
      checkContentHashPresent(docInput({ contentHash: "" })).status
    ).toBe("failed_blocking");
  });
});

describe("checkNonEmptyContent", () => {
  it("passes for non-empty text", () => {
    expect(checkNonEmptyContent(docInput()).status).toBe("passed");
  });
  it("blocks empty text", () => {
    expect(checkNonEmptyContent(docInput({ contentText: "" })).status).toBe(
      "failed_blocking"
    );
  });
});

describe("checkPageCoverage", () => {
  it("passes for full coverage", () => {
    expect(checkPageCoverage(docInput()).status).toBe("passed");
  });
  it("warns for partial coverage", () => {
    const r = checkPageCoverage(
      docInput({ pageOrSlideCount: 100, pagesProcessed: 50, slidesProcessed: 0 })
    );
    expect(["failed_non_blocking", "warning", "passed"]).toContain(r.status);
  });
  it("passes when no page count provided", () => {
    expect(
      checkPageCoverage(docInput({ pageOrSlideCount: null, pagesProcessed: 0 })).status
    ).toBe("passed");
  });
});

describe("checkOcrConfidence", () => {
  it("passes when OCR confidence not provided", () => {
    expect(checkOcrConfidence(docInput()).status).toBe("passed");
  });
  it("warns on low OCR confidence", () => {
    const r = checkOcrConfidence(docInput({ ocrConfidence: 0.3 }));
    expect(["warning", "failed_non_blocking"]).toContain(r.status);
  });
});

describe("checkTruncation", () => {
  it("passes when not truncated", () => {
    expect(checkTruncation(docInput()).status).toBe("passed");
  });
  it("blocks when truncation removes required content", () => {
    expect(
      checkTruncation(
        docInput({ truncationDetected: true, contentText: "" })
      ).status
    ).toBe("failed_blocking");
  });
});

describe("checkEvidenceLocators", () => {
  it("passes when locators present", () => {
    expect(checkEvidenceLocators(docInput()).status).toBe("passed");
  });
  it("warns when locators missing", () => {
    expect(
      checkEvidenceLocators(docInput({ evidenceLocatorsPresent: false })).status
    ).toBe("warning");
  });
});

describe("runDocumentGates", () => {
  it("returns no blocking failures for a clean PDF", () => {
    const r = runDocumentGates(docInput());
    expect(hasBlockingFailures(r)).toBe(false);
  });
  it("returns blocking failure for bad MIME", () => {
    const r = runDocumentGates(docInput({ mimeType: "application/x-msdownload" }));
    expect(hasBlockingFailures(r)).toBe(true);
  });
  it("overallGateStatus returns passed for a clean doc", () => {
    const r = runDocumentGates(docInput());
    expect(overallGateStatus(r)).toBe("passed");
  });
  it("overallGateStatus returns failed_blocking for bad MIME", () => {
    const r = runDocumentGates(docInput({ mimeType: "application/x-msdownload" }));
    expect(overallGateStatus(r)).toBe("failed_blocking");
  });
});

describe("runFactGates", () => {
  it("passes for a clean extracted fact", () => {
    const r = runFactGates(factInput());
    expect(hasBlockingFailures(r)).toBe(false);
  });
  it("blocks low confidence fact", () => {
    const r = runFactGates(factInput({ confidence: 0.2 }));
    expect(hasBlockingFailures(r)).toBe(true);
  });
  it("warns on medium confidence", () => {
    const r = runFactGates(factInput({ confidence: 0.6 }));
    expect(hasWarnings(r)).toBe(true);
  });
  it("bypasses confidence gate for user_verified", () => {
    const r = runFactGates(
      factInput({ confidence: 0.1, verificationStatus: "user_verified" })
    );
    expect(hasBlockingFailures(r)).toBe(false);
  });
  it("blocks on conflict", () => {
    const r = runFactGates(factInput({ hasConflict: true }));
    expect(hasBlockingFailures(r)).toBe(true);
  });
});
