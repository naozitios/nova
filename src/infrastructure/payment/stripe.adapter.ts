import Stripe from 'stripe';
import { config } from '@/infrastructure/config';
import type { BillingPort } from '@/core/billing/billing.port';
import type { SubscriptionStatus } from '@/core/billing/types';

/** Stripe billing adapter — implements BillingPort using the Stripe SDK for production usage. */
/** Adapter that implements BillingPort by making real API calls to Stripe. */
export class StripeAdapter implements BillingPort {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2026-06-24.dahlia',
    });
  }

  /** Finds an existing Stripe customer by email or creates a new one. */
  async getOrCreateCustomer(email: string, name: string): Promise<string> {
    const customers = await this.stripe.customers.list({ email, limit: 1 });
    if (customers.data.length > 0) {
      return customers.data[0].id;
    }
    const customer = await this.stripe.customers.create({ email, name });
    return customer.id;
  }

  /** Creates a Stripe checkout session for a subscription and returns its URL. */
  async createCheckoutSession(customerId: string | null, priceId: string, returnUrl: string): Promise<string> {
    const effectivePriceId = priceId || config.stripe.proPriceId;
    if (!effectivePriceId) {
      throw new Error('Stripe price ID is not configured');
    }
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId || undefined,
      mode: 'subscription',
      line_items: [{ price: effectivePriceId, quantity: 1 }],
      success_url: `${returnUrl}?billing=success`,
      cancel_url: `${returnUrl}?billing=canceled`,
    });
    return session.url || '';
  }

  /** Creates a Stripe billing portal session for subscription management. */
  async createPortalSession(customerId: string, returnUrl: string): Promise<string> {
    const session = await this.stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  }

  /** Retrieves the current subscription status for a Stripe customer, or null if no subscription exists. */
  async getSubscriptionStatus(customerId: string): Promise<SubscriptionStatus | null> {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
    });
    if (subscriptions.data.length === 0) return null;

    const sub = subscriptions.data[0] as unknown as Record<string, unknown>;
    const items = sub.items as unknown as Record<string, unknown> | undefined;
    const itemData = (items?.data as unknown as Record<string, unknown>[] | undefined)?.[0];
    const price = itemData?.price as unknown as Record<string, unknown> | undefined;
    const plan = (price?.nickname as string | undefined)?.toLowerCase() || 'pro';

    return {
      plan: PLANS_MAP[plan] || 'pro',
      status: sub.status as SubscriptionStatus['status'],
      currentPeriodEnd: new Date((sub.current_period_end as number) * 1000).toISOString(),
      cancelAtPeriodEnd: sub.cancel_at_period_end as boolean,
    };
  }
}

const PLANS_MAP: Record<string, SubscriptionStatus['plan']> = {
  free: 'free',
  pro: 'pro',
  enterprise: 'enterprise',
};
