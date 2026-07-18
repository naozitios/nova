/** Application configuration sourced from environment variables. */
export const config = {
  /** Meta Ads API configuration (app ID, secret, API version, redirect URI, scopes). */
  meta: {
    appId: process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    apiVersion: process.env.META_API_VERSION || 'v22.0',
    redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:3000/api/meta/oauth/callback',
    scopes: ['ads_management', 'ads_read', 'business_management'],
  },
  /** Groq LLM API configuration (API key, model name, max tokens). */
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '4096'),
  },
  /** OpenRouter extraction provider configuration. */
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash',
  },
  /** Database connection configuration (SQLite URL for Drizzle ORM). */
  database: {
    url: process.env.DATABASE_URL || 'file:./local.db',
  },
  /** Authentication configuration (Google OAuth and NextAuth secrets). */
  auth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    nextAuthSecret: process.env.NEXTAUTH_SECRET || 'dev-secret-change-in-production',
    nextAuthUrl: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  },
  /** Stripe payment configuration (secret key, webhook secret, price IDs). */
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
  },
  /** Business Context configuration (Supabase local, storage, OCR, crawl limits). */
  businessContext: {
    supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    storageSourceBucket: process.env.SUPABASE_STORAGE_SOURCE_BUCKET || 'business-context-source',
    storageArchiveBucket: process.env.SUPABASE_STORAGE_ARCHIVE_BUCKET || 'business-context-archive',
    firecrawlApiKey: process.env.FIRECRAWL_API_KEY || '',
    maxWebsitePages: parseInt(process.env.BUSINESS_CONTEXT_MAX_WEBSITE_PAGES || '50'),
    maxNormalizedTextMb: parseInt(process.env.BUSINESS_CONTEXT_MAX_NORMALIZED_TEXT_MB || '10'),
    maxUploadMb: parseInt(process.env.BUSINESS_CONTEXT_MAX_UPLOAD_MB || '50'),
    creditCeiling: parseInt(process.env.BUSINESS_CONTEXT_CREDIT_CEILING || '100'),
    paddleocrWorkerMode: process.env.PADDLEOCR_WORKER_MODE || 'cpu',
    paddleocrVlEnabled: process.env.PADDLEOCR_VL_ENABLED === 'true',
  },
  /** ClamAV malware scanner configuration. */
  clamav: {
    host: process.env.CLAMAV_HOST || 'localhost',
    port: parseInt(process.env.CLAMAV_PORT || '3310'),
    healthCheckTimeoutMs: parseInt(process.env.CLAMAV_HEALTH_TIMEOUT_MS || '5000'),
    healthCheckRetries: parseInt(process.env.CLAMAV_HEALTH_RETRIES || '3'),
    healthCheckIntervalMs: parseInt(process.env.CLAMAV_HEALTH_INTERVAL_MS || '2000'),
  },
  /** Encryption key for Meta OAuth tokens and other sensitive persisted data. */
  metaEncryptionKey: process.env.META_ENCRYPTION_KEY || '',
  /** Unique worker identity for distributed job claiming. */
  workerId: process.env.WORKER_ID || `worker-${process.pid}`,
};

/** Required environment variables that must be set in production. */
const REQUIRED_IN_PRODUCTION = [
  'META_ENCRYPTION_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXTAUTH_SECRET',
] as const;

/**
 * Validate required environment variables at startup.
 * Call once during application/worker bootstrap.
 * Throws descriptive error listing all missing variables.
 */
export function validateRequiredConfig(): void {
  if (process.env.NODE_ENV === 'production') {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables for production: ${missing.join(', ')}. ` +
          'Set these before starting the application.',
      );
    }
  }
}
