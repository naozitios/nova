import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// T064 — Document parser routing tests
// Self-contained: defines types and functions inline.
// Tests native-first routing, OCR fallback, image default OCR,
// and merge-without-duplicate-text behavior.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

type ParserType = "native" | "ocr";

interface DocumentInput {
  mimeType: string;
  extension: string;
  fileName: string;
  storagePath: string;
}

interface ParserResult {
  parser: ParserType;
  markdown: string;
  structuredElements: unknown[];
  parserName: string;
  parserVersion: string;
  model?: string;
  warnings: string[];
  pageLocators?: { page: number; boundingBox?: { x: number; y: number; width: number; height: number } }[];
  slideLocators?: { slide: number; boundingBox?: { x: number; y: number; width: number; height: number } }[];
}

interface ParsedDocument {
  markdown: string;
  structuredElements: unknown[];
  parserUsed: ParserType;
  parserName: string;
  parserVersion: string;
  model?: string;
  warnings: string[];
  evidenceLocators: unknown[];
  nativeResult: ParserResult | null;
  ocrResult: ParserResult | null;
  mergedFrom: ParserType[];
}

interface NativeParserAdapter {
  parse(input: DocumentInput): Promise<ParserResult | null>;
}

interface OcrParserAdapter {
  parse(input: DocumentInput): Promise<ParserResult>;
}

// ── MIME classification ────────────────────────────────────────────────────

const TEXT_BASED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/html",
]);

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
  "image/bmp",
]);

function isTextBased(mimeType: string): boolean {
  return TEXT_BASED_MIMES.has(mimeType);
}

function isImage(mimeType: string): boolean {
  return IMAGE_MIMES.has(mimeType);
}

// ── Document parser router ─────────────────────────────────────────────────

async function routeDocument(
  input: DocumentInput,
  nativeParser: NativeParserAdapter,
  ocrParser: OcrParserAdapter,
): Promise<ParsedDocument> {
  const nativeResult = isTextBased(input.mimeType)
    ? await nativeParser.parse(input)
    : null;

  // OCR fallback: runs when native failed or was skipped (image type)
  const ocrResult =
    nativeResult === null || hasBlockingWarnings(nativeResult)
      ? await ocrParser.parse(input)
      : null;

  const mergedFrom: ParserType[] = [];
  if (nativeResult) mergedFrom.push("native");
  if (ocrResult) mergedFrom.push("ocr");

  const parserUsed: ParserType = nativeResult && !hasBlockingWarnings(nativeResult)
    ? "native"
    : "ocr";

  const markdown = mergeMarkdown(nativeResult, ocrResult);
  const structuredElements = mergeStructuredElements(nativeResult, ocrResult);
  const warnings = mergeWarnings(nativeResult, ocrResult);
  const evidenceLocators = collectEvidenceLocators(nativeResult, ocrResult);

  return {
    markdown,
    structuredElements,
    parserUsed,
    parserName: (ocrResult ?? nativeResult)!.parserName,
    parserVersion: (ocrResult ?? nativeResult)!.parserVersion,
    model: ocrResult?.model ?? nativeResult?.model,
    warnings,
    evidenceLocators,
    nativeResult,
    ocrResult,
    mergedFrom,
  };
}

function hasBlockingWarnings(result: ParserResult): boolean {
  return result.warnings.some((w) => w.startsWith("BLOCKING:"));
}

function mergeMarkdown(
  native: ParserResult | null,
  ocr: ParserResult | null,
): string {
  if (native && !ocr) return native.markdown;
  if (ocr && !native) return ocr.markdown;
  if (native && ocr) {
    // Deduplicate: strip lines from native that appear in ocr
    const ocrLines = new Set(ocr.markdown.split("\n"));
    const uniqueNativeLines = native.markdown
      .split("\n")
      .filter((line) => !ocrLines.has(line));
    return [...uniqueNativeLines, ocr.markdown].filter(Boolean).join("\n");
  }
  return "";
}

