/** Dependency injection container providing lazy-initialized singletons for the Nova application. */
import { CampaignService } from '@/core/campaign/service';
import { CampaignSeed } from '@/core/campaign/seed';
import { AIService } from '@/core/ai/service';
import { HealthService } from '@/core/optimization/health.service';
import { ActionCenter } from '@/core/optimization/action-center';
import { SupabaseMetaRepository } from '@/infrastructure/meta/supabase-meta.repository';
import { MetaTokenVault } from '@/infrastructure/meta/token-vault';
import { InMemoryCampaignRepository } from '@/infrastructure/persistence/campaign/in-memory.repository';
import { GroqAdapter } from '@/infrastructure/llm/groq.adapter';
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';
import { DrizzleCampaignRepository } from '@/infrastructure/persistence/campaign/drizzle.repository';
import type { CampaignRepositoryPort } from '@/core/campaign/repository.port';
import type { LlmClientPort } from '@/core/ai/llm-client.port';
import type { MetaClientPort } from '@/core/optimization/meta-client.port';
import type { BillingPort } from '@/core/billing/billing.port';
import type { BillingStorePort } from '@/core/billing/billing.port';
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
import { ProcessingVisibilityWriter } from '@/infrastructure/business-context/processing-visibility';
import { CircuitBreakerAdapter } from '@/infrastructure/business-context/breaker';
import { SourceAdapterRegistry } from '@/infrastructure/business-context/source-adapter-registry';
import { SourceProcessingService } from '@/core/business-context/service/source-processing.service';
import { JobRunner } from '@/infrastructure/business-context/job-runner';
import * as BC from './providers/business-context';
import * as Billing from './providers/billing';

export class Container {
  private static _campaignRepo: CampaignRepositoryPort = new InMemoryCampaignRepository();
  private static _llmClient: LlmClientPort | null = null;
  private static _groqAdapter: GroqAdapter | null = null;
  private static _metaOAuth: MetaOAuthAdapter | null = null;
  private static _metaApi: MetaApiAdapter | null = null;
  private static _metaRepo: SupabaseMetaRepository | null = null;
  private static _metaTokenVault: MetaTokenVault | null = null;
  private static _campaignService: CampaignService | null = null;
  private static _campaignSeed: CampaignSeed | null = null;
  private static _aiService: AIService | null = null;
  private static _healthService: HealthService | null = null;
  private static _actionCenter: ActionCenter | null = null;
  private static _useDrizzle = false;

  /** Returns the current campaign repository instance. */
  static getCampaignRepository(): CampaignRepositoryPort {
    return this._campaignRepo;
  }

  /** Replaces the campaign repository and resets dependent services. */
  static setCampaignRepository(repo: CampaignRepositoryPort): void {
    this._campaignRepo = repo;
    this._campaignService = null;
    this._campaignSeed = null;
    this._aiService = null;
  }

  /** Switches to the Drizzle (database-backed) campaign repository. */
  static useDrizzle(): void {
    if (!this._useDrizzle) {
      this._campaignRepo = new DrizzleCampaignRepository();
      this._useDrizzle = true;
      this._campaignService = null;
      this._campaignSeed = null;
      this._aiService = null;
    }
  }

  /** Switches back to the in-memory campaign repository. */
  static useInMemory(): void {
    if (this._useDrizzle) {
      this._campaignRepo = new InMemoryCampaignRepository();
      this._useDrizzle = false;
      this._campaignService = null;
      this._campaignSeed = null;
      this._aiService = null;
    }
  }

  /** Returns the injected LLM client, or null if none is set. */
  static getLlmClient(): LlmClientPort | null {
    return this._llmClient;
  }

  /** Injects a custom LLM client and resets the AI service. */
  static setLlmClient(client: LlmClientPort): void {
    this._llmClient = client;
    this._aiService = null;
  }

  /** Returns a lazy-initialized GroqAdapter. */
  static getGroqAdapter(): GroqAdapter {
    if (!this._groqAdapter) this._groqAdapter = new GroqAdapter();
    return this._groqAdapter;
  }

  /** Returns a lazy-initialized MetaOAuthAdapter. */
  static getMetaOAuthAdapter(): MetaOAuthAdapter {
    if (!this._metaOAuth) this._metaOAuth = new MetaOAuthAdapter();
    return this._metaOAuth;
  }

  /** Returns a lazy-initialized MetaApiAdapter. */
  static getMetaApiAdapter(): MetaApiAdapter {
    if (!this._metaApi) this._metaApi = new MetaApiAdapter();
    return this._metaApi;
  }

  /** Returns a lazy-initialized SupabaseMetaRepository (PRD 008 meta-data port impl). */
  static getMetaRepository(): SupabaseMetaRepository {
    if (!this._metaRepo) this._metaRepo = new SupabaseMetaRepository();
    return this._metaRepo;
  }

  /** Returns a lazy-initialized MetaTokenVault. */
  static getMetaTokenVault(): MetaTokenVault {
    if (!this._metaTokenVault) this._metaTokenVault = new MetaTokenVault();
    return this._metaTokenVault;
  }

  /** Returns the Meta API adapter as a MetaClientPort. */
  static getMetaClient(): MetaClientPort {
    return this.getMetaApiAdapter();
  }

  /** Returns a lazy-initialized CampaignService bound to the current repository. */
  static getCampaignService(): CampaignService {
    if (!this._campaignService) {
      this._campaignService = new CampaignService(this._campaignRepo);
    }
    return this._campaignService;
  }

