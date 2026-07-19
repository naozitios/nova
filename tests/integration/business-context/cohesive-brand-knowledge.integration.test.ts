import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { compileDraftFromFacts } from '@/core/business-context/compiler'
import type { DocumentParserPort, ParsedDocument } from '@/core/business-context/document-parser.port'
import type {
  ExtractionPort,
  ExtractionRequest,
  ExtractedFact,
} from '@/core/business-context/extraction.port'
import type { SourceAdapterPort, CollectedSource } from '@/core/business-context/source-adapter.port'
import type { ServiceResult } from '@/core/business-context/types'
import { JobStatus, SourceProcessingStage, SourceType } from '@/core/business-context/types/enums'
import type { UploadStoragePort } from '@/core/business-context/upload-storage.port'
import type { EmbeddingPort } from '@/core/business-context/embedding.port'
import { CanonicalDocumentIndexer } from '@/core/business-context/service/canonical-document-indexer'
import { SourceFactPipeline } from '@/core/business-context/service/source-fact-pipeline'
import { SourceProcessingService } from '@/core/business-context/service/source-processing.service'
import { UploadedDocumentProcessor } from '@/core/business-context/service/uploaded-document.processor'
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository'

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SKIP_REASON = SUPABASE_KEY ? '' : 'SUPABASE_SERVICE_ROLE_KEY not set'
const canRun = Boolean(SUPABASE_KEY)

const WS = crypto.randomUUID()
const BIZ = crypto.randomUUID()

let db: SupabaseClient

const websiteMarkdown = [
  '# Cohesive Test Inferred',
  'Brand management platform for modern enterprises.',
].join('\n\n')

const uploadMarkdown = [
  '# Brand Overview',
  '## Offering',
  'Automated brand governance and AI content generation.',
  '## Target Audience',
  'Enterprise marketing teams and brand managers.',
].join('\n\n')

function parsed(contentText: string, pageOrSlideCount: number): ParsedDocument {
  return {
    contentText,
    parserName: 'docling',
    parserVersion: '2.0-test',
    pageOrSlideCount,
    warnings: [],
    metadata: {},
  }
}

function factsFor(request: ExtractionRequest): ExtractedFact[] {
  if (request.contentText.includes('Brand Overview')) {
    return [
      {
        factKey: 'offering.name',
        value: 'Brand management platform',
        confidence: 0.92,
        sourceExcerpt: 'Automated brand governance',
        evidenceLocator: { slide: 1 },
      },
      {
        factKey: 'target_audience.segments',
        value: ['Enterprise marketing teams', 'Brand managers'],
        confidence: 0.9,
        sourceExcerpt: 'Enterprise marketing teams and brand managers',
        evidenceLocator: { slide: 2 },
      },
    ]
  }

  return [
    {
      factKey: 'business.name',
      value: 'Cohesive Test Inferred',
      confidence: 0.8,
      sourceExcerpt: 'Cohesive Test Inferred',
      evidenceLocator: { url: 'https://cohesive-test.example' },
    },
    {
      factKey: 'business.description',
      value: 'Brand management platform for modern enterprises',
      confidence: 0.91,
      sourceExcerpt: 'Brand management platform for modern enterprises',
      evidenceLocator: { url: 'https://cohesive-test.example' },
    },
  ]
}

beforeAll(async () => {
  if (!canRun) return
  db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })
  await db.from('workspaces').upsert({ id: WS, name: 'Cohesive pipeline test' }, { onConflict: 'id' })
  await db.from('businesses').upsert(
    { id: BIZ, workspace_id: WS, name: 'Cohesive Test Biz', status: 'active' },
    { onConflict: 'id' },
  )
})

afterAll(async () => {
  if (!canRun || !db) return
  await db.from('document_chunks').delete().eq('workspace_id', WS)
  await db.from('context_quality_gate_results').delete().eq('workspace_id', WS)
  await db.from('context_conflicts').delete().eq('workspace_id', WS)
  await db.from('onboarding_questions').delete().eq('workspace_id', WS)
  await db.from('context_facts').delete().eq('workspace_id', WS)
  await db.from('context_processing_stage_events').delete().eq('workspace_id', WS)
  await db.from('context_processing_runs').delete().eq('workspace_id', WS)
  await db.from('context_jobs').delete().eq('workspace_id', WS)
  await db.from('source_documents').delete().eq('workspace_id', WS)
  await db.from('context_sources').delete().eq('workspace_id', WS)
  await db.from('business_profile_versions').delete().eq('workspace_id', WS)
  await db.from('businesses').delete().eq('id', BIZ)
  await db.from('workspaces').delete().eq('id', WS)
})

