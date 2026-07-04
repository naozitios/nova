import type { BillingPlan } from '@/core/billing/types';
import type { BillingStorePort } from '@/core/billing/billing.port';

/** In-memory billing store — implements BillingStorePort for development and testing without a database. */
/** In-memory implementation of BillingStorePort for development and testing. */
export class InMemoryBillingStore implements BillingStorePort {
  private customers = new Map<string, string>();
  private plans = new Map<string, BillingPlan>();

  /** Returns the stored Stripe customer ID for a user, or null. */
  async getCustomerId(userId: string): Promise<string | null> {
    return this.customers.get(userId) || null;
  }

  /** Stores a Stripe customer ID for a user. */
  async setCustomerId(userId: string, customerId: string): Promise<void> {
    this.customers.set(userId, customerId);
  }

  /** Returns the billing plan for a user, defaulting to 'free'. */
  async getPlan(userId: string): Promise<BillingPlan> {
    return this.plans.get(userId) || 'free';
  }

  /** Sets the billing plan for a user. */
  async setPlan(userId: string, plan: BillingPlan): Promise<void> {
    this.plans.set(userId, plan);
  }
}
