// ---------------------------------------------------------------------------
// T070 — External content sanitizer (FR-013 / FR-044)
// Prepares crawled or uploaded content for safe storage and LLM consumption.
// All external content is treated as untrusted.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

export interface SanitizeOptions {
  /** Strip HTML tags entirely, leaving only text content. Default: true. */
  stripHtml?: boolean;
  /** Remove script/style blocks before text extraction. Default: true. */
  removeScripts?: boolean;
  /** Collapse whitespace runs to single spaces. Default: true. */
  collapseWhitespace?: boolean;
  /** Maximum output length in characters. 0 = unlimited. Default: 0. */
  maxLength?: number;
  /** Prefix each line for LLM prompt safety. Default: false. */
  linePrefix?: boolean;
}

export interface SanitizeResult {
  /** Cleaned text content. */
  text: string;
  /** Original byte length before sanitization. */
  original_length: number;
  /** Sanitized byte length after processing. */
  sanitized_length: number;
  /** Number of potentially dangerous patterns removed. */
  patterns_removed: number;
  /** Whether output was truncated to maxLength. */
  truncated: boolean;
}

const DEFAULT_OPTIONS: Required<SanitizeOptions> = {
  stripHtml: true,
  removeScripts: true,
  collapseWhitespace: true,
  maxLength: 0,
  linePrefix: false,
};

// ── Dangerous protocol patterns ────────────────────────────────────────────

const DANGEROUS_PROTOCOLS =
  /(?:javascript|vbscript|data|blob):/gi;

const EVENT_HANDLER = /\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

const SCRIPT_BLOCK =
  /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;

const STYLE_BLOCK =
  /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi;

const HTML_TAG =
  /<[^>]+>/g;

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

// ── Core sanitization ──────────────────────────────────────────────────────

/**
 * Sanitize external/untrusted content for safe storage and LLM use.
 *
 * Strips HTML, removes scripts, neutralizes dangerous protocols,
 * collapses whitespace, and optionally truncates output.
 */
export function sanitizeContent(
  input: string,
  options?: SanitizeOptions,
): SanitizeResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let text = input;
  let patternsRemoved = 0;

  // ── Strip script/style blocks ──────────────────────────────────────────
  if (opts.removeScripts) {
    const beforeScript = text;
    text = text.replace(SCRIPT_BLOCK, (match) => {
      patternsRemoved++;
      return `<!-- removed script ${match.length} bytes -->`;
    });
    text = text.replace(STYLE_BLOCK, (match) => {
      patternsRemoved++;
      return `<!-- removed style ${match.length} bytes -->`;
    });
    if (text !== beforeScript) {
      // Already counted in replace callbacks
    }
  }

  // ── Remove event handlers ──────────────────────────────────────────────
  text = text.replace(EVENT_HANDLER, (match) => {
    patternsRemoved++;
    return "";
  });

  // ── Neutralize dangerous protocols in href/src attributes ──────────────
  text = text.replace(DANGEROUS_PROTOCOLS, (match) => {
    patternsRemoved++;
    return "unsafe:";
  });

  // ── Strip HTML tags ────────────────────────────────────────────────────
  if (opts.stripHtml) {
    const before = text;
    text = text.replace(HTML_TAG, (match) => {
      patternsRemoved++;
      return "";
    });
    if (text !== before) {
      // counted in replace callbacks
    }
  }

  // ── Remove control characters ──────────────────────────────────────────
  text = text.replace(CONTROL_CHARS, () => {
    patternsRemoved++;
    return "";
  });

  // ── Collapse whitespace ────────────────────────────────────────────────
  if (opts.collapseWhitespace) {
    text = text.replace(/\s{2,}/g, " ");
  }

  // ── Decode common HTML entities ────────────────────────────────────────
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");

  // ── Trim ───────────────────────────────────────────────────────────────
  text = text.trim();

  // ── Truncate ───────────────────────────────────────────────────────────
  let truncated = false;
  if (opts.maxLength > 0 && text.length > opts.maxLength) {
    text = text.slice(0, opts.maxLength);
    truncated = true;
  }

  // ── LLM line prefix ────────────────────────────────────────────────────
  if (opts.linePrefix) {
    text = text
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }

  return {
    text,
    original_length: input.length,
    sanitized_length: text.length,
    patterns_removed: patternsRemoved,
    truncated,
  };
}

// ── Convenience helpers ────────────────────────────────────────────────────

/**
 * Quick HTML-to-text extraction with safe defaults.
 */
export function htmlToText(html: string): string {
  return sanitizeContent(html, {
    stripHtml: true,
    removeScripts: true,
    collapseWhitespace: true,
  }).text;
}

/**
 * Prepare content for LLM prompt injection defense.
 * Strips HTML, collapses whitespace, and prefixes lines.
 */
export function llmSafeContent(raw: string): string {
  return sanitizeContent(raw, {
    stripHtml: true,
    removeScripts: true,
    collapseWhitespace: true,
    linePrefix: true,
  }).text;
}
