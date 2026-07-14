// ---------------------------------------------------------------------------
// T068 — SSRF and domain guard (FR-012 / FR-013 / FR-040)
// Validates URLs against SSRF targets, enforces approved-domain allowlist,
// and tracks crawl budget (page count + text character limits).
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

export interface SsrfGuardConfig {
  /** Domains allowed for crawling (exact match or subdomain). */
  approved_domains: string[];
  /** Maximum pages allowed per crawl job. */
  max_pages: number;
  /** Maximum text characters allowed per crawl job. */
  max_text_chars: number;
}

export type SsrfGuardDenialReason =
  | "localhost"
  | "private_network"
  | "non_http"
  | "domain_not_approved"
  | "page_limit_exceeded"
  | "text_limit_exceeded";

export interface SsrfGuardResult {
  allowed: boolean;
  reason: SsrfGuardDenialReason | null;
  normalized_url: string | null;
}

export interface CrawlBudgetState {
  pages_fetched: number;
  text_chars_fetched: number;
}

// ── Default config ─────────────────────────────────────────────────────────

export const DEFAULT_SSRF_CONFIG: SsrfGuardConfig = {
  approved_domains: [],
  max_pages: 50,
  max_text_chars: 500_000,
};

// ── URL parsing helpers ────────────────────────────────────────────────────

/**
 * Parse a URL string into a normalized form.
 * Returns null for unparseable URLs.
 */
export function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Strip brackets from IPv6 bracket notation and normalize.
 */
export function stripBrackets(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

/**
 * Try to extract an embedded IPv4 from an IPv4-mapped IPv6 address.
 * Input is already bracket-stripped. Returns decimal octets or null.
 * Handles both dotted-decimal (::ffff:127.0.0.1) and hex (::ffff:7f00:1) forms.
 */
export function extractEmbeddedIpv4(
  host: string,
): [number, number, number, number] | null {
  // Match ::ffff:XX.XX.XX.XX (dotted-decimal form)
  const decimalMatch = host.match(
    /^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (decimalMatch) {
    return [
      Number(decimalMatch[1]),
      Number(decimalMatch[2]),
      Number(decimalMatch[3]),
      Number(decimalMatch[4]),
    ];
  }
  // Match ::ffff:XXXX:XXXX (hex-group form from URL parser)
  const hexMatch = host.match(
    /^::ffff:([0-9a-f]{1,4})(?::([0-9a-f]{1,4}))?(?::([0-9a-f]{1,4}))?(?::([0-9a-f]{1,4}))?$/,
  );
  if (hexMatch) {
    const groups = hexMatch
      .slice(1)
      .filter(Boolean)
      .map((g) => parseInt(g, 16));
    const octets: number[] = [];
    for (const g of groups) {
      octets.push((g >> 8) & 0xff);
      octets.push(g & 0xff);
    }
    while (octets.length < 4) octets.unshift(0);
    if (octets.length !== 4) return null;
    return [octets[0], octets[1], octets[2], octets[3]];
  }
  return null;
}

// ── Address classification ─────────────────────────────────────────────────

/**
 * Check whether a hostname resolves to a localhost or loopback address.
 */
export function isLocalhost(hostname: string): boolean {
  const lower = stripBrackets(hostname);
  if (lower === "localhost" || lower === "localhost.localdomain") return true;
  // IPv4 loopback
  if (lower === "127.0.0.0" || lower.startsWith("127.")) return true;
  // IPv6 loopback
  if (lower === "::1") return true;
  // IPv4-in-IPv6 mapped loopback
  const embedded = extractEmbeddedIpv4(lower);
  if (embedded && embedded[0] === 127) return true;
  return false;
}

/**
 * Check whether a hostname is a private/reserved network address.
 * RFC 1918, RFC 5735, link-local, carrier-grade NAT, documentation ranges.
 */
export function isPrivateNetwork(hostname: string): boolean {
  const lower = stripBrackets(hostname);

  // Check IPv4-mapped IPv6 first
  const embedded = extractEmbeddedIpv4(lower);
  if (embedded) {
    const [a, b] = embedded;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }

  // IPv4 patterns
  const ipv4Match = lower.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/,
  );
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    // 10.0.0.0/8
    if (a === 10) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 192.168.0.0/16
    if (a === 192 && b === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (a === 169 && b === 254) return true;
    // 100.64.0.0/10 (carrier-grade NAT, RFC 6598)
    if (a === 100 && b >= 64 && b <= 127) return true;
    // 198.18.0.0/15 (benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;
    // 0.0.0.0/8
    if (a === 0) return true;
    return false;
  }

  // IPv6 private ranges (simplified prefix checks)
  if (lower.includes(":")) {
    // fc00::/7 (unique local addresses)
    if (/^fc|^fd/i.test(lower)) return true;
    // fe80::/10 (link-local)
    if (/^fe8/i.test(lower)) return true;
  }

  return false;
}

/**
 * Check whether a URL points to an HTTP or HTTPS target.
 */
export function isHttpOrHttps(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

/**
 * Check whether a hostname matches an approved domain.
 * Matches the exact domain or any subdomain of it.
 */
export function isDomainApproved(
  hostname: string,
  approvedDomains: string[],
): boolean {
  const lower = hostname.toLowerCase();
  return approvedDomains.some((domain) => {
    const d = domain.toLowerCase();
    return lower === d || lower.endsWith(`.${d}`);
  });
}

// ── Validation entry points ────────────────────────────────────────────────

/**
 * Validate a URL against SSRF guards.
 * Returns SsrfGuardResult with allowed flag and denial reason.
 */
export function validateUrl(
  url: string,
  config: SsrfGuardConfig,
): SsrfGuardResult {
  const parsed = parseUrl(url);
  if (!parsed) {
    return { allowed: false, reason: "non_http", normalized_url: null };
  }

  if (!isHttpOrHttps(parsed.protocol)) {
    return { allowed: false, reason: "non_http", normalized_url: null };
  }

  if (isLocalhost(parsed.hostname)) {
    return { allowed: false, reason: "localhost", normalized_url: parsed.href };
  }

  if (isPrivateNetwork(parsed.hostname)) {
    return {
      allowed: false,
      reason: "private_network",
      normalized_url: parsed.href,
    };
  }

  if (!isDomainApproved(parsed.hostname, config.approved_domains)) {
    return {
      allowed: false,
      reason: "domain_not_approved",
      normalized_url: parsed.href,
    };
  }

  return { allowed: true, reason: null, normalized_url: parsed.href };
}

/**
 * Check whether adding pages/text would exceed crawl budget.
 */
export function checkCrawlBudget(
  state: CrawlBudgetState,
  config: SsrfGuardConfig,
  additionalPages: number,
  additionalTextChars: number,
): SsrfGuardResult {
  const totalPages = state.pages_fetched + additionalPages;
  const totalChars = state.text_chars_fetched + additionalTextChars;

  if (totalPages > config.max_pages) {
    return {
      allowed: false,
      reason: "page_limit_exceeded",
      normalized_url: null,
    };
  }

  if (totalChars > config.max_text_chars) {
    return {
      allowed: false,
      reason: "text_limit_exceeded",
      normalized_url: null,
    };
  }

  return { allowed: true, reason: null, normalized_url: null };
}
