import { randomUUID } from "node:crypto";
import { getSupabaseTestEnv } from "./supabase-test-env";

export const TEST_WORKSPACE_A = "00000000-0000-0000-0000-000000000001";
export const TEST_WORKSPACE_B = "00000000-0000-0000-0000-000000000002";

export const TEST_USERS = {
  wsAOwner: "00000000-0000-0000-0000-000000000003",
  wsAAdmin: "00000000-0000-0000-0000-000000000004",
  wsAEditor: "00000000-0000-0000-0000-000000000005",
  wsAViewer: "00000000-0000-0000-0000-000000000006",
  wsBEditor: "00000000-0000-0000-0000-000000000007",
  wsBViewer: "00000000-0000-0000-0000-000000000008",
};

export interface CleanupTracker {
  track: (table: string, id: string) => void;
  flush: () => Promise<void>;
}

export function createCleanupTracker(): CleanupTracker {
  const items: Array<{ table: string; id: string }> = [];
  return {
    track(table, id) {
      items.push({ table, id });
    },
    async flush() {
      const env = getSupabaseTestEnv();
      if (!env.available) return;
      for (const { table, id } of [...items].reverse()) {
        await env.serviceClient.from(table).delete().eq("id", id);
      }
      items.length = 0;
    },
  };
}

export async function seedWorkspaces(): Promise<void> {
  const env = getSupabaseTestEnv();
  if (!env.available) return;
  await env.serviceClient.from("workspaces").upsert([
    { id: TEST_WORKSPACE_A, name: "Workspace A" },
    { id: TEST_WORKSPACE_B, name: "Workspace B" },
  ]);
}

export async function seedMembers(): Promise<void> {
  const env = getSupabaseTestEnv();
  if (!env.available) return;
  await env.serviceClient.from("workspace_members").upsert([
    { workspace_id: TEST_WORKSPACE_A, user_id: TEST_USERS.wsAOwner, role: "owner" },
    { workspace_id: TEST_WORKSPACE_A, user_id: TEST_USERS.wsAAdmin, role: "admin" },
    { workspace_id: TEST_WORKSPACE_A, user_id: TEST_USERS.wsAEditor, role: "editor" },
    { workspace_id: TEST_WORKSPACE_A, user_id: TEST_USERS.wsAViewer, role: "viewer" },
    { workspace_id: TEST_WORKSPACE_B, user_id: TEST_USERS.wsBEditor, role: "editor" },
    { workspace_id: TEST_WORKSPACE_B, user_id: TEST_USERS.wsBViewer, role: "viewer" },
  ]);
}

export function newId(): string {
  return randomUUID();
}
