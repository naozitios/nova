import { describe, expect, it } from "vitest";
import {
  detectContentType,
  validateUploadContent,
  type ContentSignature,
  type ContentType,
} from "@/infrastructure/business-context/content-signature";

// ── Magic-byte fixtures ──────────────────────────────────────────────────────

const pdfBuffer = Buffer.from("%PDF-1.4 some content here");
const docxBuffer = Buffer.from("PK\x03\x04\x14\x00\x06\x00");
const xlsxBuffer = Buffer.from("PK\x03\x04\x14\x00\x06\x00");
const pptxBuffer = Buffer.from("PK\x03\x04\x14\x00\x06\x00");
const htmlBuffer = Buffer.from("<!DOCTYPE html>\n<html><head></head></html>");
const htmlLowerBuffer = Buffer.from("<html><body>hello</body></html>");
const textBuffer = Buffer.from("Just plain UTF-8 text content here.");
const elfBuffer = Buffer.from([
  0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00,
]);
const peBuffer = Buffer.from([
  0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00,
]);
const shebangBuffer = Buffer.from("#!/usr/bin/env python\nprint('hi')");
const ole2Buffer = Buffer.from([
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
]);
const emptyBuffer = Buffer.alloc(0);
const nullBuffer = Buffer.alloc(1024, 0x00);

// ── Tests ────────────────────────────────────────────────────────────────────

describe("detectContentType", () => {
  it("detects PDF from %PDF magic", () => {
    const result = detectContentType(pdfBuffer);
    expect(result.contentType).toBe("pdf");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe(".pdf");
  });

  it("returns unknown for ZIP bytes without known office extension", () => {
    const result = detectContentType(docxBuffer);
    expect(result.contentType).toBe("unknown");
    expect(result.confidence).toBe("high");
  });

  it("returns unknown for ZIP bytes with .zip extension", () => {
    const result = detectContentType(docxBuffer, "archive.zip");
    expect(result.contentType).toBe("unknown");
    expect(result.confidence).toBe("high");
  });

  it("detects DOCX from PK zip header with .docx filename", () => {
    const result = detectContentType(docxBuffer, "report.docx");
    expect(result.contentType).toBe("docx");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe(".docx");
  });

  it("detects XLSX from PK zip header with filename", () => {
    const result = detectContentType(xlsxBuffer, "report.xlsx");
    expect(result.contentType).toBe("xlsx");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe(".xlsx");
  });

  it("detects PPTX from PK zip header with filename", () => {
    const result = detectContentType(pptxBuffer, "slides.pptx");
    expect(result.contentType).toBe("pptx");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe(".pptx");
  });

  it("detects HTML from <!DOCTYPE html>", () => {
    const result = detectContentType(htmlBuffer);
    expect(result.contentType).toBe("html");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe(".html");
  });

  it("detects HTML from <html tag", () => {
    const result = detectContentType(htmlLowerBuffer);
    expect(result.contentType).toBe("html");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe(".html");
  });

  it("detects plain text from UTF-8 content", () => {
    const result = detectContentType(textBuffer);
    expect(result.contentType).toBe("text");
    expect(result.confidence).toBe("medium");
    expect(result.extension).toBe(".txt");
  });

  it("detects ELF executable", () => {
    const result = detectContentType(elfBuffer);
    expect(result.contentType).toBe("executable");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe("");
  });

  it("detects PE executable", () => {
    const result = detectContentType(peBuffer);
    expect(result.contentType).toBe("executable");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe("");
  });

  it("detects shebang script as executable", () => {
    const result = detectContentType(shebangBuffer);
    expect(result.contentType).toBe("executable");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe("");
  });

  it("detects legacy DOC/PPT from OLE2 magic", () => {
    const result = detectContentType(ole2Buffer);
    expect(result.contentType).toBe("legacy_office");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe(".doc");
  });

  it("detects legacy XLS from OLE2 magic with .xls filename", () => {
    const result = detectContentType(ole2Buffer, "spreadsheet.xls");
    expect(result.contentType).toBe("legacy_office");
    expect(result.confidence).toBe("high");
    expect(result.extension).toBe(".xls");
  });

  it("returns unknown for empty buffer", () => {
    const result = detectContentType(emptyBuffer);
    expect(result.contentType).toBe("unknown");
    expect(result.confidence).toBe("none");
  });

  it("maps docx to correct Office Open XML mime", () => {
    const result = detectContentType(docxBuffer, "report.docx");
    expect(result.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });
  it("always returns a ContentSignature shape", () => {
    const result: ContentSignature = detectContentType(pdfBuffer);
    expect(result).toHaveProperty("contentType");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("extension");
    expect(result).toHaveProperty("mimeType");
  });

  it("maps pdf to application/pdf mime", () => {
    const result = detectContentType(pdfBuffer);
    expect(result.mimeType).toBe("application/pdf");
  });


  it("maps html to text/html mime", () => {
    const result = detectContentType(htmlBuffer);
    expect(result.mimeType).toBe("text/html");
  });

  it("maps text to text/plain mime", () => {
    const result = detectContentType(textBuffer);
    expect(result.mimeType).toBe("text/plain");
  });

  it("maps executable to application/octet-stream mime", () => {
    const result = detectContentType(elfBuffer);
    expect(result.mimeType).toBe("application/octet-stream");
  });

  it("maps legacy_office to application/msword mime", () => {
    const result = detectContentType(ole2Buffer);
    expect(result.mimeType).toBe("application/msword");
  });
});

describe("validateUploadContent", () => {
  it("returns detected MIME and SHA-256 for matching content", () => {
    const result = validateUploadContent(pdfBuffer, "application/pdf", "deck.pdf");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.detectedMimeType).toBe("application/pdf");
      expect(result.data.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("accepts case-insensitive declared MIME", () => {
    const result = validateUploadContent(pdfBuffer, "Application/PDF", "deck.pdf");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.detectedMimeType).toBe("application/pdf");
    }
  });

  it("accepts legacy DOC with matching declared MIME", () => {
    const result = validateUploadContent(ole2Buffer, "application/msword", "file.doc");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.detectedMimeType).toBe("application/msword");
    }
  });

  it("rejects declared MIME that disagrees with content signature", () => {
    const result = validateUploadContent(pdfBuffer, "text/plain", "deck.pdf");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("MIME_MISMATCH");
  });

  it("rejects executable content", () => {
    const result = validateUploadContent(elfBuffer, "application/octet-stream", "payload.bin");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("UNSUPPORTED_FILE");
  });
});
