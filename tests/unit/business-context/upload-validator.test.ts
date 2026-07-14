import { describe, expect, it } from "vitest";
import {
  validateUpload,
  calculateChecksum,
  getExtension,
  type UploadMetadata,
  type UploadValidationResult,
  type UploadValidatorConfig,
} from "../../../src/infrastructure/business-context/upload-validator";

// ---------------------------------------------------------------------------
// T063 — Upload validation pure-function tests
// Tests import from src/infrastructure/business-context/upload-validator.ts
// which does not exist yet. Tests MUST fail (RED phase of TDD).
//
// FR-014: validate extension/MIME allowlists, reject encrypted/executable,
//         checksum before parsing, deduplicate within business.
// ---------------------------------------------------------------------------

// ── Default config (FR-014 / edge cases) ──────────────────────────────────

const DEFAULT_CONFIG: UploadValidatorConfig = {
  max_size_bytes: 50 * 1024 * 1024, // 50 MB
  allowed_extensions: new Set([
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".ppt", ".pptx", ".html", ".htm", ".txt",
    ".png", ".jpg", ".jpeg",
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

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Upload validator — extension/MIME validation", () => {
  it("accepts a valid PDF with matching extension and MIME", () => {
    const result = validateUpload(
      {
        filename: "report.pdf",
        mime_type: "application/pdf",
        size_bytes: 1024,
        content: Buffer.from("%PDF-1.4 fake content"),
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects when extension is not in allowlist", () => {
    const result = validateUpload(
      {
        filename: "malware.exe",
        mime_type: "application/x-executable",
        size_bytes: 1024,
        content: Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("extension_not_allowed");
  });

  it("rejects when MIME type is not in allowlist", () => {
    const result = validateUpload(
      {
        filename: "script.js",
        mime_type: "application/javascript",
        size_bytes: 1024,
        content: Buffer.from("console.log('hello')"),
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("mime_not_allowed");
  });

  it("rejects when extension and MIME disagree even if both allowed", () => {
    const result = validateUpload(
      {
        filename: "data.pdf",
        mime_type: "image/png",
        size_bytes: 1024,
        content: Buffer.from("%PDF-1.4 not actually a PDF"),
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("mime_extension_mismatch");
  });

  it("accepts .docx with correct MIME type", () => {
    const result = validateUpload(
      {
        filename: "proposal.docx",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size_bytes: 2048,
        content: Buffer.from("PK\x03\x04docx content"),
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(true);
  });
});

describe("Upload validator — encrypted file rejection", () => {
  it("rejects a password-protected PDF containing /Encrypt", () => {
    const encryptedPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Encrypt >>\nendobj",
      "ascii",
    );
    const result = validateUpload(
      {
        filename: "secret.pdf",
        mime_type: "application/pdf",
        size_bytes: encryptedPdf.length,
        content: encryptedPdf,
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("encrypted_file");
  });

  it("accepts a normal PDF without /Encrypt", () => {
    const normalPdf = Buffer.from(
      "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj",
      "ascii",
    );
    const result = validateUpload(
      {
        filename: "open.pdf",
        mime_type: "application/pdf",
        size_bytes: normalPdf.length,
        content: normalPdf,
      },
      DEFAULT_CONFIG,
    );
    expect(result.errors).not.toContain("encrypted_file");
  });
});

describe("Upload validator — executable file rejection", () => {
  it("rejects an ELF binary", () => {
    const elfHeader = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]);
    const result = validateUpload(
      {
        filename: "program.bin",
        mime_type: "application/octet-stream",
        size_bytes: elfHeader.length,
        content: elfHeader,
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("executable_file");
  });

  it("rejects a Windows PE executable (MZ header)", () => {
    const mzHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
    const result = validateUpload(
      {
        filename: "app.bin",
        mime_type: "application/octet-stream",
        size_bytes: mzHeader.length,
        content: mzHeader,
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("executable_file");
  });

  it("rejects a shell script with shebang", () => {
    const shebang = Buffer.from("#!/bin/bash\necho hello");
    const result = validateUpload(
      {
        filename: "script.sh",
        mime_type: "text/x-shellscript",
        size_bytes: shebang.length,
        content: shebang,
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("executable_file");
  });

  it("accepts a normal text file without executable magic", () => {
    const normalText = Buffer.from("Hello, this is plain text content.");
    const result = validateUpload(
      {
        filename: "notes.txt",
        mime_type: "text/plain",
        size_bytes: normalText.length,
        content: normalText,
      },
      DEFAULT_CONFIG,
    );
    expect(result.errors).not.toContain("executable_file");
  });
});

describe("Upload validator — size limit enforcement", () => {
  it("accepts a file within the 50 MB limit", () => {
    const content = Buffer.alloc(1024, 0x41);
    const result = validateUpload(
      {
        filename: "small.pdf",
        mime_type: "application/pdf",
        size_bytes: content.length,
        content,
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(true);
  });

  it("rejects a file exceeding 50 MB", () => {
    const overSize = DEFAULT_CONFIG.max_size_bytes + 1;
    const result = validateUpload(
      {
        filename: "huge.pdf",
        mime_type: "application/pdf",
        size_bytes: overSize,
        content: Buffer.alloc(1024),
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("file_too_large");
  });

  it("rejects an empty file", () => {
    const result = validateUpload(
      {
        filename: "empty.pdf",
        mime_type: "application/pdf",
        size_bytes: 0,
        content: Buffer.alloc(0),
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("empty_file");
  });

  it("accepts a file exactly at the 50 MB limit", () => {
    const exactSize = DEFAULT_CONFIG.max_size_bytes;
    const result = validateUpload(
      {
        filename: "boundary.pdf",
        mime_type: "application/pdf",
        size_bytes: exactSize,
        content: Buffer.alloc(1024),
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(true);
  });
});

describe("Upload validator — checksum calculation", () => {
  it("calculates SHA-256 checksum for valid content", () => {
    const content = Buffer.from("test content for hashing");
    const result = validateUpload(
      {
        filename: "doc.txt",
        mime_type: "text/plain",
        size_bytes: content.length,
        content,
      },
      DEFAULT_CONFIG,
    );
    expect(result.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.checksum_algorithm).toBe("sha256");
  });

  it("returns null checksum for empty file", () => {
    const result = validateUpload(
      {
        filename: "empty.txt",
        mime_type: "text/plain",
        size_bytes: 0,
        content: Buffer.alloc(0),
      },
      DEFAULT_CONFIG,
    );
    expect(result.checksum).toBeNull();
  });

  it("produces consistent checksums for identical content", () => {
    const content = Buffer.from("identical content");
    const result1 = validateUpload(
      {
        filename: "a.pdf",
        mime_type: "application/pdf",
        size_bytes: content.length,
        content,
      },
      DEFAULT_CONFIG,
    );
    const result2 = validateUpload(
      {
        filename: "b.pdf",
        mime_type: "application/pdf",
        size_bytes: content.length,
        content,
      },
      DEFAULT_CONFIG,
    );
    expect(result1.checksum).toBe(result2.checksum);
  });

  it("produces different checksums for different content", () => {
    const result1 = validateUpload(
      {
        filename: "a.txt",
        mime_type: "text/plain",
        size_bytes: 4,
        content: Buffer.from("aaa"),
      },
      DEFAULT_CONFIG,
    );
    const result2 = validateUpload(
      {
        filename: "b.txt",
        mime_type: "text/plain",
        size_bytes: 4,
        content: Buffer.from("bbb"),
      },
      DEFAULT_CONFIG,
    );
    expect(result1.checksum).not.toBe(result2.checksum);
  });
});

describe("Upload validator — duplicate detection", () => {
  it("detects a duplicate when checksum matches an existing source", () => {
    const content = Buffer.from("unique business document");
    const checksum = calculateChecksum(content);
    const existing = new Map([[checksum, "source-abc-123"]]);

    const result = validateUpload(
      {
        filename: "copy.pdf",
        mime_type: "application/pdf",
        size_bytes: content.length,
        content,
      },
      DEFAULT_CONFIG,
      existing,
    );
    expect(result.is_duplicate).toBe(true);
    expect(result.duplicate_of_source_id).toBe("source-abc-123");
  });

  it("does not flag as duplicate when checksum is unique", () => {
    const content = Buffer.from("never seen before content");
    const existing = new Map([["sha256:otherhash", "source-other"]]);

    const result = validateUpload(
      {
        filename: "original.pdf",
        mime_type: "application/pdf",
        size_bytes: content.length,
        content,
      },
      DEFAULT_CONFIG,
      existing,
    );
    expect(result.is_duplicate).toBe(false);
    expect(result.duplicate_of_source_id).toBeNull();
  });

  it("works with empty existing checksums map", () => {
    const content = Buffer.from("first upload ever");
    const result = validateUpload(
      {
        filename: "first.pdf",
        mime_type: "application/pdf",
        size_bytes: content.length,
        content,
      },
      DEFAULT_CONFIG,
      new Map(),
    );
    expect(result.is_duplicate).toBe(false);
    expect(result.duplicate_of_source_id).toBeNull();
  });

  it("empty file is never a duplicate", () => {
    const result = validateUpload(
      {
        filename: "empty.pdf",
        mime_type: "application/pdf",
        size_bytes: 0,
        content: Buffer.alloc(0),
      },
      DEFAULT_CONFIG,
      new Map([
        [
          "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          "source-existing",
        ],
      ]),
    );
    expect(result.is_duplicate).toBe(false);
    expect(result.checksum).toBeNull();
  });
});

describe("Upload validator — combined error scenarios", () => {
  it("reports multiple errors for a bad upload", () => {
    const result = validateUpload(
      {
        filename: "evil.exe",
        mime_type: "application/x-executable",
        size_bytes: 100 * 1024 * 1024,
        content: Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("extension_not_allowed");
    expect(result.errors).toContain("mime_not_allowed");
    expect(result.errors).toContain("file_too_large");
    expect(result.errors).toContain("executable_file");
  });

  it("reports encrypted AND executable for a crafted file", () => {
    const evilContent = Buffer.concat([
      Buffer.from("%PDF-1.4\n/Encrypt "),
      Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
    ]);
    const result = validateUpload(
      {
        filename: "crafted.pdf",
        mime_type: "application/pdf",
        size_bytes: evilContent.length,
        content: evilContent,
      },
      DEFAULT_CONFIG,
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("encrypted_file");
    expect(result.errors).toContain("executable_file");
  });
});
