// ── Types ──────────────────────────────────────────────────────────────────

export const ContentType = {
  PDF: "pdf",
  DOCX: "docx",
  XLSX: "xlsx",
  PPTX: "pptx",
  HTML: "html",
  TEXT: "text",
  EXECUTABLE: "executable",
  LEGACY_OFFICE: "legacy_office",
  UNKNOWN: "unknown",
} as const;

export type ContentType = (typeof ContentType)[keyof typeof ContentType];

export interface ContentSignature {
  contentType: ContentType;
  confidence: "high" | "medium" | "none";
  extension: string;
  mimeType: string;
}

// ── MIME mapping ──────────────────────────────────────────────────────────

const CONTENT_TYPE_MIME: Record<ContentType, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  html: "text/html",
  text: "text/plain",
  executable: "application/octet-stream",
  legacy_office: "application/msword",
  unknown: "application/octet-stream",
};

const CONTENT_TYPE_EXTENSION: Record<ContentType, string> = {
  pdf: ".pdf",
  docx: ".docx",
  xlsx: ".xlsx",
  pptx: ".pptx",
  html: ".html",
  text: ".txt",
  executable: "",
  legacy_office: ".doc",
  unknown: "",
};

// ── Detection helpers ─────────────────────────────────────────────────────

function startsWithPdf(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return (
    buf[0] === 0x25 && // %
    buf[1] === 0x50 && // P
    buf[2] === 0x44 && // D
    buf[3] === 0x46 // F
  );
}

function startsWithZip(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return (
    buf[0] === 0x50 && // P
    buf[1] === 0x4b && // K
    buf[2] === 0x03 &&
    buf[3] === 0x04
  );
}

function startsWithOle2(buf: Buffer): boolean {
  if (buf.length < 8) return false;
  return (
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0 &&
    buf[4] === 0xa1 &&
    buf[5] === 0xb1 &&
    buf[6] === 0x1a &&
    buf[7] === 0xe1
  );
}

function startsWithHtml(buf: Buffer): boolean {
  if (buf.length < 5) return false;
  // Check for <!DOC or <html (case-insensitive via lowercase comparison)
  const head = buf.toString("utf8", 0, Math.min(buf.length, 512)).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

function hasShebang(buf: Buffer): boolean {
  if (buf.length < 2) return false;
  return buf[0] === 0x23 && buf[1] === 0x21; // #!
}

function containsElfMagic(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  return (
    buf[0] === 0x7f &&
    buf[1] === 0x45 && // E
    buf[2] === 0x4c && // L
    buf[3] === 0x46 // F
  );
}

function containsPeMagic(buf: Buffer): boolean {
  if (buf.length < 2) return false;
  return buf[0] === 0x4d && buf[1] === 0x5a; // MZ
}

function isPlainText(buf: Buffer): boolean {
  if (buf.length === 0) return false;
  // Check if content is valid UTF-8 text (no null bytes in first 1KB)
  const sample = buf.subarray(0, Math.min(buf.length, 1024));
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0x00) return false;
  }
  // Check if mostly printable ASCII or common UTF-8
  let printable = 0;
  for (let i = 0; i < sample.length; i++) {
    const b = sample[i];
    if (
      b >= 0x20 || // space and above
      b === 0x09 || // tab
      b === 0x0a || // newline
      b === 0x0d // carriage return
    ) {
      printable++;
    }
  }
  return printable / sample.length > 0.85;
}

// ── Filename extension disambiguation ─────────────────────────────────────

function getExtensionFromFilename(filename?: string): string {
  if (!filename) return "";
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot).toLowerCase();
}

function disambiguateZipByExtension(ext: string): ContentType {
  switch (ext) {
    case ".xlsx":
      return "xlsx";
    case ".pptx":
      return "pptx";
    case ".docx":
      return "docx";
    default:
      return "unknown";
  }
}

function disambiguateOle2ByExtension(ext: string): ContentType {
  switch (ext) {
    case ".xls":
      return "legacy_office";
    case ".ppt":
      return "legacy_office";
    case ".doc":
    default:
      return "legacy_office";
  }
}

// ── Main detection ────────────────────────────────────────────────────────

/**
 * Detect content type from buffer magic bytes.
 *
 * pass the filename to disambiguate. Without filename, ZIP defaults to
 * unknown and OLE2 defaults to doc.
 */
export function detectContentType(
  buf: Buffer,
  filename?: string,
): ContentSignature {
  if (!buf || buf.length === 0) {
    return {
      contentType: "unknown",
      confidence: "none",
      extension: "",
      mimeType: CONTENT_TYPE_MIME.unknown,
    };
  }

  const ext = getExtensionFromFilename(filename);

  // PDF
  if (startsWithPdf(buf)) {
    return {
      contentType: "pdf",
      confidence: "high",
      extension: ".pdf",
      mimeType: CONTENT_TYPE_MIME.pdf,
    };
  }

  // ZIP-based Office formats (DOCX, XLSX, PPTX)
  if (startsWithZip(buf)) {
    const contentType = disambiguateZipByExtension(ext);
    return {
      contentType,
      confidence: "high",
      extension: CONTENT_TYPE_EXTENSION[contentType],
      mimeType: CONTENT_TYPE_MIME[contentType],
    };
  }

  // Legacy OLE2 Office formats (DOC, PPT)
  if (startsWithOle2(buf)) {
    const contentType = disambiguateOle2ByExtension(ext);
    return {
      contentType,
      confidence: "high",
      extension: ext || CONTENT_TYPE_EXTENSION[contentType],
      mimeType: CONTENT_TYPE_MIME[contentType],
    };
  }

  // HTML
  if (startsWithHtml(buf)) {
    return {
      contentType: "html",
      confidence: "high",
      extension: ".html",
      mimeType: CONTENT_TYPE_MIME.html,
    };
  }

  // Executables (ELF, PE, shebang)
  if (containsElfMagic(buf) || containsPeMagic(buf) || hasShebang(buf)) {
    return {
      contentType: "executable",
      confidence: "high",
      extension: "",
      mimeType: CONTENT_TYPE_MIME.executable,
    };
  }

  // Plain text
  if (isPlainText(buf)) {
    return {
      contentType: "text",
      confidence: "medium",
      extension: ".txt",
      mimeType: CONTENT_TYPE_MIME.text,
    };
  }

  return {
    contentType: "unknown",
    confidence: "none",
    extension: "",
    mimeType: CONTENT_TYPE_MIME.unknown,
  };
}
