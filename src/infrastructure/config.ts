/** Application configuration sourced from environment variables. */
export const config = {
  /** Meta Ads API configuration (app ID, secret, API version, redirect URI, scopes). */
  meta: {
    appId: process.env.META_APP_ID || process.env.NEXT_PUBLIC_META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    apiVersion: process.env.META_API_VERSION || 'v22.0',
    redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:3000/api/meta/callback',
    scopes: ['ads_management', 'ads_read', 'business_management'],
  },
  /** Groq LLM API configuration (API key, model name, max tokens). */
  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    maxTokens: parseInt(process.env.GROQ_MAX_TOKENS || '4096'),
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
};
