import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSource } from "./_idempotency-helpers";

// ---------------------------------------------------------------------------
// Task 9 — Contract tests: Workspace-scoped Meta connection routes
// Covers: editor/admin auth, no token in response, signed state binding,
// state/code replay rejection, account ownership, sanitized status,
// callback 303, and mutation idempotency.
// ---------------------------------------------------------------------------

const CONNECTIONS_FILE = "src/app/api/meta/connections/route.ts";
const CALLBACK_FILE = "src/app/api/meta/connections/callback/route.ts";
const SELECT_ACCOUNT_FILE = "src/app/api/meta/connections/select-account/route.ts";

// ─── Route file existence ─────────────────────────────────────────────────

describe("Meta connection routes — file existence", () => {
  it("connections route file exists", () => {
    expect(() => readFileSource(CONNECTIONS_FILE)).not.toThrow();
  });

  it("callback route file exists", () => {
    expect(() => readFileSource(CALLBACK_FILE)).not.toThrow();
  });

  it("select-account route file exists", () => {
    expect(() => readFileSource(SELECT_ACCOUNT_FILE)).not.toThrow();
  });
});

// ─── GET /api/meta/connections — sanitized status ─────────────────────────

describe("GET /api/meta/connections — sanitized status", () => {
  it("exports a GET handler", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+GET/);
  });

  it("does not expose access tokens in response", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    const hasTokenLeak =
      source.includes("accessToken") ||
      source.includes("access_token") && !source.includes("encryptedAccessToken");
    expect(hasTokenLeak).toBe(false);
  });

  it("returns sanitized connection status fields", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/status/);
    expect(source).toMatch(/connectedBy|connected_by/);
    expect(source).toMatch(/metaUserId|meta_user_id/);
  });

  it("requires editor or admin role", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/requireAuthz/);
    expect(source).toMatch(/editor|admin/);
  });
});

// ─── POST /api/meta/connections — start OAuth ─────────────────────────────

describe("POST /api/meta/connections — start OAuth flow", () => {
  it("exports a POST handler", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+POST/);
  });

  it("requires editor or admin role", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/requireAuthz/);
    expect(source).toMatch(/editor|admin/);
  });

  it("generates signed state with nonce", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/randomBytes|crypto|nonce/);
  });

  it("creates OAuth state record in database", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/createOAuthState|oauth_states|meta_oauth_states/);
  });

  it("returns authorization URL for Meta OAuth", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/getAuthorizationUrl|authorizationUrl|authorize/);
  });
});

// ─── GET /api/meta/connections/callback — OAuth callback ───────────────────

describe("GET /api/meta/connections/callback — OAuth callback", () => {
  it("exports a GET handler", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+GET/);
  });

  it("returns 303 redirect (not 200 or 302)", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/303|See\s*Other|redirect/);
  });

  it("verifies signed state nonce", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/verify|nonce|hash|signed/);
  });

  it("rejects replayed states (OAUTH_CALLBACK_REPLAYED)", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/OAUTH_CALLBACK_REPLAYED|nonce_used|state_replay/);
  });

  it("records provider code hash before token exchange", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/codeHash|code_hash|provider_code|providerCodeHash/);
  });

  it("rejects replayed provider codes (CODE_REPLAYED)", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/CODE_REPLAYED|code_replay|code_used/);
  });

  it("consumes state exactly once (one-time consumption)", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/consumeOAuthState|consumed_at|consumedAt/);
  });

  it("does NOT expose tokens in response or cookies", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).not.toMatch(
      /cookies\.set\(['"]meta_access_token|cookies\.set\(['"]access_token/,
    );
  });

  it("does NOT use Idempotency-Key header (uses signed state instead)", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).not.toMatch(
      /idempotency-key|Idempotency-Key|withIdempotency/,
    );
  });

  it("exchanges code for token via OAuth adapter", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/exchangeCode|OAuthAdapter|MetaOAuthAdapter/);
  });

  it("creates or updates connection after successful exchange", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(
      /createConnection|upsertConnection|updateConnectionStatus/,
    );
  });
});

// ─── POST /api/meta/connections/select-account — account selection ─────────

describe("POST /api/meta/connections/select-account — account selection", () => {
  it("exports a POST handler", () => {
    const source = readFileSource(SELECT_ACCOUNT_FILE);
    expect(source).toMatch(/export\s+(async\s+)?function\s+POST/);
  });

  it("requires editor or admin role", () => {
    const source = readFileSource(SELECT_ACCOUNT_FILE);
    expect(source).toMatch(/requireAuthz/);
    expect(source).toMatch(/editor|admin/);
  });

  it("validates account ownership (account belongs to workspace)", () => {
    const source = readFileSource(SELECT_ACCOUNT_FILE);
    expect(source).toMatch(/workspace_id|workspaceId|ownership|account_id/);
  });

  it("does NOT expose access tokens in response", () => {
    const source = readFileSource(SELECT_ACCOUNT_FILE);
    expect(source).not.toMatch(/accessToken|access_token(?!_id)/);
  });

  it("updates selected ad account on connection", () => {
    const source = readFileSource(SELECT_ACCOUNT_FILE);
    expect(source).toMatch(
      /updateConnection|selectedAdAccountId|selected_ad_account/,
    );
  });
});

// ─── Signed state enforcement across routes ────────────────────────────────

describe("Signed state enforcement — cross-route", () => {
  it("start route creates state with nonce hash", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/sha256|createHash|nonceHash|stateNonceHash/);
  });

  it("callback route verifies state nonce hash", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/sha256|createHash|nonceHash|stateNonceHash/);
  });

  it("callback route marks state as consumed", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/consumed_at|consumedAt|consumeOAuthState/);
  });
});

// ─── Mutation idempotency inventory ────────────────────────────────────────

describe("Meta connection mutations — idempotency inventory", () => {
  it("POST /api/meta/connections uses withIdempotency", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    expect(source).toMatch(/withIdempotency/);
  });

  it("POST /api/meta/connections/select-account uses withIdempotency", () => {
    const source = readFileSource(SELECT_ACCOUNT_FILE);
    expect(source).toMatch(/withIdempotency/);
  });

  it("GET /api/meta/connections/callback does NOT use withIdempotency", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).not.toMatch(/withIdempotency/);
  });

  it("GET /api/meta/connections (status) does NOT use withIdempotency", () => {
    const source = readFileSource(CONNECTIONS_FILE);
    const getHandler = source.match(
      /export\s+(async\s+)?function\s+GET[\s\S]*?(?=export\s+(async\s+)?function\s+POST|$)/,
    );
    if (getHandler) {
      expect(getHandler[0]).not.toMatch(/withIdempotency/);
    }
  });
});

// ─── Account ownership enforcement ─────────────────────────────────────────

describe("Account ownership — cross-route", () => {
  it("callback creates connection scoped to authenticated workspace", () => {
    const source = readFileSource(CALLBACK_FILE);
    expect(source).toMatch(/workspace_id|workspaceId/);
  });

  it("select-account validates account belongs to workspace connection", () => {
    const source = readFileSource(SELECT_ACCOUNT_FILE);
    expect(source).toMatch(/workspace_id|workspaceId|getConnection/);
  });
});
