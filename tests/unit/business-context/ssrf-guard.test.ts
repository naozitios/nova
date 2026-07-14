import { describe, expect, it } from "vitest";
import {
  validateUrl,
  checkCrawlBudget,
  isLocalhost,
  isPrivateNetwork,
  isHttpOrHttps,
  isDomainApproved,
  parseUrl,
  DEFAULT_SSRF_CONFIG,
  type SsrfGuardConfig,
} from "@/infrastructure/business-context/ssrf-guard";

const cfg: SsrfGuardConfig = {
  ...DEFAULT_SSRF_CONFIG,
  approved_domains: ["acme.example.com", "vendor.partner.io"],
  max_pages: 5,
  max_text_chars: 1000,
};

describe("isHttpOrHttps", () => {
  it("accepts http", () => {
    expect(isHttpOrHttps("http:")).toBe(true);
  });
  it("accepts https", () => {
    expect(isHttpOrHttps("https:")).toBe(true);
  });
  it("rejects file", () => {
    expect(isHttpOrHttps("file:")).toBe(false);
  });
});

describe("isLocalhost", () => {
  it("detects localhost hostname", () => {
    expect(isLocalhost("localhost")).toBe(true);
  });
  it("detects loopback v4", () => {
    expect(isLocalhost("127.0.0.1")).toBe(true);
  });
  it("does not match public host", () => {
    expect(isLocalhost("acme.example.com")).toBe(false);
  });
});

describe("isPrivateNetwork", () => {
  it("detects 10.0.0.0/8", () => {
    expect(isPrivateNetwork("10.0.0.5")).toBe(true);
  });
  it("detects 192.168.0.0/16", () => {
    expect(isPrivateNetwork("192.168.1.1")).toBe(true);
  });
  it("detects 172.16.0.0/12", () => {
    expect(isPrivateNetwork("172.16.0.1")).toBe(true);
  });
  it("allows public address", () => {
    expect(isPrivateNetwork("8.8.8.8")).toBe(false);
  });
});

describe("isDomainApproved", () => {
  it("approves exact match", () => {
    expect(isDomainApproved("acme.example.com", ["acme.example.com"])).toBe(true);
  });
  it("approves subdomain", () => {
    expect(isDomainApproved("blog.acme.example.com", ["acme.example.com"])).toBe(true);
  });
  it("rejects unlisted", () => {
    expect(isDomainApproved("other.com", ["acme.example.com"])).toBe(false);
  });
});

describe("parseUrl", () => {
  it("parses a valid URL", () => {
    expect(parseUrl("https://acme.example.com/x")?.hostname).toBe("acme.example.com");
  });
  it("returns null for invalid", () => {
    expect(parseUrl("not a url")).toBeNull();
  });
});

describe("validateUrl", () => {
  it("allows approved https host", () => {
    const r = validateUrl("https://acme.example.com/about", cfg);
    expect(r.allowed).toBe(true);
    expect(r.normalized_url).toBe("https://acme.example.com/about");
  });

  it("allows subdomain of approved domain", () => {
    const r = validateUrl("https://blog.acme.example.com", cfg);
    expect(r.allowed).toBe(true);
  });

  it("rejects unapproved domain", () => {
    const r = validateUrl("https://other.com", cfg);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("domain_not_approved");
  });

  it("rejects localhost", () => {
    const r = validateUrl("http://localhost:3000/admin", cfg);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("localhost");
  });

  it("rejects private IP", () => {
    const r = validateUrl("http://10.0.0.5/secret", cfg);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("private_network");
  });

  it("rejects non-http schemes", () => {
    const r = validateUrl("file:///etc/passwd", cfg);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("non_http");
  });

  it("rejects unparseable URL", () => {
    const r = validateUrl("not a url", cfg);
    expect(r.allowed).toBe(false);
  });
});

describe("checkCrawlBudget", () => {
  it("returns allowed when under limits", () => {
    const r = checkCrawlBudget({ pages_fetched: 1, text_chars_fetched: 500 }, cfg, 1, 100);
    expect(r.allowed).toBe(true);
  });

  it("rejects when page limit exceeded by additional pages", () => {
    const r = checkCrawlBudget({ pages_fetched: 3, text_chars_fetched: 100 }, cfg, 3, 0);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("page_limit_exceeded");
  });

  it("rejects when text limit exceeded by additional chars", () => {
    const r = checkCrawlBudget({ pages_fetched: 1, text_chars_fetched: 0 }, cfg, 1, 2000);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("text_limit_exceeded");
  });
});
