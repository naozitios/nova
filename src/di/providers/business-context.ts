/** Business Context provider composition — lazy-initialized singletons. */
import type { RepositoryPort } from '@/core/business-context/repository.port';
import type { UploadRepositoryPort } from '@/core/business-context/repository/upload.port';
import type { IdempotencyRepositoryPort } from '@/core/business-context/repository/idempotency.port';
import type { MetaConnectionRepositoryPort } from '@/core/business-context/repository/meta-connection.port';
import type { UploadStoragePort } from '@/core/business-context/upload-storage.port';
import type { MalwareScannerPort } from '@/core/business-context/malware-scanner.port';
import type { IdempotencyPort } from '@/core/business-context/idempotency.port';
import type { MetaConnectionPort } from '@/core/business-context/meta-connection.port';
import type { DocumentParserPort } from '@/core/business-context/document-parser.port';
import type { ExtractionPort } from '@/core/business-context/extraction.port';
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository';
import { getSupabaseServiceClient } from '@/infrastructure/business-context/supabase-client';
import { ProcessingVisibilityWriter } from '@/infrastructure/business-context/processing-visibility';
import { CircuitBreakerAdapter } from '@/infrastructure/business-context/breaker';
import { UploadRepository } from '@/infrastructure/business-context/repository/upload.repository';
import { IdempotencyRepository } from '@/infrastructure/business-context/repository/idempotency.repository';
import { MetaConnectionRepository } from '@/infrastructure/business-context/repository/meta-connection.repository';
import { SupabaseUploadStorage } from '@/infrastructure/business-context/supabase-upload.storage';
import { IdempotencyService } from '@/infrastructure/business-context/idempotency.service';
import { MetaResolver } from '@/infrastructure/business-context/meta-resolver.service';
import { SourceAdapterRegistry } from '@/infrastructure/business-context/source-adapter-registry';
import { WebsiteSourceAdapter } from '@/infrastructure/business-context/website-source.adapter';
import { MetaSourceAdapter, type MetaRepoPort } from '@/infrastructure/business-context/meta/meta-adapter';
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository';
import { ManualSourceAdapter } from '@/infrastructure/business-context/manual-source.adapter';

import { LlmExtractionAdapter, type LlmClient } from '@/infrastructure/business-context/llm-extraction.adapter';
import { OpenRouterExtractionClient } from '@/infrastructure/business-context/openrouter-extraction.client';
import { SourceProcessingService } from '@/core/business-context/service/source-processing.service';
import { JobRunner } from '@/infrastructure/business-context/job-runner';
import { registerHandlers } from '@/infrastructure/business-context/job-runner/register-handlers';
import { ClamavMalwareScanner } from '@/infrastructure/business-context/clamav-malware.scanner';
import { DoclingDocumentParserAdapter } from '@/infrastructure/business-context/docling-document-parser.adapter';
import { OpenAIEmbeddingAdapter } from '@/infrastructure/business-context/openai-embedding.adapter';
import { UploadedDocumentProcessor } from '@/core/business-context/service/uploaded-document.processor';
import type { EmbeddingPort } from '@/core/business-context/embedding.port';

let _bcRepo: RepositoryPort | null = null;
let _bcVisibility: ProcessingVisibilityWriter | null = null;
let _bcCircuitBreaker: CircuitBreakerAdapter | null = null;
let _uploadRepo: UploadRepositoryPort | null = null;
let _idempotencyRepo: IdempotencyRepositoryPort | null = null;
let _metaConnectionRepo: MetaConnectionRepositoryPort | null = null;
let _uploadStorage: UploadStoragePort | null = null;
let _malwareScanner: MalwareScannerPort | null = null;
let _idempotencyService: IdempotencyPort | null = null;
let _metaResolver: MetaConnectionPort | null = null;
let _sourceAdapterRegistry: SourceAdapterRegistry | null = null;
let _documentParser: DocumentParserPort | null = null;
let _extractionService: ExtractionPort | null = null;
let _sourceProcessingService: SourceProcessingService | null = null;
let _uploadedProcessor: UploadedDocumentProcessor | null = null;
let _embeddingAdapter: EmbeddingPort | null = null;
let _jobRunner: JobRunner | null = null;

// ── Repository ────────────────────────────────────────────────────────────

/** Returns the Business Context repository. Lazy-initializes Supabase-backed repo. */
export function getBusinessContextRepository(): RepositoryPort {
  if (!_bcRepo) _bcRepo = new SupabaseRepository();
  return _bcRepo;
}

