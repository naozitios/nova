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

  it("instantiates UploadRepository from infrastructure", () => {
    expect(source()).toMatch(/new\s+UploadRepository\s*\(/);
  });

  it("instantiates SupabaseUploadStorage from infrastructure", () => {
    expect(source()).toMatch(/new\s+SupabaseUploadStorage\s*\(/);
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
    expect(source()).toMatch(/requireAuthz[\s\S]*from\s*['"]\.\.\/\.\.\/\.\.\/_shared['"]\/?/);
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
