import { describe, expect, it } from "vitest";
import {
  validateUpload,
  calculateChecksum,
  getExtension,
  type UploadMetadata,
  type UploadValidatorConfig,
} from "@/infrastructure/business-context/upload-validator";

const pdf = Buffer.from("%PDF-1.4 fake content");
const docx = Buffer.from("PK\x03\x04docx content");

const config: UploadValidatorConfig = {
  max_size_bytes: 50 * 1024 * 1024,
  allowed_extensions: new Set([
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
  ]),
  allowed_mime_types: new Set([
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
  ]),
};

function upload(overrides: Partial<UploadMetadata>): UploadMetadata {
  return {
    filename: "file.pdf",
    mime_type: "application/pdf",
    size_bytes: 1024,
    content: pdf,
    ...overrides,
  };
}

describe("getExtension", () => {
  it("returns lowercase extension with dot", () => {
    expect(getExtension("REPORT.PDF")).toBe(".pdf");
  });
  it("returns empty string for files with no extension", () => {
    expect(getExtension("README")).toBe("");
  });
});

describe("calculateChecksum", () => {
  it("produces a stable sha256:<hex> digest", () => {
    const a = calculateChecksum(Buffer.from("hello"));
    const b = calculateChecksum(Buffer.from("hello"));
    expect(a).toBe(b);
    expect(a.startsWith("sha256:")).toBe(true);
    expect(a.slice("sha256:".length)).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("validateUpload", () => {
  it("accepts a clean PDF", () => {
    const r = validateUpload(upload({}), config);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.checksum).toBeTruthy();
  });

  it("rejects .exe extension", () => {
    const r = validateUpload(
      upload({
        filename: "malware.exe",
        mime_type: "application/x-msdownload",
        content: Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
      }),
      config
    );
    expect(r.valid).toBe(false);
  });

  it("rejects mismatched extension and MIME", () => {
    const r = validateUpload(
      upload({ filename: "doc.pdf", mime_type: "image/png", content: pdf }),
      config
    );
    expect(r.valid).toBe(false);
  });

  it("accepts a clean DOCX", () => {
    const r = validateUpload(
      upload({
        filename: "proposal.docx",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        content: docx,
      }),
      config
    );
    expect(r.valid).toBe(true);
  });

  it("rejects empty file", () => {
    const r = validateUpload(
      upload({ size_bytes: 0, content: Buffer.alloc(0) }),
      config
    );
    expect(r.valid).toBe(false);
  });

  it("rejects oversized file", () => {
    const big = Buffer.alloc(config.max_size_bytes + 1, 0x20);
    const r = validateUpload(
      upload({ size_bytes: big.length, content: big }),
      config
    );
    expect(r.valid).toBe(false);
  });

  it("detects duplicate via existing checksums map", () => {
    const first = validateUpload(upload({}), config);
    const second = validateUpload(upload({}), config, new Map([[first.checksum!, "src-existing"]]));
    expect(second.is_duplicate).toBe(true);
    expect(second.duplicate_of_source_id).toBe("src-existing");
  });
});
