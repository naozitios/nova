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
import { ClamavMalwareScanner } from '@/infrastructure/business-context/clamav-malware.scanner';
import { IdempotencyService } from '@/infrastructure/business-context/idempotency.service';
import { MetaResolver } from '@/infrastructure/business-context/meta-resolver.service';
import { SourceAdapterRegistry } from '@/infrastructure/business-context/source-adapter-registry';
import { WebsiteSourceAdapter } from '@/infrastructure/business-context/website-source.adapter';
import { MetaSourceAdapter } from '@/infrastructure/business-context/meta/meta-adapter';
import { ManualSourceAdapter } from '@/infrastructure/business-context/manual-source.adapter';
import { NativeDocumentParserAdapter } from '@/infrastructure/business-context/native-document.parser.adapter';
import { PaddleOcrDocumentParserAdapter } from '@/infrastructure/business-context/paddleocr-document-parser.adapter';
import { DocumentParserRouter } from '@/infrastructure/business-context/document-parser-router';
import { LlmExtractionAdapter, type LlmClient } from '@/infrastructure/business-context/llm-extraction.adapter';
import { SourceProcessingService } from '@/core/business-context/service/source-processing.service';
import { JobRunner } from '@/infrastructure/business-context/job-runner';
import { registerHandlers } from '@/infrastructure/business-context/job-runner/register-handlers';

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
  if (!_malwareScanner) _malwareScanner = new ClamavMalwareScanner();
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
    _sourceAdapterRegistry.register(new MetaSourceAdapter());
    _sourceAdapterRegistry.register(new ManualSourceAdapter());

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
    const parser = new DocumentParserRouter(
      new NativeDocumentParserAdapter(),
      new PaddleOcrDocumentParserAdapter(),
    );
    _documentParser = parser;
    return parser;
  }
  return _documentParser;
}

/** Returns the extraction service. Requires LLM provider (GROQ_API_KEY or LLM_API_URL). */
export function getExtractionService(): ExtractionPort {
  if (!_extractionService) {
    const apiKey = process.env.GROQ_API_KEY;
    const apiUrl = process.env.LLM_API_URL;
    if (!apiKey && !apiUrl) {
      throw new Error('ExtractionService requires an LLM provider: set GROQ_API_KEY or LLM_API_URL');
    }
    const client: LlmClient = {
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
  _jobRunner = null;
}
