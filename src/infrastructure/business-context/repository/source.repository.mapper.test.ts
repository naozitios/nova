import { describe, expect, it } from "vitest";
import { mapSourceDocument } from "./mappers/source";

describe("mapSourceDocument — processed document fields", () => {
  it("maps processed_storage_path, processing_status, embedding_model, indexed_at", () => {
    const row = {
      id: "doc-1",
      workspace_id: "ws-1",
      business_id: "biz-1",
      source_id: "src-1",
      url: null,
      title: "Test",
      document_type: "product_document",
      mime_type: "application/pdf",
      file_name: "test.pdf",
      file_size_bytes: 1024,
      content_text: null,
      storage_path: "workspaces/ws-1/businesses/biz-1/uploads/intent-1/test.pdf",
      processed_storage_path: "workspaces/ws-1/businesses/biz-1/uploads/intent-1/test.pdf.md",
      processing_status: "indexed",
      embedding_model: "text-embedding-3-small",
      indexed_at: "2026-07-19T12:00:00Z",
      content_hash: "abc123",
      http_status: null,
      page_or_slide_count: 5,
      parser_name: "docling",
      parser_version: "2.70.0",
      effective_at: null,
      supersedes_document_id: null,
      metadata: {},
      retrieved_at: "2026-07-19T10:00:00Z",
    };

    const mapped = mapSourceDocument(row);

    expect(mapped).toMatchObject({
      processedStoragePath: "workspaces/ws-1/businesses/biz-1/uploads/intent-1/test.pdf.md",
      processingStatus: "indexed",
      embeddingModel: "text-embedding-3-small",
      indexedAt: new Date("2026-07-19T12:00:00Z"),
    });
  });

  it("defaults processing_status to pending when null", () => {
    const row = {
      id: "doc-2",
      workspace_id: "ws-1",
      business_id: "biz-1",
      source_id: "src-1",
      url: null,
      title: null,
      document_type: null,
      mime_type: null,
      file_name: null,
      file_size_bytes: null,
      content_text: null,
      storage_path: null,
      processed_storage_path: null,
      processing_status: null,
      embedding_model: null,
      indexed_at: null,
      content_hash: "def456",
      http_status: null,
      page_or_slide_count: null,
      parser_name: null,
      parser_version: null,
      effective_at: null,
      supersedes_document_id: null,
      metadata: {},
      retrieved_at: "2026-07-19T10:00:00Z",
    };

    const mapped = mapSourceDocument(row);

    expect(mapped.processingStatus).toBe("pending");
    expect(mapped.processedStoragePath).toBeNull();
    expect(mapped.embeddingModel).toBeNull();
    expect(mapped.indexedAt).toBeNull();
  });
});
