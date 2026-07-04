import type { SubscriptionStatus, BillingPlan } from './types';

/** Port interfaces for billing operations (Stripe interaction) and billing data persistence. */
/** Port interface for interacting with the Stripe billing system. */
export interface BillingPort {
  /** Creates a Stripe checkout session for a subscription and returns the session URL. */
  createCheckoutSession(customerId: string | null, priceId: string, returnUrl: string): Promise<string>;
  /** Creates a Stripe billing portal session for subscription management and returns the portal URL. */
  createPortalSession(customerId: string, returnUrl: string): Promise<string>;
  /** Retrieves the current subscription status for a Stripe customer. */
  getSubscriptionStatus(customerId: string): Promise<SubscriptionStatus | null>;
  /** Finds an existing Stripe customer by email or creates a new one, returning the customer ID. */
  getOrCreateCustomer(email: string, name: string): Promise<string>;
}

/** Port interface for persisting billing-related user data (customer IDs, plans). */
export interface BillingStorePort {
  /** Retrieves the Stripe customer ID for a given user, or null if not set. */
  getCustomerId(userId: string): Promise<string | null>;
  /** Stores the Stripe customer ID for a given user. */
  setCustomerId(userId: string, customerId: string): Promise<void>;
  /** Retrieves the current billing plan for a user (defaults to 'free'). */
  getPlan(userId: string): Promise<BillingPlan>;
  /** Sets the billing plan for a user. */
  setPlan(userId: string, plan: BillingPlan): Promise<void>;
}