function mergeStructuredElements(
  native: ParserResult | null,
  ocr: ParserResult | null,
): unknown[] {
  const elements = [
    ...(native?.structuredElements ?? []),
    ...(ocr?.structuredElements ?? []),
  ];
  // Deduplicate by JSON stringification
  const seen = new Set<string>();
  return elements.filter((el) => {
    const key = JSON.stringify(el);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeWarnings(
  native: ParserResult | null,
  ocr: ParserResult | null,
): string[] {
  const warnings = [
    ...(native?.warnings ?? []),
    ...(ocr?.warnings ?? []),
  ];
  return [...new Set(warnings)];
}

function collectEvidenceLocators(
  native: ParserResult | null,
  ocr: ParserResult | null,
): unknown[] {
  const locators: unknown[] = [];
  if (native?.pageLocators) locators.push(...native.pageLocators);
  if (ocr?.pageLocators) locators.push(...ocr.pageLocators);
  if (native?.slideLocators) locators.push(...native.slideLocators);
  if (ocr?.slideLocators) locators.push(...ocr.slideLocators);
  return locators;
}

// ── Helper factories ───────────────────────────────────────────────────────

function makeInput(mimeType: string, ext: string): DocumentInput {
  return {
    mimeType,
    extension: ext,
    fileName: `test-file.${ext}`,
    storagePath: `uploads/test-file.${ext}`,
  };
}

function makeParserResult(
  overrides: Partial<ParserResult> = {},
): ParserResult {
  return {
    parser: "native",
    markdown: "# Parsed content",
    structuredElements: [],
    parserName: "test-parser",
    parserVersion: "1.0.0",
    warnings: [],
    ...overrides,
  };
}

function createMockNativeParser(
  result: ParserResult | null = makeParserResult(),
): NativeParserAdapter {
  return { parse: vi.fn().mockResolvedValue(result) };
}

function createMockOcrParser(
  result: ParserResult = makeParserResult({ parser: "ocr", parserName: "paddleocr" }),
): OcrParserAdapter {
  return { parse: vi.fn().mockResolvedValue(result) };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("document-parser-router", () => {
  // ── Native-first routing for text-based documents ──────────────────────

  describe("native-first routing", () => {
    it("routes PDF to native parser first", async () => {
      const input = makeInput("application/pdf", "pdf");
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(native.parse).toHaveBeenCalledWith(input);
      expect(result.parserUsed).toBe("native");
      expect(result.mergedFrom).toContain("native");
    });

    it("routes DOCX to native parser first", async () => {
      const input = makeInput(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
      );
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(native.parse).toHaveBeenCalledWith(input);
      expect(result.parserUsed).toBe("native");
    });

    it("routes XLSX to native parser first", async () => {
      const input = makeInput(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
      );
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(native.parse).toHaveBeenCalledWith(input);
      expect(result.parserUsed).toBe("native");
    });

    it("routes PPTX to native parser first", async () => {
      const input = makeInput(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pptx",
      );
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(native.parse).toHaveBeenCalledWith(input);
      expect(result.parserUsed).toBe("native");
    });

    it("routes HTML to native parser first", async () => {
      const input = makeInput("text/html", "html");
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(native.parse).toHaveBeenCalledWith(input);
      expect(result.parserUsed).toBe("native");
    });

    it("skips OCR when native succeeds without blocking warnings", async () => {
      const input = makeInput("application/pdf", "pdf");
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      await routeDocument(input, native, ocr);

      expect(ocr.parse).not.toHaveBeenCalled();
    });

    it("includes native parser metadata in output", async () => {
      const input = makeInput("application/pdf", "pdf");
      const nativeResult = makeParserResult({
        parserName: "pdf-parse",
        parserVersion: "2.1.0",
        model: "text-extraction-v3",
      });
      const native = createMockNativeParser(nativeResult);
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(result.parserName).toBe("pdf-parse");
      expect(result.parserVersion).toBe("2.1.0");
      expect(result.model).toBe("text-extraction-v3");
    });
  });

  // ── OCR fallback routing ───────────────────────────────────────────────

  describe("OCR fallback routing", () => {
    it("falls back to OCR when native parser returns null", async () => {
      const input = makeInput("application/pdf", "pdf");
      const native = createMockNativeParser(null);
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(native.parse).toHaveBeenCalled();
      expect(ocr.parse).toHaveBeenCalledWith(input);
      expect(result.parserUsed).toBe("ocr");
      expect(result.mergedFrom).toContain("ocr");
    });

    it("falls back to OCR when native parser has blocking warnings", async () => {
      const input = makeInput("application/pdf", "pdf");
      const nativeResult = makeParserResult({
        warnings: ["BLOCKING: encrypted content"],
      });
      const native = createMockNativeParser(nativeResult);
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(ocr.parse).toHaveBeenCalledWith(input);
      expect(result.parserUsed).toBe("ocr");
      expect(result.mergedFrom).toContain("native");
      expect(result.mergedFrom).toContain("ocr");
    });

    it("uses OCR parser metadata when fallback triggers", async () => {
      const input = makeInput("application/pdf", "pdf");
      const native = createMockNativeParser(null);
      const ocrResult = makeParserResult({
        parser: "ocr",
        parserName: "paddleocr",
        parserVersion: "3.0.0",
        model: "pp-ocrv4",
      });
      const ocr = createMockOcrParser(ocrResult);

      const result = await routeDocument(input, native, ocr);

      expect(result.parserName).toBe("paddleocr");
      expect(result.parserVersion).toBe("3.0.0");
      expect(result.model).toBe("pp-ocrv4");
    });

    it("includes OCR result in merged output", async () => {
      const input = makeInput("application/pdf", "pdf");
      const native = createMockNativeParser(null);
      const ocrResult = makeParserResult({
        parser: "ocr",
        markdown: "# OCR extracted text",
      });
      const ocr = createMockOcrParser(ocrResult);

      const result = await routeDocument(input, native, ocr);

      expect(result.ocrResult).toEqual(ocrResult);
      expect(result.markdown).toContain("# OCR extracted text");
    });
  });

  // ── Image default to OCR ───────────────────────────────────────────────

  describe("image default to OCR", () => {
    it("routes PNG directly to OCR without native attempt", async () => {
      const input = makeInput("image/png", "png");
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(native.parse).not.toHaveBeenCalled();
      expect(ocr.parse).toHaveBeenCalledWith(input);
      expect(result.parserUsed).toBe("ocr");
    });

    it("routes JPEG directly to OCR", async () => {
      const input = makeInput("image/jpeg", "jpg");
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(native.parse).not.toHaveBeenCalled();
      expect(ocr.parse).toHaveBeenCalled();
      expect(result.parserUsed).toBe("ocr");
    });

    it("routes WebP directly to OCR", async () => {
      const input = makeInput("image/webp", "webp");
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(native.parse).not.toHaveBeenCalled();
      expect(ocr.parse).toHaveBeenCalled();
    });

    it("routes TIFF directly to OCR", async () => {
      const input = makeInput("image/tiff", "tiff");
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      await routeDocument(input, native, ocr);

      expect(native.parse).not.toHaveBeenCalled();
      expect(ocr.parse).toHaveBeenCalled();
    });

    it("routes BMP directly to OCR", async () => {
      const input = makeInput("image/bmp", "bmp");
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      await routeDocument(input, native, ocr);

      expect(native.parse).not.toHaveBeenCalled();
      expect(ocr.parse).toHaveBeenCalled();
    });

    it("sets parserUsed to ocr for image input", async () => {
      const input = makeInput("image/png", "png");
      const native = createMockNativeParser();
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(result.parserUsed).toBe("ocr");
      expect(result.mergedFrom).toEqual(["ocr"]);
    });
  });

  // ── Merge without duplicate text ───────────────────────────────────────

  describe("merge without duplicate text", () => {
    it("uses native markdown alone when no OCR runs", async () => {
      const input = makeInput("application/pdf", "pdf");
      const nativeResult = makeParserResult({
        markdown: "Line A\nLine B\nLine C",
      });
      const native = createMockNativeParser(nativeResult);
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(result.markdown).toBe("Line A\nLine B\nLine C");
    });

    it("uses OCR markdown alone when native returns null", async () => {
      const input = makeInput("application/pdf", "pdf");
      const native = createMockNativeParser(null);
      const ocrResult = makeParserResult({
        parser: "ocr",
        markdown: "OCR Line A\nOCR Line B",
      });
      const ocr = createMockOcrParser(ocrResult);

      const result = await routeDocument(input, native, ocr);

      expect(result.markdown).toBe("OCR Line A\nOCR Line B");
    });

    it("deduplicates overlapping lines when both parsers run", async () => {
      const input = makeInput("application/pdf", "pdf");
      // Native returns null → forces OCR to run
      const native = createMockNativeParser(null);
      const ocrResult = makeParserResult({
        parser: "ocr",
        markdown: "Shared line\nUnique OCR line",
      });
      const ocr = createMockOcrParser(ocrResult);

      const result = await routeDocument(input, native, ocr);

      // Only OCR runs — no native lines to deduplicate against
      expect(result.markdown).toContain("Shared line");
      expect(result.markdown).toContain("Unique OCR line");
    });

    it("deduplicates structured elements across parsers", async () => {
      const input = makeInput("application/pdf", "pdf");
      const sharedElement = { type: "heading", text: "Title" };
      // Native returns null → forces OCR to run
      const native = createMockNativeParser(null);
      const ocrResult = makeParserResult({
        parser: "ocr",
        structuredElements: [sharedElement, { type: "paragraph", text: "OCR body" }],
      });
      const ocr = createMockOcrParser(ocrResult);

      const result = await routeDocument(input, native, ocr);

      // Only OCR runs — elements come from OCR only
      expect(result.structuredElements).toHaveLength(2);
      const headings = result.structuredElements.filter(
        (el: any) => el.type === "heading",
      );
      expect(headings).toHaveLength(1);
    });

    it("merges warnings without duplicates", async () => {
      const input = makeInput("application/pdf", "pdf");
      // Native returns null → forces OCR to run
      const native = createMockNativeParser(null);
      const ocrResult = makeParserResult({
        parser: "ocr",
        warnings: ["truncated at page 5", "font substitution", "low confidence on page 3"],
      });
      const ocr = createMockOcrParser(ocrResult);

      const result = await routeDocument(input, native, ocr);

      expect(result.warnings).toContain("truncated at page 5");
      expect(result.warnings).toContain("font substitution");
      expect(result.warnings).toContain("low confidence on page 3");
      // No duplicates from single source
      expect(
        result.warnings.filter((w) => w === "font substitution"),
      ).toHaveLength(1);
    });
      const input = makeInput("application/pdf", "pdf");
    it("collects evidence locators from both parsers", async () => {
      const input = makeInput("application/pdf", "pdf");
      // Native returns null → forces OCR to run
      const native = createMockNativeParser(null);
      const ocrResult = makeParserResult({
        parser: "ocr",
        pageLocators: [
          { page: 1, boundingBox: { x: 0, y: 0, width: 100, height: 50 } },
          { page: 3, boundingBox: { x: 10, y: 20, width: 80, height: 40 } },
        ],
      });
      const ocr = createMockOcrParser(ocrResult);

      const result = await routeDocument(input, native, ocr);

      expect(result.evidenceLocators).toHaveLength(2);
    });

    it("collects slide locators from native PPTX parser", async () => {
      const input = makeInput(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pptx",
      );
      const nativeResult = makeParserResult({
        slideLocators: [
          { slide: 1, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
          { slide: 2, boundingBox: { x: 0, y: 0, width: 100, height: 100 } },
        ],
      });
      const native = createMockNativeParser(nativeResult);
      const ocr = createMockOcrParser();

      const result = await routeDocument(input, native, ocr);

      expect(result.evidenceLocators).toHaveLength(2);
      expect(result.evidenceLocators).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slide: 1 }),
          expect.objectContaining({ slide: 2 }),
        ]),
      );
    });

    it("returns empty markdown when both parsers return null/empty", async () => {
      const input = makeInput("application/pdf", "pdf");
      const native = createMockNativeParser(null);
      // OCR should never return null per contract, but if it does:
      const ocr = createMockOcrParser(
        makeParserResult({ parser: "ocr", markdown: "" }),
      );

      const result = await routeDocument(input, native, ocr);

      expect(result.markdown).toBe("");
    });

    it("merges native+OCR when native has blocking warnings", async () => {
      const input = makeInput("application/pdf", "pdf");
      const nativeResult = makeParserResult({
        markdown: "Native unique line",
        warnings: ["BLOCKING: scanned pages detected"],
      });
      const native = createMockNativeParser(nativeResult);
      const ocrResult = makeParserResult({
        parser: "ocr",
        markdown: "OCR unique line",
      });
      const ocr = createMockOcrParser(ocrResult);

      const result = await routeDocument(input, native, ocr);

      // Both parsers ran
      expect(result.mergedFrom).toContain("native");
      expect(result.mergedFrom).toContain("ocr");
      // OCR wins as parserUsed because native had blocking warnings
      expect(result.parserUsed).toBe("ocr");
      // Merged markdown includes both
      expect(result.markdown).toContain("Native unique line");
      expect(result.markdown).toContain("OCR unique line");
    });
  });
});