/** Replaces the Business Context repository and resets dependents. */
export function setBusinessContextRepository(repo: RepositoryPort): void {
  _bcRepo = repo;
  _bcVisibility = null;
  _bcCircuitBreaker = null;
}

/** Returns a lazy-initialized ProcessingVisibilityWriter. */
export function getProcessingVisibilityWriter(): ProcessingVisibilityWriter {
  if (!_bcVisibility) _bcVisibility = new ProcessingVisibilityWriter();
  return _bcVisibility;
}

/** Returns a lazy-initialized CircuitBreakerAdapter. */
export function getCircuitBreakerAdapter(): CircuitBreakerAdapter {
  if (!_bcCircuitBreaker) _bcCircuitBreaker = new CircuitBreakerAdapter();
  return _bcCircuitBreaker;
}

// ── Remediation Repositories ──────────────────────────────────────────────

/** Returns the upload repository. Lazy-initializes Supabase-backed repo. */
export function getUploadRepository(): UploadRepositoryPort {
  if (!_uploadRepo) _uploadRepo = new UploadRepository(getSupabaseServiceClient());
  return _uploadRepo;
}

/** Returns the idempotency repository. Lazy-initializes Supabase-backed repo. */
export function getIdempotencyRepository(): IdempotencyRepositoryPort {
  if (!_idempotencyRepo) _idempotencyRepo = new IdempotencyRepository(getSupabaseServiceClient());
  return _idempotencyRepo;
}

/** Returns the Meta connection repository. Lazy-initializes Supabase-backed repo. */
export function getMetaConnectionRepository(): MetaConnectionRepositoryPort {
  if (!_metaConnectionRepo) _metaConnectionRepo = new MetaConnectionRepository(getSupabaseServiceClient());
  return _metaConnectionRepo;
}

// ── Remediation Services ──────────────────────────────────────────────────

/** Returns the upload storage adapter. Lazy-initializes Supabase storage. */
export function getUploadStorage(): UploadStoragePort {
  if (!_uploadStorage) _uploadStorage = new SupabaseUploadStorage();
  return _uploadStorage;
}

/** Returns the malware scanner. Requires CLAMAV_HOST env var. */
export function getMalwareScanner(): MalwareScannerPort {
  if (!process.env.CLAMAV_HOST) {
    throw new Error('CLAMAV_HOST environment variable is required for MalwareScanner');
  }
  if (!_malwareScanner) {
    _malwareScanner = new ClamavMalwareScanner();
  }
  return _malwareScanner;
}

/** Returns the idempotency service. Lazy-initializes with repository. */
export function getIdempotencyService(): IdempotencyPort {
  if (!_idempotencyService) {
    _idempotencyService = new IdempotencyService(getIdempotencyRepository());
  }
  return _idempotencyService;
}

/** Returns the Meta connection resolver. Lazy-initializes with repository. */
export function getMetaResolver(): MetaConnectionPort {
  if (!_metaResolver) {
    _metaResolver = new MetaResolver(getMetaConnectionRepository());
  }
  return _metaResolver;
}

// ── Processing Pipeline ───────────────────────────────────────────────────

/** Returns the source adapter registry. Lazy-initializes with default adapters. */
export function getSourceAdapterRegistry(): SourceAdapterRegistry {
  if (!_sourceAdapterRegistry) {
    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) {
      throw new Error(
        'FIRECRAWL_API_KEY environment variable is required for WebsiteSourceAdapter',
      );
    }
    _sourceAdapterRegistry = new SourceAdapterRegistry();
    _sourceAdapterRegistry.register(new WebsiteSourceAdapter({ apiKey: firecrawlKey }));
    const metaRepo = new SupabaseMetaRepository();
    _sourceAdapterRegistry.register(new MetaSourceAdapter({ repo: metaRepo }));

    // Stable unsupported outcomes for stored-document types until B16 adapters land
    _sourceAdapterRegistry.registerUnsupported('brand_deck', 'No adapter for brand_deck yet (B16 pending)');
    _sourceAdapterRegistry.registerUnsupported('brand_playbook', 'No adapter for brand_playbook yet (B16 pending)');
    _sourceAdapterRegistry.registerUnsupported('product_document', 'No adapter for product_document yet (B16 pending)');
    _sourceAdapterRegistry.registerUnsupported('campaign_brief', 'No adapter for campaign_brief yet (B16 pending)');
    _sourceAdapterRegistry.registerUnsupported('research_document', 'No adapter for research_document yet (B16 pending)');
  }
  return _sourceAdapterRegistry;
}

