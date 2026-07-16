import { describe, expect, it } from "vitest";
import { DocumentParserRouter } from "@/infrastructure/business-context/document-parser-router";
import type {
  DocumentParserPort,
  ParsedDocument,
} from "@/core/business-context/document-parser.port";
import type { ServiceResult } from "@/core/business-context/types";

function ok(content: string, warnings: string[] = []): ServiceResult<ParsedDocument> {
  return {
    ok: true,
    data: {
      contentText: content,
      parserName: "fake",
      parserVersion: "1.0",
      warnings,
      metadata: {},
    },
  };
}

class FakeNative implements DocumentParserPort {
  constructor(
    private readonly supported: string[],
    private readonly output: ServiceResult<ParsedDocument>
  ) {}
  supports(mime: string) {
    return this.supported.includes(mime);
  }
  async parse() {
    return this.output;
  }
  async parseContent() {
    return this.output;
  }
}

class FakeOcr implements DocumentParserPort {
  constructor(
    private readonly supported: string[],
    private readonly output: ServiceResult<ParsedDocument>
  ) {}
  supports(mime: string) {
    return this.supported.includes(mime);
  }
  async parse() {
    return this.output;
  }
  async parseContent() {
    return this.output;
  }
}

describe("DocumentParserRouter", () => {
  it("uses native for text-based MIME", async () => {
    const native = new FakeNative(
      ["application/pdf"],
      ok("Hello")
    );
    const ocr = new FakeOcr(["application/pdf"], ok("OCR"));
    const r = new DocumentParserRouter(native, ocr);
    const out = await r.parse({
      storagePath: "private/doc-1",
      mimeType: "application/pdf",
      fileName: "doc.pdf",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.contentText).toBe("Hello");
  });

  it("falls back to OCR when native content is empty", async () => {
    const native = new FakeNative(["application/pdf"], ok(""));
    const ocr = new FakeOcr(["application/pdf"], ok("OCR Hello"));
    const r = new DocumentParserRouter(native, ocr);
    const out = await r.parse({
      storagePath: "private/doc-1",
      mimeType: "application/pdf",
      fileName: "doc.pdf",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.contentText).toContain("OCR");
  });

  it("falls back to OCR when native returns parser failure", async () => {
    const native = new FakeNative(
      ["application/pdf"],
      { ok: false, error: { code: "PARSE_FAILED", message: "x" } }
    );
    const ocr = new FakeOcr(["application/pdf"], ok("OCR Hello"));
    const r = new DocumentParserRouter(native, ocr);
    const out = await r.parse({
      storagePath: "private/doc-1",
      mimeType: "application/pdf",
      fileName: "doc.pdf",
    });
    expect(out.ok).toBe(true);
  });

  it("returns UNSUPPORTED_MIME when neither parser supports", async () => {
    const native = new FakeNative([], ok(""));
    const ocr = new FakeOcr([], ok(""));
    const r = new DocumentParserRouter(native, ocr);
    const out = await r.parse({
      storagePath: "private/doc-1",
      mimeType: "application/zip",
      fileName: "x.zip",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("UNSUPPORTED_MIME");
  });

  it("returns LEGACY_FORMAT_UNSUPPORTED for legacy Word MIME type", async () => {
    const native = new FakeNative([], ok(""));
    const ocr = new FakeOcr([], ok(""));
    const r = new DocumentParserRouter(native, ocr);
    const out = await r.parse({
      storagePath: "private/doc-1",
      mimeType: "application/msword",
      fileName: "old.doc",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("LEGACY_FORMAT_UNSUPPORTED");
  });

  it("returns LEGACY_FORMAT_UNSUPPORTED for legacy PowerPoint MIME type", async () => {
    const native = new FakeNative([], ok(""));
    const ocr = new FakeOcr([], ok(""));
    const r = new DocumentParserRouter(native, ocr);
    const out = await r.parse({
      storagePath: "private/doc-1",
      mimeType: "application/vnd.ms-powerpoint",
      fileName: "old.ppt",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("LEGACY_FORMAT_UNSUPPORTED");
  });

  it("returns LEGACY_FORMAT_UNSUPPORTED for legacy Excel MIME type", async () => {
    const native = new FakeNative([], ok(""));
    const ocr = new FakeOcr([], ok(""));
    const r = new DocumentParserRouter(native, ocr);
    const out = await r.parse({
      storagePath: "private/doc-1",
      mimeType: "application/vnd.ms-excel",
      fileName: "old.xls",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error.code).toBe("LEGACY_FORMAT_UNSUPPORTED");
  });

  it("supports() returns false for legacy MIME types", () => {
    const native = new FakeNative(["application/msword"], ok(""));
    const ocr = new FakeOcr([], ok(""));
    const r = new DocumentParserRouter(native, ocr);
    expect(r.supports("application/msword")).toBe(false);
    expect(r.supports("application/vnd.ms-powerpoint")).toBe(false);
    expect(r.supports("application/vnd.ms-excel")).toBe(false);
  });

  it("preserves native-first behavior for OOXML docx", async () => {
    const native = new FakeNative(
      ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ok("Hello from docx")
    );
    const ocr = new FakeOcr(
      ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ok("OCR fallback")
    );
    const r = new DocumentParserRouter(native, ocr);
    const out = await r.parse({
      storagePath: "private/doc-1",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileName: "new.docx",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.contentText).toBe("Hello from docx");
  });
});