  /** Returns a lazy-initialized CampaignSeed. */
  static getCampaignSeed(): CampaignSeed {
    if (!this._campaignSeed) {
      this._campaignSeed = new CampaignSeed(this.getCampaignService());
    }
    return this._campaignSeed;
  }

  /** Returns a lazy-initialized AIService, auto-wired with Groq if available. */
  static getAIService(): AIService {
    if (!this._aiService) {
      this._aiService = new AIService(
        this.getCampaignService(),
        (this._llmClient ?? undefined) || (process.env.GROQ_API_KEY ? this.getGroqAdapter() : undefined)
      );
    }
    return this._aiService;
  }

  /** Returns a lazy-initialized HealthService. */
  static getHealthService(): HealthService {
    if (!this._healthService) {
      this._healthService = new HealthService();
    }
    return this._healthService;
  }

  /** Returns a lazy-initialized ActionCenter. */
  static getActionCenter(): ActionCenter {
    if (!this._actionCenter) {
      this._actionCenter = new ActionCenter();
    }
    return this._actionCenter;
  }

  // ── Billing (delegated) ─────────────────────────────────────────────────

  /** Returns a lazy-initialized Stripe billing adapter. */
  static getBillingAdapter(): BillingPort {
    return Billing.getBillingAdapter();
  }

  /** Returns a lazy-initialized StripeWebhookParser. */
  static getStripeWebhookParser() {
    return Billing.getStripeWebhookParser();
  }

  /** Returns the current billing store instance. */
  static getBillingStore(): BillingStorePort {
    return Billing.getBillingStore();
  }

  /** Replaces the billing store with a custom implementation. */
  static setBillingStore(store: BillingStorePort): void {
    Billing.setBillingStore(store);
  }

  // ── Business Context (delegated) ────────────────────────────────────────

  /** Returns the Business Context repository. Lazy-initializes Supabase-backed repo. */
  static getBusinessContextRepository(): RepositoryPort {
    return BC.getBusinessContextRepository();
  }

  /** Replaces the Business Context repository. */
  static setBusinessContextRepository(repo: RepositoryPort): void {
    BC.setBusinessContextRepository(repo);
  }

  /** Returns a lazy-initialized ProcessingVisibilityWriter. */
  static getProcessingVisibilityWriter(): ProcessingVisibilityWriter {
    return BC.getProcessingVisibilityWriter();
  }

  /** Returns a lazy-initialized CircuitBreakerAdapter. */
  static getCircuitBreakerAdapter(): CircuitBreakerAdapter {
    return BC.getCircuitBreakerAdapter();
  }

  /** Returns the upload repository. Lazy-initializes Supabase-backed repo. */
  static getUploadRepository(): UploadRepositoryPort {
    return BC.getUploadRepository();
  }

  /** Returns the idempotency repository. Lazy-initializes Supabase-backed repo. */
  static getIdempotencyRepository(): IdempotencyRepositoryPort {
    return BC.getIdempotencyRepository();
  }

  /** Returns the Meta connection repository. Lazy-initializes Supabase-backed repo. */
  static getMetaConnectionRepository(): MetaConnectionRepositoryPort {
    return BC.getMetaConnectionRepository();
  }

  /** Returns the upload storage adapter. Lazy-initializes Supabase storage. */
  static getUploadStorage(): UploadStoragePort {
    return BC.getUploadStorage();
  }

  /** Returns the malware scanner. Requires CLAMAV_HOST env var. */
  static getMalwareScanner(): MalwareScannerPort {
    return BC.getMalwareScanner();
  }

  /** Returns the idempotency service. Lazy-initializes with repository. */
  static getIdempotencyService(): IdempotencyPort {
    return BC.getIdempotencyService();
  }

  /** Returns the Meta connection resolver. Lazy-initializes with repository. */
  static getMetaResolver(): MetaConnectionPort {
    return BC.getMetaResolver();
  }

  /** Returns the source adapter registry. Lazy-initializes with default adapters. */
  static getSourceAdapterRegistry(): SourceAdapterRegistry {
    return BC.getSourceAdapterRegistry();
  }

  /** Returns the document parser. Lazy-initializes router with native + OCR parsers. */
  static getDocumentParser(): DocumentParserPort {
    return BC.getDocumentParser();
  }

  /** Returns the extraction service. Requires LLM provider (GROQ_API_KEY or LLM_API_URL). */
  static getExtractionService(): ExtractionPort {
    return BC.getExtractionService();
  }

  /** Returns the source processing service. Lazy-initializes with repository. */
  static getSourceProcessingService(): SourceProcessingService {
    return BC.getSourceProcessingService();
  }

  /** Returns the job runner. Lazy-initializes with repository. */
  static getJobRunner(): JobRunner {
    return BC.getJobRunner();
  }

  /** Returns a function that registers extraction handlers on a job runner. */
  static getRegisterHandlers(): (runner: JobRunner) => void {
    return BC.getRegisterHandlers();
  }

  /** Resets all services and repositories to their default in-memory state. */
  static reset(): void {
    this._campaignRepo = new InMemoryCampaignRepository();
    this._useDrizzle = false;
    this._llmClient = null;
    this._groqAdapter = null;
    this._metaOAuth = null;
    this._metaApi = null;
    this._metaRepo = null;
    this._metaTokenVault = null;
    this._campaignService = null;
    this._campaignSeed = null;
    this._aiService = null;
    this._healthService = null;
    this._actionCenter = null;
    BC.resetBusinessContextProviders();
    Billing.resetBillingProviders();
  }
}