/** Returns the document parser. Lazy-initializes router with native + OCR parsers. */
export function getDocumentParser(): DocumentParserPort {
  if (!_documentParser) {
    _documentParser = new DoclingDocumentParserAdapter(
      getUploadStorage(),
    );
  }
  return _documentParser;
}

/** Returns the embedding adapter. Lazy-initializes with OpenAI-compatible API. */
export function getEmbeddingAdapter(): EmbeddingPort {
  if (!_embeddingAdapter) {
    const apiKey = process.env.EMBEDDING_API_KEY;
    if (!apiKey) {
      throw new Error('EMBEDDING_API_KEY environment variable is required');
    }
    _embeddingAdapter = new OpenAIEmbeddingAdapter({
      apiKey,
      baseUrl: process.env.EMBEDDING_API_URL,
    });
  }
  return _embeddingAdapter;
}

/** Returns the uploaded document processor. Lazy-initializes with dependencies. */
export function getUploadedDocumentProcessor(): UploadedDocumentProcessor {
  if (!_uploadedProcessor) {
    _uploadedProcessor = new UploadedDocumentProcessor(
      getBusinessContextRepository(),
      getDocumentParser(),
      getUploadStorage(),
      getEmbeddingAdapter(),
    );
  }
  return _uploadedProcessor;
}

/** Returns the extraction service, preferring configured OpenRouter over Groq. */
export function getExtractionService(): ExtractionPort {
  if (!_extractionService) {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openRouterModel = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash';
    const apiKey = process.env.GROQ_API_KEY;
    const apiUrl = process.env.LLM_API_URL;
    if (!openRouterKey && !apiKey && !apiUrl) {
      throw new Error('ExtractionService requires OPENROUTER_API_KEY, GROQ_API_KEY, or LLM_API_URL');
    }
    const client: LlmClient = openRouterKey
      ? new OpenRouterExtractionClient(openRouterKey, openRouterModel)
      : {
      async complete(request) {
        const Groq = (await import('groq-sdk')).default;
        const groq = new Groq({ apiKey });
        const response = await groq.chat.completions.create({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: request.systemPrompt },
            { role: 'user', content: request.content },
          ],
          temperature: request.temperature ?? 0.1,
          max_tokens: request.maxTokens ?? 4096,
          response_format: { type: 'json_object' },
        });
        const content = response.choices[0]?.message?.content ?? '{}';
        return JSON.parse(content);
      },
    };
    _extractionService = new LlmExtractionAdapter(client);
  }
  return _extractionService;
}

/** Returns the source processing service. Lazy-initializes with repository and registers adapters from the registry. */
export function getSourceProcessingService(): SourceProcessingService {
  if (!_sourceProcessingService) {
    _sourceProcessingService = new SourceProcessingService(
      getBusinessContextRepository(),
      getExtractionService(),
      getUploadedDocumentProcessor(),
    );
    const registry = getSourceAdapterRegistry();
    const seen = new Set<object>();
    for (const sourceType of registry.listSupportedTypes()) {
      const result = registry.resolve(sourceType);
      if ('adapter' in result && !seen.has(result.adapter)) {
        _sourceProcessingService.registerAdapter(result.adapter);
        seen.add(result.adapter);
      }
    }
  }
  return _sourceProcessingService;
}

/** Returns the job runner. Lazy-initializes with repository. */
export function getJobRunner(): JobRunner {
  if (!_jobRunner) _jobRunner = new JobRunner(getBusinessContextRepository());
  return _jobRunner;
}

/** Returns a function that registers all handlers on a job runner. */
export function getRegisterHandlers(): (runner: JobRunner) => void {
  return (runner: JobRunner) => {
    const handlers = new Map()
    registerHandlers(handlers)
    for (const [jobType, handler] of handlers) {
      runner.registerHandler(jobType, handler)
    }
  };
}

/** Resets all Business Context providers to defaults. */
export function resetBusinessContextProviders(): void {
  _bcRepo = null;
  _bcVisibility = null;
  _bcCircuitBreaker = null;
  _uploadRepo = null;
  _idempotencyRepo = null;
  _metaConnectionRepo = null;
  _uploadStorage = null;
  _malwareScanner = null;
  _idempotencyService = null;
  _metaResolver = null;
  _sourceAdapterRegistry = null;
  _documentParser = null;
  _extractionService = null;
  _sourceProcessingService = null;
  _uploadedProcessor = null;
  _embeddingAdapter = null;
  _jobRunner = null;
}
