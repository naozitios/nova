import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ServiceResult } from "@/core/business-context/types";
import type { ParsedDocument } from "@/core/business-context/document-parser.port";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockRoute = vi.fn(
  (_params: { content: Buffer; mimeType: string; fileName?: string }) =>
    Promise.resolve({ ok: true, data: { contentText: "", parserName: "mock", parserVersion: "0", warnings: [], metadata: {} } } as ServiceResult<ParsedDocument>),
);

const SUPPORTED = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/html",
  "text/plain",
]);

vi.mock("@/infrastructure/business-context/parsers", () => ({
  NativeDocumentParser: class {
    supports(mime: string) {
      return SUPPORTED.has(mime);
    }
    route = mockRoute;
  },
}));

const mockDownload = vi.fn();
vi.mock("@/infrastructure/business-context/supabase-client", () => ({
  getSupabaseServiceClient: () => ({
    storage: {
      from: () => ({
        download: mockDownload,
      }),
    },
  }),
}));

vi.mock("@/infrastructure/config", () => ({
  config: {
    businessContext: {
      storageSourceBucket: "test-bucket",
    },
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function okResult(
  content: string,
  warnings: string[] = []
): ServiceResult<ParsedDocument> {
  return {
    ok: true,
    data: {
      contentText: content,
      parserName: "native",
      parserVersion: "1.0",
      warnings,
      metadata: {},
    },
  };
}

function errResult(
  code: string,
  message: string
): ServiceResult<ParsedDocument> {
  return { ok: false, error: { code, message } };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

const TEXT_MIME_TYPES = [
  ["PDF", "application/pdf"],
  ["DOCX", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["XLSX", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["PPTX", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ["HTML", "text/html"],
  ["plain text", "text/plain"],
];

const LEGACY_MIME_TYPES = [
  ["legacy Word (.doc)", "application/msword"],
  ["legacy PowerPoint (.ppt)", "application/vnd.ms-powerpoint"],
  ["legacy Excel (.xls)", "application/vnd.ms-excel"],
];

describe("NativeDocumentParserAdapter", () => {
  let adapter: InstanceType<
    typeof import("@/infrastructure/business-context/native-document.parser.adapter").NativeDocumentParserAdapter
  >;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import(
      "@/infrastructure/business-context/native-document.parser.adapter"
    );
    adapter = new mod.NativeDocumentParserAdapter();
  });

  // ─── supports() ─────────────────────────────────────────────────────────

  describe("supports()", () => {
    for (const [label, mime] of TEXT_MIME_TYPES) {
      it(`returns true for ${label} (${mime})`, () => {
        expect(adapter.supports(mime)).toBe(true);
      });
    }

    for (const [label, mime] of LEGACY_MIME_TYPES) {
      it(`returns false for ${label} (${mime})`, () => {
        expect(adapter.supports(mime)).toBe(false);
      });
    }

    it("returns false for unknown MIME type", () => {
      expect(adapter.supports("application/zip")).toBe(false);
    });
  });

  // ─── parseContent() routing ─────────────────────────────────────────────

  describe("parseContent()", () => {
    for (const [label, mime] of TEXT_MIME_TYPES) {
      it(`routes ${label} (${mime}) to native parser`, async () => {
        const buf = Buffer.from("test content");
        mockRoute.mockResolvedValueOnce(okResult("parsed text"));

        const result = await adapter.parseContent({
          content: buf,
          mimeType: mime,
        });

        expect(result.ok).toBe(true);
        expect(mockRoute).toHaveBeenCalledWith({
          content: buf,
          mimeType: mime,
          fileName: undefined,
        });
      });
    }

    it("passes fileName through to route", async () => {
      mockRoute.mockResolvedValueOnce(okResult("ok"));
      await adapter.parseContent({
        content: Buffer.from("x"),
        mimeType: "application/pdf",
        fileName: "report.pdf",
      });
      expect(mockRoute).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: "report.pdf" })
      );
    });

    it("propagates native parse failure", async () => {
      mockRoute.mockResolvedValueOnce(
        errResult("PARSE_FAILED", "corrupt PDF")
      );

      const result = await adapter.parseContent({
        content: Buffer.from("bad"),
        mimeType: "application/pdf",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PARSE_FAILED");
        expect(result.error.message).toContain("corrupt PDF");
      }
    });

    it("propagates UNSUPPORTED_MIME for unknown MIME", async () => {
      mockRoute.mockResolvedValueOnce(
        errResult("UNSUPPORTED_MIME", "not supported")
      );

      const result = await adapter.parseContent({
        content: Buffer.from("data"),
        mimeType: "image/png",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("UNSUPPORTED_MIME");
    });
  });

  // ─── parse() via storage ────────────────────────────────────────────────

  describe("parse()", () => {
    it("downloads from storage then routes through parser", async () => {
      const fileBuf = Buffer.from("file-bytes");
      const fakeBlob = { arrayBuffer: () => Promise.resolve(fileBuf) };
      mockDownload.mockResolvedValueOnce({ data: fakeBlob, error: null });
      mockRoute.mockResolvedValueOnce(okResult("parsed from storage"));

      const result = await adapter.parse({
        storagePath: "private/doc.pdf",
        mimeType: "application/pdf",
      });

      expect(result.ok).toBe(true);
      expect(mockDownload).toHaveBeenCalled();
      expect(mockRoute).toHaveBeenCalledWith({
        content: fileBuf,
        mimeType: "application/pdf",
        fileName: undefined,
      });
    });

    it("returns PARSE_FAILED on storage download error", async () => {
      mockDownload.mockResolvedValueOnce({
        data: null,
        error: { message: "bucket not found" },
      });

      const result = await adapter.parse({
        storagePath: "missing/doc.pdf",
        mimeType: "application/pdf",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PARSE_FAILED");
        expect(result.error.message).toContain("Storage download failed");
      }
      expect(mockRoute).not.toHaveBeenCalled();
    });

    it("returns PARSE_FAILED when download throws", async () => {
      mockDownload.mockRejectedValueOnce(new Error("network timeout"));

      const result = await adapter.parse({
        storagePath: "private/doc.pdf",
        mimeType: "application/pdf",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PARSE_FAILED");
        expect(result.error.message).toContain("network timeout");
      }
    });

    it("returns parse error when route fails after download", async () => {
      const fileBuf = Buffer.from("bytes");
      mockDownload.mockResolvedValueOnce({
        data: { arrayBuffer: () => Promise.resolve(fileBuf) },
        error: null,
      });
      mockRoute.mockResolvedValueOnce(
        errResult("PARSE_FAILED", "damaged file")
      );

      const result = await adapter.parse({
        storagePath: "private/doc.pdf",
        mimeType: "application/pdf",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PARSE_FAILED");
        expect(result.error.message).toContain("damaged file");
      }
    });
  });
});
