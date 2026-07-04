import Stripe from 'stripe';
import { config } from '@/infrastructure/config';

/** Stripe webhook event parser and verifier. */
/** Parses and verifies incoming Stripe webhook events. */
export class StripeWebhookParser {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey, {
      apiVersion: '2026-06-24.dahlia',
    });
  }

  /** Constructs and verifies a Stripe event from the raw body and signature header. */
  parseEvent(body: string, signature: string) {
    return this.stripe.webhooks.constructEvent(body, signature, config.stripe.webhookSecret);
  }
}
