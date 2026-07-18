import { describe, expect, it } from "vitest";
import { readFileSource } from "../business-context/_idempotency-helpers";

// ---------------------------------------------------------------------------
// Task 5 — Contract tests: Meta OAuth start/callback routes
// Covers: file existence, auth, state signing, callback flow, no token leak,
// and adapter API-version config.
// ---------------------------------------------------------------------------

const START_FILE = "src/app/api/meta/oauth/start/route.ts";
const CALLBACK_FILE = "src/app/api/meta/oauth/callback/route.ts";
const ADAPTER_FILE = "src/infrastructure/meta/meta-oauth.adapter.ts";
const CONNECTIONS_FILE = "src/app/api/meta/connections/route.ts";

// ─── Route file existence ─────────────────────────────────────────────────

describe("Meta OAuth routes — file existence", () => {
  it("start route file exists", () => {
    expect(() => readFileSource(START_FILE)).not.toThrow();
  });

  it("callback route file exists", () => {
    expect(() => readFileSource(CALLBACK_FILE)).not.toThrow();
  });
});

// ─── POST /api/meta/oauth/start — initiate OAuth ──────────────────────────

describe("POST /api/meta/oauth/start — initiate OAuth", () => {
  it("exports a POST handler", () => {
    const source = readFileSource(START_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+POST/);
  });

  it("requires editor or admin role via requireAuthz", () => {
    const source = readFileSource(START_FILE);
    expect(source).toMatch(/requireAuthz/);
    expect(source).toMatch(/editor|admin/);
  });

  it("creates OAuth state via createOAuthState", () => {
    const source = readFileSource(START_FILE);
    expect(source).toMatch(/createOAuthState/);
  });

  it("returns authorization_url in response", () => {
    const source = readFileSource(START_FILE);
    expect(source).toMatch(/authorization_url/);
  });

  it("returns state_id in response", () => {
    const source = readFileSource(START_FILE);
    expect(source).toMatch(/state_id/);
  });

  it("returns expires_at in response", () => {
    const source = readFileSource(START_FILE);
    expect(source).toMatch(/expires_at/);
  });

  it("signs state with encodeMetaOAuthState or hashMetaOAuthNonce", () => {
    const source = readFileSource(START_FILE);
    const usesEncode = source.includes("encodeMetaOAuthState");
    const usesHash = source.includes("hashMetaOAuthNonce") || source.includes("nonce");
    expect(usesEncode || usesHash).toBe(true);
  });
});

// ─── GET /api/meta/oauth/callback — OAuth callback ────────────────────────

describe("GET /api/meta/oauth/callback — OAuth callback", () => {
  it("exports a GET handler", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+GET/);
  });

  it("returns 303 redirect", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/303|See\s*Other/);
  });

  it("decodes state via decodeMetaOAuthState", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/decodeMetaOAuthState/);
  });

  it("verifies nonce via hashMetaOAuthNonce", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/hashMetaOAuthNonce/);
  });

  it("consumes state via consumeOAuthState", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/consumeOAuthState/);
  });

  it("exchanges code via exchangeCode", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/exchangeCode/);
  });

  it("stores token via MetaTokenVault or token vault", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/MetaTokenVault|tokenVault|token_vault|TokenVault/);
  });

  it("upserts connection via upsertConnection", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/upsertConnection/);
  });

  it("does NOT set meta_access_token cookie", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).not.toMatch(/cookies\.set\(['"]meta_access_token/);
  });

  it("does NOT set access_token cookie", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).not.toMatch(/cookies\.set\(['"]access_token/);
  });
});

// ─── Meta OAuth adapter — API version config ──────────────────────────────

describe("Meta OAuth adapter — API version config", () => {
  it("uses config.meta.apiVersion, not hardcoded v22.0", () => {
    const source = readFileSource(ADAPTER_FILE);
    // Should reference config for version
    expect(source).toMatch(/config\.meta\.apiVersion/);
    // Should NOT hard-code v22.0 in URL construction
    const hardcoded = source.match(/v22\.0/g);
    expect(hardcoded).toBeNull();
  });

  it("does NOT call getDefaultAdAccount or fetch with limit=1", () => {
    const source = readFileSource(ADAPTER_FILE);
    expect(source).not.toMatch(/getDefaultAdAccount/);
    expect(source).not.toMatch(/limit=1/);
  });
});

// ─── DELETE /api/meta/connections — disconnect ──────────────────────────────

describe("DELETE /api/meta/connections — disconnect", () => {
  it("exports a DELETE handler", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+DELETE/);
  });

  it("requires editor or admin role via requireAuthz", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    // The DELETE handler uses requireAuthz with editor role
    const deleteBlock = source.slice(source.indexOf("export async function DELETE"));
    expect(deleteBlock).toMatch(/requireAuthz/);
    expect(deleteBlock).toMatch(/editor|admin/);
  });

  it("uses Container for repository access (no new SupabaseMetaRepository)", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).not.toMatch(/new\s+SupabaseMetaRepository/);
    const deleteBlock = source.slice(source.indexOf("export async function DELETE"));
    expect(deleteBlock).toMatch(/Container/);
  });

  it("calls disconnectConnection on the repository", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/disconnectConnection/);
  });

  it("returns 404 when no active connection found", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    const deleteBlock = source.slice(source.indexOf("export async function DELETE"));
    expect(deleteBlock).toMatch(/404|NOT_FOUND/);
  });

  it("does NOT return encrypted_access_token in response", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    const deleteBlock = source.slice(source.indexOf("export async function DELETE"));
    expect(deleteBlock).not.toMatch(/encrypted_access_token/);
  });
});
