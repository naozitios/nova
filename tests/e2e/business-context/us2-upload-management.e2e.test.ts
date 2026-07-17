/**
 * US2 upload-management E2E.
 * Real HTTP + Supabase Storage + ClamAV + worker path; service role only seeds/inspects.
 */

import { createHash } from "node:crypto";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  authenticatedFetch,
  cleanup,
  createTestSession,
  createTestUser,
  getRandomPort,
  pollForCondition,
  resetDatabase,
  startApp,
  startScanner,
  startWorker,
  waitScannerHealthy,
} from "./harness";
import {
  eicarFixture,
  docxFixture,
  emptyFixture,
  executableFixture,
  htmlFixture,
  legacyDocFixture,
  malformedFixture,
  pdfFixture,
  pptxFixture,
  textFixture,
  type UploadFixture,
  xlsxFixture,
} from "../../fixtures/business-context/uploads/fixtures";

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_KEY ?? "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const hasDeps = !!supabaseServiceKey && !!supabaseAnonKey;

function svc(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

function sha256(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function storagePath(workspaceId: string, businessId: string, uploadId: string, fileName: string): string {
  return `workspaces/${workspaceId}/businesses/${businessId}/uploads/${uploadId}/${fileName.toLowerCase()}`;
}

describe.skipIf(!hasDeps)("US2 — upload management E2E", () => {
  let port: number;
  let wsId: string;
  let bizId: string;
  let editorCookie: string;
  let viewerCookie: string;
  let counter = 0;
  const uploadedPaths: string[] = [];

  beforeAll(async () => {
    process.env.UPLOAD_SIGNING_SECRET = process.env.UPLOAD_SIGNING_SECRET ?? "e2e-upload-signing-secret";
    process.env.UPLOAD_STORAGE_BUCKET = process.env.UPLOAD_STORAGE_BUCKET ?? "business-context-sources";
    process.env.CLAMAV_HOST = process.env.CLAMAV_HOST ?? "localhost";
    process.env.CLAMAV_PORT = process.env.CLAMAV_PORT ?? "3310";

    await resetDatabase();
    await startScanner();
    await waitScannerHealthy(120_000);

    const client = svc();
    wsId = crypto.randomUUID();
    bizId = crypto.randomUUID();

    const { error: wsErr } = await client.from("workspaces").upsert({
      id: wsId,
      name: "US2 Upload E2E Workspace",
    });
    if (wsErr) throw new Error(`seed workspace: ${wsErr.message}`);

    const { error: bizErr } = await client.from("businesses").upsert({
      id: bizId,
      workspace_id: wsId,
      name: "US2 Upload E2E Business",
    });
    if (bizErr) throw new Error(`seed business: ${bizErr.message}`);

    const editor = await createTestUser({
      email: `us2-upload-editor-${Date.now()}@e2e.test`,
      workspaceId: wsId,
      membershipRole: "editor",
    });
    editorCookie = await createTestSession({ userId: editor.id, workspaceId: wsId, role: "editor" });

    const viewer = await createTestUser({
      email: `us2-upload-viewer-${Date.now()}@e2e.test`,
      workspaceId: wsId,
      membershipRole: "viewer",
    });
    viewerCookie = await createTestSession({ userId: viewer.id, workspaceId: wsId, role: "viewer" });

    port = getRandomPort();
    await startApp(port);
    await startWorker(getRandomPort());
  }, 180_000);

  afterAll(async () => {
    if (uploadedPaths.length > 0) {
      await svc()
        .storage
        .from(process.env.UPLOAD_STORAGE_BUCKET ?? "business-context-sources")
        .remove(uploadedPaths);
    }
    await cleanup();
  });

  const base = () => `http://localhost:${port}`;
  const idem = (label: string) => `us2-${label}-${Date.now()}-${++counter}`;

  async function createUpload(
    fixture: UploadFixture,
    overrides: Record<string, unknown> = {},
    opts: { useProposal?: boolean } = { useProposal: true },
  ) {
    const proposalRes = await authenticatedFetch(
      `${base()}/api/businesses/${bizId}/context/uploads/classification-proposals`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_name: fixture.sourceName,
          file_name: fixture.fileName,
          mime_type: fixture.mimeType,
        }),
        authToken: editorCookie,
      },
    );
    expect(proposalRes.status, await proposalRes.clone().text()).toBe(200);
    const proposal = await proposalRes.json();

    const intentRes = await authenticatedFetch(
      `${base()}/api/businesses/${bizId}/context/uploads`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idem("intent"),
        },
        body: JSON.stringify({
          source_type: "upload",
          source_name: fixture.sourceName,
          file_name: fixture.fileName,
          mime_type: fixture.mimeType,
          size_bytes: fixture.content.length,
          ...(opts.useProposal
            ? { classification_proposal_token: proposal.proposal_token }
            : { document_class: "other" }),
          ...overrides,
        }),
        authToken: editorCookie,
      },
    );
    expect(intentRes.status, await intentRes.clone().text()).toBe(201);
    const intent = await intentRes.json();
    expect(intent.upload_url).toEqual(expect.any(String));
    return intent as { id: string; upload_url: string };
  }

  async function postUploadIntent(body: Record<string, unknown>) {
    return authenticatedFetch(`${base()}/api/businesses/${bizId}/context/uploads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idem("intent"),
      },
      body: JSON.stringify(body),
      authToken: editorCookie,
    });
  }

  async function putSignedObject(uploadUrl: string, fixture: UploadFixture): Promise<void> {
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": fixture.mimeType },
      body: new Uint8Array(fixture.content),
    });
    expect(putRes.ok, `PUT signed upload_url -> ${putRes.status}: ${await putRes.text()}`).toBe(true);
  }

  async function completeUpload(uploadId: string, fixture: UploadFixture) {
    const completeRes = await authenticatedFetch(
      `${base()}/api/businesses/${bizId}/context/uploads/${uploadId}/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idem("complete"),
        },
        body: JSON.stringify({
          storage_path: storagePath(wsId, bizId, uploadId, fixture.fileName),
          checksum_sha256: sha256(fixture.content),
        }),
        authToken: editorCookie,
      },
    );
    const body = await completeRes.json();
    if (completeRes.status === 202) {
      uploadedPaths.push(storagePath(wsId, bizId, uploadId, fixture.fileName));
    }
    return { status: completeRes.status, body };
  }

  async function countDocumentsForSource(sourceId: string): Promise<number> {
    const { count, error } = await svc()
      .from("source_documents")
      .select("id", { count: "exact", head: true })
      .eq("source_id", sourceId);
    if (error) throw error;
    return count ?? 0;
  }

  async function countFactsForBusiness(): Promise<number> {
    const { count, error } = await svc()
      .from("context_facts")
      .select("id", { count: "exact", head: true })
      .eq("business_id", bizId);
    if (error) throw error;
    return count ?? 0;
  }

  it("uploads clean text through signed Storage, completes, and worker records source history", { timeout: 120_000 }, async () => {
    const intent = await createUpload(textFixture);
    await putSignedObject(intent.upload_url, textFixture);

    const completed = await completeUpload(intent.id, textFixture);
    expect(completed.status, JSON.stringify(completed.body)).toBe(202);
    expect(completed.body.upload).toMatchObject({
      id: intent.id,
      status: "completed",
      malware_scan_status: "clean",
      malware_scan_code: 0,
    });
    expect(completed.body.source.id).toEqual(expect.any(String));
    expect(completed.body.job.id).toEqual(expect.any(String));

    const sourceId = completed.body.source.id as string;
    await pollForCondition(async () => {
      const { data } = await svc()
        .from("context_sources")
        .select("status, terminal_outcome")
        .eq("id", sourceId)
        .single();
      return data?.status === "processed" || data?.status === "processed_with_warnings" ? data : null;
    }, 120_000, 1_000);

    expect(await countDocumentsForSource(sourceId)).toBeGreaterThanOrEqual(1);

    const { data: runs, error: runErr } = await svc()
      .from("context_processing_runs")
      .select("id, status, current_stage")
      .eq("source_id", sourceId);
    if (runErr) throw runErr;
    expect(runs.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects mismatched MIME content and creates zero facts", { timeout: 60_000 }, async () => {
    const intent = await createUpload(
      textFixture,
      { mime_type: "application/pdf", file_name: "fake.pdf" },
      { useProposal: false },
    );
    const mismatched = { ...textFixture, fileName: "fake.pdf", mimeType: "application/pdf" };
    await putSignedObject(intent.upload_url, mismatched);

    const before = await countFactsForBusiness();
    const completed = await completeUpload(intent.id, mismatched);
    expect(completed.status, JSON.stringify(completed.body)).toBe(400);
    expect(completed.body.error.code).toBe("MIME_MISMATCH");
    expect(await countFactsForBusiness()).toBe(before);
  });

  it("accepts supported text, HTML, PDF, DOCX, PPTX, and XLSX signatures", { timeout: 120_000 }, async () => {
    for (const fixture of [htmlFixture, pdfFixture, docxFixture, pptxFixture, xlsxFixture]) {
      const intent = await createUpload(fixture);
      await putSignedObject(intent.upload_url, fixture);

      const completed = await completeUpload(intent.id, fixture);
      expect(completed.status, `${fixture.fileName}: ${JSON.stringify(completed.body)}`).toBe(202);
      expect(completed.body.upload).toMatchObject({
        id: intent.id,
        status: "completed",
        malware_scan_status: "clean",
      });
      expect(await countDocumentsForSource(completed.body.source.id as string)).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejects empty and oversized upload metadata before signed Storage write", { timeout: 30_000 }, async () => {
    const emptyRes = await postUploadIntent({
      source_type: "upload",
      source_name: emptyFixture.sourceName,
      document_class: "other",
      file_name: emptyFixture.fileName,
      mime_type: emptyFixture.mimeType,
      size_bytes: emptyFixture.content.length,
    });
    expect(emptyRes.status).toBe(400);

    const oversizedRes = await postUploadIntent({
      source_type: "upload",
      source_name: "Oversized Upload",
      document_class: "other",
      file_name: "oversized.txt",
      mime_type: "text/plain",
      size_bytes: 52_428_801,
    });
    expect(oversizedRes.status).toBe(400);
  });

  it("fails closed for EICAR and leaves zero source facts", { timeout: 60_000 }, async () => {
    const intent = await createUpload(eicarFixture);
    await putSignedObject(intent.upload_url, eicarFixture);

    const before = await countFactsForBusiness();
    const completed = await completeUpload(intent.id, eicarFixture);
    expect(completed.status, JSON.stringify(completed.body)).toBe(400);
    expect(completed.body.error.code).toBe("MALWARE_DETECTED");
    expect(await countFactsForBusiness()).toBe(before);
  });

  it("rejects executable upload content before source/job creation", { timeout: 60_000 }, async () => {
    const intent = await createUpload(executableFixture);
    await putSignedObject(intent.upload_url, executableFixture);

    const completed = await completeUpload(intent.id, executableFixture);
    expect(completed.status, JSON.stringify(completed.body)).toBe(400);
    expect(completed.body.error.code).toBe("UNSUPPORTED_FILE");
  });

  it("rejects malformed unknown content before source/job creation", { timeout: 60_000 }, async () => {
    const intent = await createUpload(malformedFixture);
    await putSignedObject(intent.upload_url, malformedFixture);

    const completed = await completeUpload(intent.id, malformedFixture);
    expect(completed.status, JSON.stringify(completed.body)).toBe(400);
    expect(completed.body.error.code).toBe("UNSUPPORTED_FILE");
  });

  it("keeps legacy Office uploads actionable and non-retryable after parser rejection", { timeout: 120_000 }, async () => {
    const intent = await createUpload(
      legacyDocFixture,
      { document_class: "brand_deck" },
      { useProposal: false },
    );
    await putSignedObject(intent.upload_url, legacyDocFixture);

    const completed = await completeUpload(intent.id, legacyDocFixture);
    expect(completed.status, JSON.stringify(completed.body)).toBe(202);
    expect(completed.body.job).toMatchObject({ retryable: true, status: "queued" });

    const sourceId = completed.body.source.id as string;
    const jobId = completed.body.job.id as string;
    const terminal = await pollForCondition(async () => {
      const { data } = await svc()
        .from("context_jobs")
        .select("status, error_class")
        .eq("id", jobId)
        .single();
      return data?.status === "failed_permanent" ? data : null;
    }, 120_000, 1_000);
    if (!terminal) throw new Error("Legacy upload job did not reach terminal failure");
    expect(["unsupported_file", "no_adapter"]).toContain(terminal.error_class);

    const { data: source, error } = await svc()
      .from("context_sources")
      .select("status, terminal_outcome")
      .eq("id", sourceId)
      .single();
    if (error) throw error;
    expect(source).toMatchObject({
      status: "failed_permanent",
      terminal_outcome: "failed_permanent",
    });
  });

  it("denies viewer upload intent creation", { timeout: 30_000 }, async () => {
    const res = await authenticatedFetch(`${base()}/api/businesses/${bizId}/context/uploads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idem("viewer"),
      },
      body: JSON.stringify({
        source_type: "upload",
        source_name: textFixture.sourceName,
        document_class: "other",
        file_name: textFixture.fileName,
        mime_type: textFixture.mimeType,
        size_bytes: textFixture.content.length,
      }),
      authToken: viewerCookie,
    });

    expect(res.status).toBe(403);
  });
});
