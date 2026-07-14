import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// T062 — SSRF and crawl budget guard tests
// Self-contained: defines types and functions inline.
// Tests localhost rejection, private IP rejection, non-HTTP(S) rejection,
// approved-domain enforcement, page limit, and text size limit.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

interface SsrfGuardConfig {
  /** Domains allowed for crawling (exact match or subdomain). */
  approved_domains: string[];
  /** Maximum pages allowed per crawl job. */
  max_pages: number;
  /** Maximum text characters allowed per crawl job. */
  max_text_chars: number;
}

type SsrfGuardDenialReason =
  | "localhost"
  | "private_network"
  | "non_http"
  | "domain_not_approved"
  | "page_limit_exceeded"
  | "text_limit_exceeded";

interface SsrfGuardResult {
  allowed: boolean;
  reason: SsrfGuardDenialReason | null;
  normalized_url: string | null;
}

interface CrawlBudgetState {
  pages_fetched: number;
  text_chars_fetched: number;
}

// ── Default config (FR-012 / FR-013) ─────────────────────────────────────

const DEFAULT_SSRF_CONFIG: SsrfGuardConfig = {
  approved_domains: [],
  max_pages: 50,
  max_text_chars: 500_000,
};

// ── Functions under test ───────────────────────────────────────────────────

/**
 * Parse a URL string into a normalized form.
 * Returns null for unparseable URLs.
 */
function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * Strip brackets from IPv6 bracket notation and normalize.
 */
function stripBrackets(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").toLowerCase();
}

/**
 * Try to extract an embedded IPv4 from an IPv4-mapped IPv6 address.
 * Input is already bracket-stripped. Returns decimal octets or null.
 * Handles both dotted-decimal (::ffff:127.0.0.1) and hex (::ffff:7f00:1) forms.
 */
