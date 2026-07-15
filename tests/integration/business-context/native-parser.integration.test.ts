import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parsePdf } from "@/infrastructure/business-context/parsers/pdf";
import { parsePptx } from "@/infrastructure/business-context/parsers/pptx";

// ---------------------------------------------------------------------------
// Integration test: native document parsers against real user-provided files
// Tests PDF and PPTX parsers using files in tests/fixtures/documents/.
// Skipped if files are missing.
// ---------------------------------------------------------------------------

const FIXTURE_DIR = resolve(process.cwd(), "tests/fixtures/documents");

function filePath(name: string): string {
  return resolve(FIXTURE_DIR, name);
}

function findFile(patterns: string[]): string | null {
  for (const pattern of patterns) {
    const p = filePath(pattern);
    if (existsSync(p)) return p;
  }
  return null;
}

const brandBookPath = findFile([
  "brand-book.pdf",
  "Brand Book.pdf",
  "Brand Book 09_04_26 (1).pdf",
  "brand_book.pdf",
]);

const campaignBriefPath = findFile([
  "campaign-brief.pdf",
  "May - July 2026.pdf",
  "campaign-brief-2026.pdf",
]);

const presentationPath = findFile([
  "presentation.pptx",
  "campaign-presentation.pptx",
  "May - July 2026.pptx",
]);

const itPdf = brandBookPath || campaignBriefPath ? it : it.skip;
const itPptx = presentationPath ? it : it.skip;

describe("Native parser — real PDF (brand book)", () => {
  itPdf(
    "parses PDF and returns non-empty text content (or warning for image-based PDFs)",
    async () => {
      const path = brandBookPath ?? campaignBriefPath!;
      console.log("Parsing:", path);
      const buffer = readFileSync(path);
      const result = await parsePdf(buffer);

      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log("PDF page count:", result.data.pageOrSlideCount);
        console.log("PDF text length:", result.data.contentText.length);
        console.log("PDF warnings:", result.data.warnings);
        console.log("First 200 chars:", result.data.contentText.slice(0, 200));
        expect(result.data.parserName).toBe("native");
        expect(result.data.mimeType).toBe("application/pdf");

        if (result.data.contentText.length === 0) {
          console.log("ℹ PDF is image-based (no extractable text), warnings emitted:");
          expect(result.data.warnings.length).toBeGreaterThan(0);
          expect(
            result.data.warnings.some((w) =>
              w.toLowerCase().includes("ocr") || w.toLowerCase().includes("scanned"),
            ),
          ).toBe(true);
        } else {
          expect(result.data.contentText.length).toBeGreaterThan(50);
        }
      }
    },
    30_000,
  );

  itPdf(
    "PDF parser exposes parser name and version",
    async () => {
      const path = brandBookPath ?? campaignBriefPath!;
      const buffer = readFileSync(path);
      const result = await parsePdf(buffer);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.parserName).toBe("native");
        expect(result.data.parserVersion).toMatch(/^\d+\.\d+\.\d+$/);
      }
    },
    30_000,
  );
});

describe("Native parser — real PDF (campaign brief, may have extractable text)", () => {
  const itBrief = campaignBriefPath ? it : it.skip;

  itBrief(
    "campaign brief PDF yields content if it has native text",
    async () => {
      const buffer = readFileSync(campaignBriefPath!);
      const result = await parsePdf(buffer);

      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log("Campaign brief text length:", result.data.contentText.length);
        console.log("Campaign brief warnings:", result.data.warnings);
        if (result.data.contentText.length > 0) {
          expect(result.data.contentText.length).toBeGreaterThan(50);
        }
      }
    },
    30_000,
  );
});

describe("Native parser — real PPTX (campaign presentation)", () => {
  itPptx(
    "parses PPTX and returns non-empty text content",
    async () => {
      console.log("Parsing:", presentationPath);
      const buffer = readFileSync(presentationPath!);
      const result = await parsePptx(buffer, "campaign-presentation.pptx");

      expect(result.ok).toBe(true);
      if (result.ok) {
        console.log("PPTX slide count:", result.data.pageOrSlideCount);
        console.log("PPTX text length:", result.data.contentText.length);
        console.log("First 200 chars:", result.data.contentText.slice(0, 200));
        expect(result.data.contentText.length).toBeGreaterThan(50);
        expect(result.data.parserName).toBe("native");
        expect(result.data.mimeType).toBe(
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        );
      }
    },
    30_000,
  );

  itPptx(
    "PPTX parser exposes parser name and version",
    async () => {
      const buffer = readFileSync(presentationPath!);
      const result = await parsePptx(buffer, "presentation.pptx");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.parserName).toBe("native");
        expect(result.data.parserVersion).toMatch(/^\d+\.\d+\.\d+$/);
      }
    },
    30_000,
  );

  itPptx(
    "PPTX parser records slide count",
    async () => {
      const buffer = readFileSync(presentationPath!);
      const result = await parsePptx(buffer, "presentation.pptx");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.pageOrSlideCount).toBeGreaterThan(0);
        console.log("Slides:", result.data.pageOrSlideCount);
      }
    },
    30_000,
  );
});