describe.skipIf(!canRun)(`Cohesive brand knowledge pipeline ${SKIP_REASON}`, () => {
  it('runs website and upload through shared Docling, indexing, and fact pipelines', async () => {
    const repo = new SupabaseRepository()
    const extractionRequests: ExtractionRequest[] = []

    const parser: DocumentParserPort = {
      supports: () => true,
      parseContent: vi.fn(async () => ({ ok: true, data: parsed(websiteMarkdown, 1) }) as const),
      parse: vi.fn(async () => ({ ok: true, data: parsed(uploadMarkdown, 2) }) as const),
    }
    const storage: UploadStoragePort = {
      upload: vi.fn(async ({ path }) => ({ ok: true, data: { storagePath: path } }) as const),
      download: vi.fn(),
      delete: vi.fn(),
      getSignedUrl: vi.fn(),
    }
    const embedder: EmbeddingPort = {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      embed: vi.fn(async (texts) => ({
        ok: true,
        data: texts.map(() => Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.01) * 0.1)),
      }) as const),
    }
    const extraction: ExtractionPort = {
      extractFacts: vi.fn(async (request): Promise<ServiceResult<{ facts: ExtractedFact[]; conflicts: []; warnings: [] }>> => {
        extractionRequests.push(request)
        return { ok: true, data: { facts: factsFor(request), conflicts: [], warnings: [] } }
      }),
      reconcileFacts: vi.fn(),
    }

    const indexer = new CanonicalDocumentIndexer(storage, embedder, repo)
    const factPipeline = new SourceFactPipeline(repo, extraction)
    const uploadProcessor = new UploadedDocumentProcessor(repo, parser, indexer, factPipeline)
    const uploadProcessSpy = vi.spyOn(uploadProcessor, 'process')
    const sourceProcessor = new SourceProcessingService(
      repo,
      extraction,
      uploadProcessor,
      factPipeline,
      parser,
      indexer,
    )

    const { data: seededSource, error: seededSourceError } = await db
      .from('context_sources')
      .insert({
        workspace_id: WS,
        business_id: BIZ,
        source_type: 'user_answer',
        source_name: 'Verified onboarding answer',
        status: 'processed',
        metadata: {},
        collected_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    expect(seededSourceError).toBeNull()

    const { error: seededFactError } = await db.from('context_facts').insert({
      workspace_id: WS,
      business_id: BIZ,
      fact_key: 'business.name',
      value: 'Cohesive Test Corp',
      source_id: seededSource!.id,
      source_document_id: null,
      source_excerpt: 'Verified during onboarding',
      evidence_locator: null,
      confidence: 1,
      verification_status: 'user_verified',
      supersedes_fact_id: null,
      valid_from: new Date().toISOString(),
      valid_to: null,
      created_by: 'user',
    })
    expect(seededFactError).toBeNull()

    const { data: websiteSource, error: websiteSourceError } = await db
      .from('context_sources')
      .insert({
        workspace_id: WS,
        business_id: BIZ,
        source_type: 'website',
        source_name: 'Company website',
        external_reference: 'https://cohesive-test.example',
        status: 'registered',
        metadata: {},
        collected_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    expect(websiteSourceError).toBeNull()

    const websiteAdapter: SourceAdapterPort = {
      supports: (type) => type === SourceType.WEBSITE,
      collect: vi.fn(async (): Promise<ServiceResult<CollectedSource>> => ({
        ok: true,
        data: {
          sourceType: SourceType.WEBSITE,
          sourceName: 'Company website',
          externalReference: 'https://cohesive-test.example',
          metadata: {},
          documents: [{
            url: 'https://cohesive-test.example',
            title: 'Cohesive Test Corp',
            contentText: 'Crawler fallback',
            mimeType: 'text/html',
            rawContent: '<html><body><h1>Cohesive Test Corp</h1></body></html>',
            rawMimeType: 'text/html',
            httpStatus: 200,
            metadata: {},
          }],
        },
      })),
    }
    sourceProcessor.registerAdapter(websiteAdapter)

    const websiteResult = await sourceProcessor.processSource(BIZ, WS, websiteSource!.id)
    expect(websiteResult.ok).toBe(true)

    const { data: uploadSource, error: uploadSourceError } = await db
      .from('context_sources')
      .insert({
        workspace_id: WS,
        business_id: BIZ,
        source_type: 'product_document',
        source_name: 'Brand overview deck.pdf',
        status: 'registered',
        metadata: {},
        collected_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    expect(uploadSourceError).toBeNull()

    const uploadDocResult = await repo.createSourceDocument({
      workspaceId: WS,
      businessId: BIZ,
      sourceId: uploadSource!.id,
      url: null,
      title: 'Brand overview deck',
      documentType: 'upload',
      mimeType: 'application/pdf',
      fileName: 'brand-overview.pdf',
      fileSizeBytes: 1024,
      contentText: null,
      storagePath: `workspaces/${WS}/businesses/${BIZ}/uploads/brand-overview.pdf`,
      processedStoragePath: null,
      processingStatus: 'pending',
      embeddingModel: null,
      indexedAt: null,
      contentHash: 'upload-input-hash',
      httpStatus: null,
      pageOrSlideCount: null,
      parserName: null,
      parserVersion: null,
      effectiveAt: new Date(),
      supersedesDocumentId: null,
      metadata: {},
      retrievedAt: new Date(),
    })
    expect(uploadDocResult.ok).toBe(true)
    if (!uploadDocResult.ok) return

    const uploadJobResult = await repo.createContextJob({
      workspaceId: WS,
      businessId: BIZ,
      sessionId: null,
      jobType: 'source_processing',
      status: JobStatus.QUEUED,
      attemptCount: 0,
      maxAttempts: 3,
      idempotencyKey: `cohesive-upload-${uploadDocResult.data.id}`,
      stage: SourceProcessingStage.QUEUED,
      input: {
        sourceId: uploadSource!.id,
        sourceType: 'upload',
        documentId: uploadDocResult.data.id,
      },
      output: null,
      error: null,
      errorClass: null,
      retryPolicy: {},
      nextRunAt: null,
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
      stageTimeoutSeconds: 30,
      startedAt: null,
      completedAt: null,
    })
    expect(uploadJobResult.ok).toBe(true)
    if (!uploadJobResult.ok) return

    const uploadResult = await sourceProcessor.processSource(BIZ, WS, uploadSource!.id, {
      job: uploadJobResult.data,
    })
    expect(uploadResult.ok, JSON.stringify(uploadResult)).toBe(true)
    expect(uploadProcessSpy).toHaveBeenCalledWith(expect.objectContaining({
      documentId: uploadDocResult.data.id,
    }))

    expect(parser.parseContent).toHaveBeenCalledOnce()
    expect(parser.parse).toHaveBeenCalledOnce()
    expect(storage.upload).toHaveBeenCalledTimes(2)
    expect(extractionRequests).toHaveLength(2)
    expect(extractionRequests.every((request) => request.parserName === 'docling')).toBe(true)

    const { data: documents } = await db
      .from('source_documents')
      .select('id, source_id, parser_name, processing_status, processed_storage_path')
      .eq('workspace_id', WS)
      .in('source_id', [websiteSource!.id, uploadSource!.id])
    expect(documents).toHaveLength(2)
    expect(documents!.every((document) => document.parser_name === 'docling')).toBe(true)
    expect(documents!.every((document) => document.processed_storage_path?.endsWith('.md'))).toBe(true)

    const websiteDocument = documents!.find((document) => document.source_id === websiteSource!.id)!
    const uploadDocument = documents!.find((document) => document.source_id === uploadSource!.id)!
    const { data: chunks } = await db
      .from('document_chunks')
      .select('source_document_id, locator')
      .eq('workspace_id', WS)
      .in('source_document_id', [websiteDocument.id, uploadDocument.id])
    expect(chunks!.some((chunk) => chunk.source_document_id === websiteDocument.id)).toBe(true)
    expect(chunks!.some((chunk) => chunk.source_document_id === uploadDocument.id)).toBe(true)
    expect(chunks!.some((chunk) => chunk.locator?.url === 'https://cohesive-test.example')).toBe(true)

    const { data: facts } = await db
      .from('context_facts')
      .select('fact_key, source_id, source_document_id, verification_status, valid_to, value')
      .eq('workspace_id', WS)
      .eq('business_id', BIZ)
    expect(facts!.some((fact) => fact.source_id === websiteSource!.id && fact.source_document_id === websiteDocument.id)).toBe(true)
    expect(facts!.some((fact) => fact.source_id === uploadSource!.id && fact.source_document_id === uploadDocument.id)).toBe(true)

    const verifiedName = facts!.find(
      (fact) => fact.fact_key === 'business.name' && fact.verification_status === 'user_verified',
    )
    expect(verifiedName?.value).toBe('Cohesive Test Corp')
    expect(verifiedName?.valid_to).toBeNull()

    const compiled = await compileDraftFromFacts(repo, BIZ, WS)
    expect(compiled.ok).toBe(true)
    if (compiled.ok) {
      expect(compiled.data.profile).toMatchObject({
        business: { name: 'Cohesive Test Corp' },
      })
    }
  })
})
