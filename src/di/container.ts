/** Dependency injection container providing lazy-initialized singletons for the Nova application. */
import { CampaignService } from '@/core/campaign/service';
import { CampaignSeed } from '@/core/campaign/seed';
import { AIService } from '@/core/ai/service';
import { HealthService } from '@/core/optimization/health.service';
import { ActionCenter } from '@/core/optimization/action-center';
import { InMemoryCampaignRepository } from '@/infrastructure/persistence/campaign/in-memory.repository';
import { GroqAdapter } from '@/infrastructure/llm/groq.adapter';
import { MetaOAuthAdapter } from '@/infrastructure/meta/meta-oauth.adapter';
import { MetaApiAdapter } from '@/infrastructure/meta/meta-api.adapter';
import { DrizzleCampaignRepository } from '@/infrastructure/persistence/campaign/drizzle.repository';
import { StripeAdapter } from '@/infrastructure/payment/stripe.adapter';
import { StripeWebhookParser } from '@/infrastructure/payment/stripe-webhook';
import { InMemoryBillingStore } from '@/infrastructure/payment/billing-store';
import type { CampaignRepositoryPort } from '@/core/campaign/repository.port';
import type { LlmClientPort } from '@/core/ai/llm-client.port';
import type { MetaClientPort } from '@/core/optimization/meta-client.port';
import type { BillingPort } from '@/core/billing/billing.port';
import type { BillingStorePort } from '@/core/billing/billing.port';
import type { RepositoryPort } from '@/core/business-context/repository.port';
import { SupabaseRepository } from '@/infrastructure/business-context/supabase.repository';
import { ProcessingVisibilityWriter } from '@/infrastructure/business-context/processing-visibility';
import { CircuitBreakerAdapter } from '@/infrastructure/business-context/circuit-breaker';

export class Container {
  private static _campaignRepo: CampaignRepositoryPort = new InMemoryCampaignRepository();
  private static _llmClient: LlmClientPort | null = null;
  private static _groqAdapter: GroqAdapter | null = null;
  private static _metaOAuth: MetaOAuthAdapter | null = null;
  private static _metaApi: MetaApiAdapter | null = null;
  private static _campaignService: CampaignService | null = null;
  private static _campaignSeed: CampaignSeed | null = null;
  private static _aiService: AIService | null = null;
  private static _healthService: HealthService | null = null;
  private static _actionCenter: ActionCenter | null = null;
  private static _useDrizzle = false;
  private static _stripeAdapter: StripeAdapter | null = null;
  private static _stripeWebhookParser: StripeWebhookParser | null = null;
  private static _billingStore: BillingStorePort = new InMemoryBillingStore();
  private static _bcRepo: RepositoryPort | null = null;
  private static _bcVisibility: ProcessingVisibilityWriter | null = null;
  private static _bcCircuitBreaker: CircuitBreakerAdapter | null = null;

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

  /** Returns a lazy-initialized Stripe billing adapter. */
  static getBillingAdapter(): BillingPort {
    if (!this._stripeAdapter) this._stripeAdapter = new StripeAdapter();
    return this._stripeAdapter;
  }

  /** Returns a lazy-initialized StripeWebhookParser. */
  static getStripeWebhookParser(): StripeWebhookParser {
    if (!this._stripeWebhookParser) this._stripeWebhookParser = new StripeWebhookParser();
    return this._stripeWebhookParser;
  }

  /** Returns the current billing store instance. */
  static getBillingStore(): BillingStorePort {
    return this._billingStore;
  }

  /** Replaces the billing store with a custom implementation. */
  static setBillingStore(store: BillingStorePort): void {
    this._billingStore = store;
  }

  // ── Business Context ──────────────────────────────────────────────────────

  /** Returns the Business Context repository. Lazy-initializes Supabase-backed repo. */
  static getBusinessContextRepository(): RepositoryPort {
    if (!this._bcRepo) this._bcRepo = new SupabaseRepository();
    return this._bcRepo;
  }

  /** Replaces the Business Context repository. */
  static setBusinessContextRepository(repo: RepositoryPort): void {
    this._bcRepo = repo;
    this._bcVisibility = null;
    this._bcCircuitBreaker = null;
  }

  /** Returns a lazy-initialized ProcessingVisibilityWriter. */
  static getProcessingVisibilityWriter(): ProcessingVisibilityWriter {
    if (!this._bcVisibility) this._bcVisibility = new ProcessingVisibilityWriter();
    return this._bcVisibility;
  }

  /** Returns a lazy-initialized CircuitBreakerAdapter. */
  static getCircuitBreakerAdapter(): CircuitBreakerAdapter {
    if (!this._bcCircuitBreaker) this._bcCircuitBreaker = new CircuitBreakerAdapter();
    return this._bcCircuitBreaker;
  }

  /** Resets all services and repositories to their default in-memory state. */
  static reset(): void {
    this._campaignRepo = new InMemoryCampaignRepository();
    this._useDrizzle = false;
    this._llmClient = null;
    this._groqAdapter = null;
    this._metaOAuth = null;
    this._metaApi = null;
    this._campaignService = null;
    this._campaignSeed = null;
    this._aiService = null;
    this._healthService = null;
    this._actionCenter = null;
    this._stripeAdapter = null;
    this._stripeWebhookParser = null;
    this._billingStore = new InMemoryBillingStore();
    this._bcRepo = null;
    this._bcVisibility = null;
    this._bcCircuitBreaker = null;
  }
}
