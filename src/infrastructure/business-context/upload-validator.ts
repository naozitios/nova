import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// T069 — Upload validation and checksum (FR-014)
// Validates extension/MIME allowlists, rejects encrypted/executable/malformed
// files, computes SHA-256 checksums, and detects duplicates within a business.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

export interface UploadMetadata {
  filename: string;
  mime_type: string;
  size_bytes: number;
  content: Buffer;
}

export interface UploadValidatorConfig {
  max_size_bytes: number;
  allowed_extensions: Set<string>;
  allowed_mime_types: Set<string>;
}

export type UploadValidationError =
  | "extension_not_allowed"
  | "mime_not_allowed"
  | "mime_extension_mismatch"
  | "encrypted_file"
  | "executable_file"
  | "file_too_large"
  | "empty_file";

export interface UploadValidationResult {
  valid: boolean;
  errors: UploadValidationError[];
  checksum: string | null;
  checksum_algorithm: string | null;
  is_duplicate: boolean;
  duplicate_of_source_id: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extract the lowercase extension from a filename (including the dot). */
export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot < 0) return "";
  return filename.slice(dot).toLowerCase();
}

/** Map MIME type to the canonical extension it represents. */
const MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "text/html": ".html",
  "text/plain": ".txt",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

/**
 * Compute SHA-256 checksum for file content.
 * Returns "sha256:<hex>" format.
 */
export function calculateChecksum(content: Buffer): string {
  const hash = createHash("sha256").update(content).digest("hex");
  return `sha256:${hash}`;
}

// ── Content analysis ───────────────────────────────────────────────────────

function isEncryptedPdf(content: Buffer): boolean {
  const head = content.subarray(0, 4096);
  const str = head.toString("latin1");
  return str.includes("/Encrypt");
}

function containsElfMagic(content: Buffer): boolean {
  if (content.length < 4) return false;
  for (let i = 0; i <= content.length - 4; i++) {
    if (
      content[i] === 0x7f &&
      content[i + 1] === 0x45 && // E
      content[i + 2] === 0x4c && // L
      content[i + 3] === 0x46 // F
    ) {
      return true;
    }
  }
  return false;
}

function containsPeMagic(content: Buffer): boolean {
  if (content.length < 2) return false;
  for (let i = 0; i <= content.length - 2; i++) {
    if (content[i] === 0x4d && content[i + 1] === 0x5a) {
      // MZ
      return true;
    }
  }
  return false;
}

function hasShebang(content: Buffer): boolean {
  if (content.length < 2) return false;
  return content[0] === 0x23 && content[1] === 0x21; // #!
}

// ── Main validator ─────────────────────────────────────────────────────────

/**
 * Validate an upload against extension/MIME allowlists, content policies,
 * size limits, and duplicate checksums.
 *
 * @param existing - Map of existing checksum → source_id for deduplication.
 *                  Key format: "sha256:<hex>".
 */
export function validateUpload(
  metadata: UploadMetadata,
  config: UploadValidatorConfig,
  existing?: Map<string, string>,
): UploadValidationResult {
  const errors: UploadValidationError[] = [];
  const ext = getExtension(metadata.filename);

  // ── Size checks ──────────────────────────────────────────────────────
  if (metadata.size_bytes === 0) {
    errors.push("empty_file");
  } else if (metadata.size_bytes > config.max_size_bytes) {
    errors.push("file_too_large");
  }

  // ── Extension check ──────────────────────────────────────────────────
  if (!config.allowed_extensions.has(ext)) {
    errors.push("extension_not_allowed");
  }

  // ── MIME check ───────────────────────────────────────────────────────
  if (!config.allowed_mime_types.has(metadata.mime_type)) {
    errors.push("mime_not_allowed");
  }

  // ── Extension/MIME mismatch ──────────────────────────────────────────
  const expectedExt = MIME_TO_EXTENSION[metadata.mime_type];
  if (
    expectedExt &&
    config.allowed_extensions.has(ext) &&
    config.allowed_mime_types.has(metadata.mime_type) &&
    ext !== expectedExt
  ) {
    errors.push("mime_extension_mismatch");
  }

  // ── Content policy checks (only for non-empty files) ─────────────────
  if (metadata.size_bytes > 0) {
    if (metadata.mime_type === "application/pdf" && isEncryptedPdf(metadata.content)) {
      errors.push("encrypted_file");
    }
    if (
      containsElfMagic(metadata.content) ||
      containsPeMagic(metadata.content) ||
      hasShebang(metadata.content)
    ) {
      errors.push("executable_file");
    }
  }

  // ── Checksum ─────────────────────────────────────────────────────────
  let checksum: string | null = null;
  let checksum_algorithm: string | null = null;
  if (metadata.size_bytes > 0) {
    checksum = calculateChecksum(metadata.content);
    checksum_algorithm = "sha256";
  }

  // ── Duplicate detection ──────────────────────────────────────────────
  let is_duplicate = false;
  let duplicate_of_source_id: string | null = null;
  if (checksum && existing) {
    const match = existing.get(checksum);
    if (match) {
      is_duplicate = true;
      duplicate_of_source_id = match;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    checksum,
    checksum_algorithm,
    is_duplicate,
    duplicate_of_source_id,
  };
}
