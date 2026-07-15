/** Billing provider composition — lazy-initialized singletons. */
import type { BillingPort } from '@/core/billing/billing.port';
import type { BillingStorePort } from '@/core/billing/billing.port';
import { StripeAdapter } from '@/infrastructure/payment/stripe.adapter';
import { StripeWebhookParser } from '@/infrastructure/payment/stripe-webhook';
import { InMemoryBillingStore } from '@/infrastructure/payment/billing-store';

let _stripeAdapter: StripeAdapter | null = null;
let _stripeWebhookParser: StripeWebhookParser | null = null;
let _billingStore: BillingStorePort = new InMemoryBillingStore();

/** Returns a lazy-initialized Stripe billing adapter. */
export function getBillingAdapter(): BillingPort {
  if (!_stripeAdapter) _stripeAdapter = new StripeAdapter();
  return _stripeAdapter;
}

/** Returns a lazy-initialized StripeWebhookParser. */
export function getStripeWebhookParser(): StripeWebhookParser {
  if (!_stripeWebhookParser) _stripeWebhookParser = new StripeWebhookParser();
  return _stripeWebhookParser;
}

/** Returns the current billing store instance. */
export function getBillingStore(): BillingStorePort {
  return _billingStore;
}

/** Replaces the billing store with a custom implementation. */
export function setBillingStore(store: BillingStorePort): void {
  _billingStore = store;
}

/** Resets billing providers to defaults. */
export function resetBillingProviders(): void {
  _stripeAdapter = null;
  _stripeWebhookParser = null;
  _billingStore = new InMemoryBillingStore();
}