function extractEmbeddedIpv4(host: string): [number, number, number, number] | null {
  // Match ::ffff:XX.XX.XX.XX (dotted-decimal form)
  const decimalMatch = host.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (decimalMatch) {
    return [Number(decimalMatch[1]), Number(decimalMatch[2]), Number(decimalMatch[3]), Number(decimalMatch[4])];
  }
  // Match ::ffff:XXXX:XXXX (hex-group form from URL parser)
  // Each group is 16 bits; split into 8-bit octets
  const hexMatch = host.match(/^::ffff:([0-9a-f]{1,4})(?::([0-9a-f]{1,4}))?(?::([0-9a-f]{1,4}))?(?::([0-9a-f]{1,4}))?$/);
  if (hexMatch) {
    const groups = hexMatch.slice(1).filter(Boolean).map((g) => parseInt(g, 16));
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

/**
 * Check whether a hostname resolves to a localhost or loopback address.
 */
function isLocalhost(hostname: string): boolean {
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
function isPrivateNetwork(hostname: string): boolean {
  const lower = stripBrackets(hostname);

  // Check IPv4-mapped IPv6 first (e.g., ::ffff:10.0.0.1 or hex form)
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
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
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
function isHttpOrHttps(protocol: string): boolean {
  return protocol === "http:" || protocol === "https:";
}

/**
 * Check whether a hostname matches an approved domain.
 * Matches the exact domain or any subdomain of it.
 */
function isDomainApproved(hostname: string, approvedDomains: string[]): boolean {
  const lower = hostname.toLowerCase();
  return approvedDomains.some((domain) => {
    const d = domain.toLowerCase();
    return lower === d || lower.endsWith(`.${d}`);
  });
}

/**
 * Validate a URL against SSRF guards.
 * Returns SsrfGuardResult with allowed flag and denial reason.
 */
function validateUrl(url: string, config: SsrfGuardConfig): SsrfGuardResult {
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
    return { allowed: false, reason: "private_network", normalized_url: parsed.href };
  }

  if (!isDomainApproved(parsed.hostname, config.approved_domains)) {
    return { allowed: false, reason: "domain_not_approved", normalized_url: parsed.href };
  }

  return { allowed: true, reason: null, normalized_url: parsed.href };
}

/**
 * Check whether adding pages/text would exceed crawl budget.
 */
function checkCrawlBudget(
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

// ── Tests ──────────────────────────────────────────────────────────────────

describe("SSRF guard — localhost rejection", () => {
  const config: SsrfGuardConfig = {
    ...DEFAULT_SSRF_CONFIG,
    approved_domains: ["example.com"],
  };

  it("rejects http://localhost", () => {
    const result = validateUrl("http://localhost/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("localhost");
  });

  it("rejects http://localhost:3000", () => {
    const result = validateUrl("http://localhost:3000/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("localhost");
  });

  it("rejects http://127.0.0.1", () => {
    const result = validateUrl("http://127.0.0.1/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("localhost");
  });

  it("rejects http://127.0.0.1:8080", () => {
    const result = validateUrl("http://127.0.0.1:8080/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("localhost");
  });

  it("rejects http://127.255.255.255", () => {
    const result = validateUrl("http://127.255.255.255/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("localhost");
  });

  it("rejects http://[::1]", () => {
    const result = validateUrl("http://[::1]/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("localhost");
  });

  it("rejects http://[::ffff:127.0.0.1]", () => {
    const result = validateUrl("http://[::ffff:127.0.0.1]/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("localhost");
  });

  it("rejects http://localhost.localdomain", () => {
    const result = validateUrl("http://localhost.localdomain/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("localhost");
  });
});

describe("SSRF guard — private IP rejection", () => {
  const config: SsrfGuardConfig = {
    ...DEFAULT_SSRF_CONFIG,
    approved_domains: ["example.com"],
  };

  it("rejects 10.x.x.x (RFC 1918)", () => {
    const result = validateUrl("http://10.0.0.1/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("rejects 10.255.255.255", () => {
    const result = validateUrl("http://10.255.255.255/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("rejects 172.16.x.x through 172.31.x.x (RFC 1918)", () => {
    for (const octet of [16, 20, 31]) {
      const result = validateUrl(`http://172.${octet}.0.1/path`, config);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("private_network");
    }
  });

  it("allows 172.15.255.255 (just outside 172.16/12 — public, not private)", () => {
    const boundaryConfig: SsrfGuardConfig = { ...DEFAULT_SSRF_CONFIG, approved_domains: ["example.com", "172.15.255.255"] };
    const result = validateUrl("http://172.15.255.255/path", boundaryConfig);
    expect(result.allowed).toBe(true);
  });

  it("rejects 192.168.x.x (RFC 1918)", () => {
    const result = validateUrl("http://192.168.1.1/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("rejects 169.254.x.x (link-local)", () => {
    const result = validateUrl("http://169.254.169.254/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("rejects 100.64.x.x through 100.127.x.x (carrier-grade NAT)", () => {
    const result = validateUrl("http://100.64.0.1/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("rejects 198.18.x.x (benchmarking)", () => {
    const result = validateUrl("http://198.18.0.1/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("rejects 0.0.0.0", () => {
    const result = validateUrl("http://0.0.0.0/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("rejects IPv6 unique-local fc00::/7", () => {
    const result = validateUrl("http://[fc00::1]/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("rejects IPv6 link-local fe80::/10", () => {
    const result = validateUrl("http://[fe80::1]/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("rejects IPv4-mapped private IPv6 ::ffff:10.0.0.1", () => {
    const result = validateUrl("http://[::ffff:10.0.0.1]/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("rejects IPv4-mapped private IPv6 ::ffff:192.168.1.1", () => {
    const result = validateUrl("http://[::ffff:192.168.1.1]/path", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("private_network");
  });

  it("allows public IPs that are not reserved", () => {
    const publicConfig: SsrfGuardConfig = { ...DEFAULT_SSRF_CONFIG, approved_domains: ["example.com", "8.8.8.8"] };
    const result = validateUrl("http://8.8.8.8/path", publicConfig);
    expect(result.allowed).toBe(true);
  });

  it("allows 172.32.0.1 (just outside 172.16/12)", () => {
    const boundaryConfig: SsrfGuardConfig = { ...DEFAULT_SSRF_CONFIG, approved_domains: ["example.com", "172.32.0.1"] };
    const result = validateUrl("http://172.32.0.1/path", boundaryConfig);
    expect(result.allowed).toBe(true);
  });

  it("allows 100.63.255.255 (just below carrier-grade NAT)", () => {
    const boundaryConfig: SsrfGuardConfig = { ...DEFAULT_SSRF_CONFIG, approved_domains: ["example.com", "100.63.255.255"] };
    const result = validateUrl("http://100.63.255.255/path", boundaryConfig);
    expect(result.allowed).toBe(true);
  });
});

describe("SSRF guard — non-HTTP(S) rejection", () => {
  const config: SsrfGuardConfig = {
    ...DEFAULT_SSRF_CONFIG,
    approved_domains: ["example.com"],
  };

  it("rejects ftp://", () => {
    const result = validateUrl("ftp://example.com/file", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("non_http");
  });

  it("rejects file://", () => {
    const result = validateUrl("file:///etc/passwd", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("non_http");
  });

  it("rejects ssh://", () => {
    const result = validateUrl("ssh://example.com", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("non_http");
  });

  it("rejects gopher://", () => {
    const result = validateUrl("gopher://example.com:70", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("non_http");
  });

  it("rejects data:", () => {
    const result = validateUrl("data:text/html,<h1>hi</h1>", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("non_http");
  });

  it("rejects javascript:", () => {
    const result = validateUrl("javascript:alert(1)", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("non_http");
  });

  it("rejects unparseable URLs", () => {
    const result = validateUrl("not-a-url", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("non_http");
  });

  it("allows http://", () => {
    const result = validateUrl("http://example.com", config);
    expect(result.allowed).toBe(true);
  });

  it("allows https://", () => {
    const result = validateUrl("https://example.com", config);
    expect(result.allowed).toBe(true);
  });
});

describe("SSRF guard — approved-domain enforcement", () => {
  const config: SsrfGuardConfig = {
    ...DEFAULT_SSRF_CONFIG,
    approved_domains: ["example.com", "trusted.org"],
  };

  it("allows exact domain match", () => {
    const result = validateUrl("https://example.com/page", config);
    expect(result.allowed).toBe(true);
  });

  it("allows subdomain of approved domain", () => {
    const result = validateUrl("https://www.example.com/page", config);
    expect(result.allowed).toBe(true);
  });

  it("allows deep subdomain", () => {
    const result = validateUrl("https://cdn.images.example.com/assets", config);
    expect(result.allowed).toBe(true);
  });

  it("rejects domain that looks like approved but is not", () => {
    const result = validateUrl("https://evil-example.com/phish", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("domain_not_approved");
  });

  it("rejects approved-domain as subdomain of attacker domain", () => {
    const result = validateUrl("https://example.com.attacker.com/phish", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("domain_not_approved");
  });

  it("rejects completely unrelated domain", () => {
    const result = validateUrl("https://evil.com/steal", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("domain_not_approved");
  });

  it("allows second approved domain", () => {
    const result = validateUrl("https://trusted.org/page", config);
    expect(result.allowed).toBe(true);
  });

  it("rejects when no domains are configured", () => {
    const emptyConfig: SsrfGuardConfig = { ...DEFAULT_SSRF_CONFIG, approved_domains: [] };
    const result = validateUrl("https://example.com/page", emptyConfig);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("domain_not_approved");
  });

  it("is case-insensitive for domain matching", () => {
    const result = validateUrl("https://EXAMPLE.COM/page", config);
    expect(result.allowed).toBe(true);
  });
});

describe("SSRF guard — page limit enforcement", () => {
  const config: SsrfGuardConfig = {
    ...DEFAULT_SSRF_CONFIG,
    max_pages: 5,
  };

  it("allows fetch when within page budget", () => {
    const state: CrawlBudgetState = { pages_fetched: 3, text_chars_fetched: 0 };
    const result = checkCrawlBudget(state, config, 1, 0);
    expect(result.allowed).toBe(true);
  });

  it("allows fetch that exactly hits page budget", () => {
    const state: CrawlBudgetState = { pages_fetched: 4, text_chars_fetched: 0 };
    const result = checkCrawlBudget(state, config, 1, 0);
    expect(result.allowed).toBe(true);
  });

  it("rejects fetch that exceeds page budget", () => {
    const state: CrawlBudgetState = { pages_fetched: 5, text_chars_fetched: 0 };
    const result = checkCrawlBudget(state, config, 1, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("page_limit_exceeded");
  });

  it("rejects batch fetch that would exceed page budget", () => {
    const state: CrawlBudgetState = { pages_fetched: 4, text_chars_fetched: 0 };
    const result = checkCrawlBudget(state, config, 2, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("page_limit_exceeded");
  });

  it("allows when at zero pages fetched", () => {
    const state: CrawlBudgetState = { pages_fetched: 0, text_chars_fetched: 0 };
    const result = checkCrawlBudget(state, config, 1, 0);
    expect(result.allowed).toBe(true);
  });

  it("rejects when budget is zero and any fetch attempted", () => {
    const zeroConfig: SsrfGuardConfig = { ...DEFAULT_SSRF_CONFIG, max_pages: 0 };
    const state: CrawlBudgetState = { pages_fetched: 0, text_chars_fetched: 0 };
    const result = checkCrawlBudget(state, zeroConfig, 1, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("page_limit_exceeded");
  });
});

describe("SSRF guard — text size limit enforcement", () => {
  const config: SsrfGuardConfig = {
    ...DEFAULT_SSRF_CONFIG,
    max_text_chars: 1000,
  };

  it("allows fetch when within text budget", () => {
    const state: CrawlBudgetState = { pages_fetched: 0, text_chars_fetched: 500 };
    const result = checkCrawlBudget(state, config, 0, 400);
    expect(result.allowed).toBe(true);
  });

  it("allows fetch that exactly hits text budget", () => {
    const state: CrawlBudgetState = { pages_fetched: 0, text_chars_fetched: 900 };
    const result = checkCrawlBudget(state, config, 0, 100);
    expect(result.allowed).toBe(true);
  });

  it("rejects fetch that exceeds text budget", () => {
    const state: CrawlBudgetState = { pages_fetched: 0, text_chars_fetched: 900 };
    const result = checkCrawlBudget(state, config, 0, 200);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("text_limit_exceeded");
  });

  it("rejects when text budget is zero and any text added", () => {
    const zeroConfig: SsrfGuardConfig = { ...DEFAULT_SSRF_CONFIG, max_text_chars: 0 };
    const state: CrawlBudgetState = { pages_fetched: 0, text_chars_fetched: 0 };
    const result = checkCrawlBudget(state, zeroConfig, 0, 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("text_limit_exceeded");
  });

  it("checks page limit before text limit", () => {
    const state: CrawlBudgetState = { pages_fetched: 100, text_chars_fetched: 0 };
    const result = checkCrawlBudget(state, config, 1, 0);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("page_limit_exceeded");
  });
});

describe("SSRF guard — URL validation edge cases", () => {
  const config: SsrfGuardConfig = {
    ...DEFAULT_SSRF_CONFIG,
    approved_domains: ["example.com"],
  };

  it("preserves normalized URL in result", () => {
    const result = validateUrl("https://example.com/path?q=1#hash", config);
    expect(result.normalized_url).toBe("https://example.com/path?q=1#hash");
  });

  it("returns null normalized_url for unparseable URL", () => {
    const result = validateUrl("not-a-url", config);
    expect(result.normalized_url).toBeNull();
  });

  it("returns null normalized_url for non-HTTP protocol", () => {
    const result = validateUrl("ftp://example.com", config);
    expect(result.normalized_url).toBeNull();
  });

  it("rejects http to approved domain on localhost IP", () => {
    const result = validateUrl("http://example.com:12345@127.0.0.1/", config);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("localhost");
  });
});
