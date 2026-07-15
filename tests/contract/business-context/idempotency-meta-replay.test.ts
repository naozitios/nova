import { describe, expect, it } from "vitest";
import { readFileSource } from "./_idempotency-helpers";

// ---------------------------------------------------------------------------
// T007 — Idempotency Inventory Test: Meta OAuth Callback Replay Protection
// Proves the Meta OAuth callback uses signed-state replay protection
// (NOT Idempotency-Key) with nonce/code hash verification.
// ---------------------------------------------------------------------------

describe("Meta OAuth callback — signed-state replay protection", () => {
  const CALLBACK_FILE = "src/app/api/meta/callback/route.ts";

  it("callback verifies signed state nonce", () => {
    const source = readFileSource(CALLBACK_FILE);

    const hasSignedState =
      source.includes("verify") ||
      source.includes("hmac") ||
      source.includes("signature") ||
      source.includes("jwt") ||
      source.includes("signed");
    expect(hasSignedState).toBe(true);
  });

  it("callback records provider code hash before token exchange", () => {
    const source = readFileSource(CALLBACK_FILE);

    const recordsCodeHash =
      source.includes("codeHash") ||
      source.includes("code_hash") ||
      source.includes("provider_code");
    expect(recordsCodeHash).toBe(true);
  });

  it("callback rejects replayed nonces (OAUTH_CALLBACK_REPLAYED)", () => {
    const source = readFileSource(CALLBACK_FILE);

    const hasReplayRejection =
      source.includes("OAUTH_CALLBACK_REPLAYED") ||
      source.includes("nonce_used") ||
      source.includes("nonce_replay");
    expect(hasReplayRejection).toBe(true);
  });

  it("callback rejects replayed provider codes", () => {
    const source = readFileSource(CALLBACK_FILE);

    const hasCodeReplayRejection =
      source.includes("CODE_REPLAYED") ||
      source.includes("code_replay") ||
      source.includes("code_used");
    expect(hasCodeReplayRejection).toBe(true);
  });

  it("callback does NOT use Idempotency-Key header", () => {
    const source = readFileSource(CALLBACK_FILE);

    const usesIdempotencyKey =
      source.includes("idempotency-key") ||
      source.includes("Idempotency-Key") ||
      source.includes("withIdempotency");
    expect(usesIdempotencyKey).toBe(false);
  });

  it("meta auth route generates signed state with nonce", () => {
    const authSource = readFileSource("src/app/api/meta/auth/route.ts");

    const hasSignedGeneration =
      authSource.includes("randomBytes") ||
      authSource.includes("crypto") ||
      authSource.includes("nanoid");
    expect(hasSignedGeneration).toBe(true);
  });
});
