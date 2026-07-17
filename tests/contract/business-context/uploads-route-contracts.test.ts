import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// ---------------------------------------------------------------------------
// T07 — Route source-contract tests for upload routes
// Proves each route file exists and enforces structural invariants at the
// source level: exports, auth, validation, idempotency, response helpers,
// and security constraints.
// ---------------------------------------------------------------------------

function readFileSource(filePath: string): string {
  return readFileSync(join(process.cwd(), filePath), "utf-8");
}

const ROUTE_UPLOAD_CREATE =
  "src/app/api/businesses/[id]/context/uploads/route.ts";
const ROUTE_UPLOAD_PROPOSAL =
  "src/app/api/businesses/[id]/context/uploads/classification-proposals/route.ts";
const ROUTE_UPLOAD_COMPLETE =
  "src/app/api/businesses/[id]/context/uploads/[uploadId]/complete/route.ts";

// ─── Source-audit: pin exact OpenAPI schema strings (RED before fix) ───────

describe("openapi.yaml — source-audit schema strings", () => {
  const openapi = () =>
    readFileSource("specs/006.2-business-context-remediation/contracts/openapi.yaml");

  it("UploadIntent.document_class enum: brand_deck,product_document,research_document,campaign_brief,website_content,other", () => {
    expect(openapi()).toContain(
      "enum: [brand_deck, product_document, research_document, campaign_brief, website_content, other]"
    );
  });

  it("ClassificationProposal.document_class enum: brand_deck,product_document,research_document,campaign_brief,website_content,other", () => {
    // Both UploadIntent and ClassificationProposal use the same enum
    const count = (
      openapi().match(/enum: \[brand_deck, product_document, research_document, campaign_brief, website_content, other\]/g) ?? []
    ).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it("UploadCreate.document_class enum: brand_deck,product_document,research_document,campaign_brief,website_content,other", () => {
    // Count all occurrences of the corrected enum across all schemas
    const count = (
      openapi().match(/enum: \[brand_deck, product_document, research_document, campaign_brief, website_content, other\]/g) ?? []
    ).length;
    expect(count).toBe(3);
  });

  it("UploadIntent.source_type enum: [upload]", () => {
    expect(openapi()).toContain("source_type: { type: string, enum: [upload] }");
  });

  it("UploadIntent.status enum: pending,scanning,storing,processing,completed,failed,expired", () => {
    expect(openapi()).toContain(
      "enum: [pending, scanning, storing, processing, completed, failed, expired]"
    );
  });

  it("UploadIntent.malware_scan_status enum: pending,clean,infected,error,skipped", () => {
    expect(openapi()).toContain(
      "enum: [pending, clean, infected, error, skipped]"
    );
  });

  it("UploadIntent.malware_scan_code type: integer or null", () => {
    expect(openapi()).toContain(
      "malware_scan_code: { type: [integer, 'null'] }"
    );
  });

  it("UploadIntent.upload_url allows null: type [string, null] format uri", () => {
    expect(openapi()).toContain(
      "upload_url: { type: [string, 'null'], format: uri }"
    );
  });
});

describe("upload intent migration alignment", () => {
  const migration = () => readFileSource(
    "supabase/migrations/202607170002_upload_intent_status_alignment.sql",
  );

  it("aligns upload and malware status constraints with runtime enums", () => {
    expect(migration()).toContain("'pending', 'scanning', 'storing', 'processing', 'completed', 'failed', 'expired'");
    expect(migration()).toContain("'pending', 'clean', 'infected', 'error', 'skipped'");
  });

  it("stores sanitized malware scan codes as integers", () => {
    expect(migration()).toMatch(/alter column malware_scan_code type integer/i);
  });
});

// ─── File existence ─────────────────────────────────────────────────────────

describe("Upload routes — file existence", () => {
  it.each([
    ["uploads/route.ts", ROUTE_UPLOAD_CREATE],
    ["uploads/classification-proposals/route.ts", ROUTE_UPLOAD_PROPOSAL],
    ["uploads/[uploadId]/complete/route.ts", ROUTE_UPLOAD_COMPLETE],
  ])("%s exists", (_label, file) => {
    expect(() => readFileSource(file)).not.toThrow();
  });
});

// ─── uploads/route.ts — create upload intent ────────────────────────────────

describe("uploads/route.ts — source contract", () => {
  const source = () => readFileSource(ROUTE_UPLOAD_CREATE);

  it("exports async POST handler", () => {
    expect(source()).toMatch(/export\s+async\s+function\s+POST\s*\(/);
  });

  it("imports requireAuthz from _shared", () => {
    expect(source()).toMatch(/requireAuthz[\s\S]*from\s*['"]\.\.\/\.\.\/\.\.\/_shared['"]\/?/);
  });

  it("calls requireAuthz with editor role", () => {
    expect(source()).toMatch(/requireAuthz\s*\(\s*req\s*,\s*[^,]+,\s*['"]editor['"]\s*\)/);
  });

  it("imports withIdempotency from _shared", () => {
    expect(source()).toMatch(/withIdempotency[\s\S]*from\s*['"]\.\.\/\.\.\/\.\.\/_shared['"]\/?/);
  });

  it("wraps handler body in withIdempotency", () => {
    expect(source()).toMatch(/withIdempotency\s*\(\s*req\s*,\s*async\s*\(\)\s*=>\s*\{/);
  });

  it("imports and uses Zod for request validation", () => {
    expect(source()).toMatch(/import\s*\{[^}]*z[^}]*\}.*from\s*['"]zod['"]/);
    expect(source()).toMatch(/z\.object\s*\(\s*\{/);
  });

  it("validates body via validateWithSchema", () => {
    expect(source()).toMatch(/validateWithSchema\s*\(/);
  });

  it("gets UploadRepository from Container", () => {
    expect(source()).toMatch(/Container\.getUploadRepository\s*\(/);
  });

  it("gets UploadStorage from Container", () => {
    expect(source()).toMatch(/Container\.getUploadStorage\s*\(/);
  });

  it("calls createSignedUploadIntent service", () => {
    expect(source()).toMatch(/createSignedUploadIntent\s*\(/);
  });

  it("returns createdResponse on success", () => {
    expect(source()).toMatch(/createdResponse\s*\(/);
  });

  it("returns errorResponse on failure", () => {
    expect(source()).toMatch(/errorResponse\s*\(/);
  });

  it("does not expose service-role key to client", () => {
    expect(source()).not.toMatch(/service_role|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE/);
  });

  it("does not expose browser/client tokens", () => {
    expect(source()).not.toMatch(/supabaseKey|anon_key|ANON_KEY|sb-.*-auth\.supabase/);
  });
});

// ─── uploads/classification-proposals/route.ts ──────────────────────────────

describe("uploads/classification-proposals/route.ts — source contract", () => {
  const source = () => readFileSource(ROUTE_UPLOAD_PROPOSAL);

  it("exports async POST handler", () => {
    expect(source()).toMatch(/export\s+async\s+function\s+POST\s*\(/);
  });

  it("imports requireAuthz from _shared", () => {
    expect(source()).toMatch(/requireAuthz[\s\S]*from\s*['"]\.\.\/\.\.\/\.\.\/\.\.\/_shared['"]\/?/);
  });

  it("calls requireAuthz with editor role", () => {
    expect(source()).toMatch(/requireAuthz\s*\(\s*req\s*,\s*[^,]+,\s*['"]editor['"]\s*\)/);
  });

  it("imports and uses Zod for request validation", () => {
    expect(source()).toMatch(/import\s*\{[^}]*z[^}]*\}.*from\s*['"]zod['"]/);
    expect(source()).toMatch(/z\.object\s*\(\s*\{/);
  });

  it("validates body via validateWithSchema", () => {
    expect(source()).toMatch(/validateWithSchema\s*\(/);
  });

  it("creates classification proposal from server-controlled workspace/business", () => {
    expect(source()).toMatch(/createClassificationProposal\s*\(/);
    expect(source()).toMatch(/workspaceId\s*:/);
    expect(source()).toMatch(/businessId\s*:/);
  });

  it("does not trust client system_proposed field", () => {
    expect(source()).not.toMatch(/system_proposed.*z\./);
    expect(source()).not.toMatch(/classificationSource\s*:\s*z\./);
  });

  it("does not use withIdempotency (read-oriented, idempotent by nature)", () => {
    expect(source()).not.toMatch(/withIdempotency\s*\(/);
  });

  it("returns jsonResponse (not createdResponse)", () => {
    expect(source()).toMatch(/jsonResponse\s*\(/);
  });

  it("returns errorResponse on failure", () => {
    expect(source()).toMatch(/errorResponse\s*\(/);
  });

  it("does not expose service-role key to client", () => {
    expect(source()).not.toMatch(/service_role|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE/);
  });

  it("does not expose browser/client tokens", () => {
    expect(source()).not.toMatch(/supabaseKey|anon_key|ANON_KEY|sb-.*-auth\.supabase/);
  });
});

// ─── uploads/[uploadId]/complete/route.ts — completion ──────────────────────

describe("uploads/[uploadId]/complete/route.ts — source contract", () => {
  const source = () => readFileSource(ROUTE_UPLOAD_COMPLETE);

  it("exports async POST handler", () => {
    expect(source()).toMatch(/export\s+async\s+function\s+POST\s*\(/);
  });

  it("imports requireAuthz from _shared", () => {
    expect(source()).toMatch(/requireAuthz[\s\S]*from\s*['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/_shared['"]\/?/);
  });

  it("calls requireAuthz with editor role", () => {
    expect(source()).toMatch(/requireAuthz\s*\(\s*req\s*,\s*[^,]+,\s*['"]editor['"]\s*\)/);
  });

  it("imports withIdempotency from _shared", () => {
    expect(source()).toMatch(/withIdempotency[\s\S]*from\s*['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/_shared['"]\/?/);
  });

  it("wraps handler body in withIdempotency", () => {
    expect(source()).toMatch(/withIdempotency\s*\(\s*req\s*,\s*async\s*\(\)\s*=>\s*\{/);
  });

  it("imports and uses Zod for request validation", () => {
    expect(source()).toMatch(/import\s*\{[^}]*z[^}]*\}.*from\s*['"]zod['"]/);
    expect(source()).toMatch(/z\.object\s*\(\s*\{/);
  });

  it("validates body via validateWithSchema", () => {
    expect(source()).toMatch(/validateWithSchema\s*\(/);
  });

  it("calls completeUploadIntent service", () => {
    expect(source()).toMatch(/completeUploadIntent\s*\(/);
  });

  it("returns 202 Accepted via jsonResponse with status param", () => {
    expect(source()).toMatch(/202\s*\)/);
  });

  it("returns errorResponse on failure", () => {
    expect(source()).toMatch(/errorResponse\s*\(/);
  });

  it("does not expose service-role key to client", () => {
    expect(source()).not.toMatch(/service_role|SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE/);
  });

  it("does not expose browser/client tokens", () => {
    expect(source()).not.toMatch(/supabaseKey|anon_key|ANON_KEY|sb-.*-auth\.supabase/);
  });
});
