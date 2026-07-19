import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseTestEnv } from "./supabase-test-env";

export function authedClient(accessToken: string): SupabaseClient {
  const env = getSupabaseTestEnv();
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function mintLocalAccessToken(userId: string): string {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error("SUPABASE_JWT_SECRET is not set; required for RLS auth tests");
  }
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
  };
  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${enc(header)}.${enc(payload)}`)
    .digest("base64url");
  return `${enc(header)}.${enc(payload)}.${signature}`;
}
