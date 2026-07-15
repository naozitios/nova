import { describe, expect, it } from "vitest";
import {
  canRun,
  getClient,
  track,
  cleanup,
  TEST_WORKSPACE,
  TEST_BUSINESS,
  TEST_USER,
} from "./supabase-helpers";

// ── Profile versions ───────────────────────────────────────────────────────

describe.skipIf(!canRun)("Repository — business_profile_versions", () => {
  it("creates a draft profile version", async () => {
    const client = getClient();
    const versionId = crypto.randomUUID();
    track("business_profile_versions", versionId);

    const { error: insertError } = await client
      .from("business_profile_versions")
      .insert({
        id: versionId,
        workspace_id: TEST_WORKSPACE,
        business_id: TEST_BUSINESS,
        version: 1,
        profile: { business: {}, offers: {} },
        status: "draft",
        created_by: TEST_USER,
      });
    expect(insertError).toBeNull();

    const { data, error: readError } = await client
      .from("business_profile_versions")
      .select("*")
      .eq("id", versionId)
      .single();

    expect(readError).toBeNull();
    expect(data!.version).toBe(1);
    expect(data!.status).toBe("draft");

    await cleanup("business_profile_versions", versionId);
  });
});
