/** Core billing types: plan identifiers, plan configurations, subscription status, and the predefined plans list. */
/** Billing plan identifiers for the Nova subscription tiers. */
export type BillingPlan = 'free' | 'pro' | 'enterprise';

/** Configuration for a single billing plan including pricing, features, and Stripe price ID. */
export interface BillingPlanConfig {
  id: BillingPlan;
  name: string;
  price: number;
  priceLabel: string;
  features: string[];
  stripePriceId: string;
}

/** The current subscription state for a user, including plan, status, and period end. */
export interface SubscriptionStatus {
  plan: BillingPlan;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

/** Predefined billing plans: Free, Pro, and Enterprise with their configurations. */
export const PLANS: BillingPlanConfig[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceLabel: 'Free',
    features: ['Up to 5 campaigns', 'Basic analytics', 'Meta & Google integration'],
    stripePriceId: '',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 99,
    priceLabel: '$99/mo',
    features: ['Unlimited campaigns', 'Advanced analytics & AI insights', 'AI Campaign Assistant', 'Budget optimization rules', 'Priority support'],
    stripePriceId: '__STRIPE_PRO_PRICE_ID__',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 0,
    priceLabel: 'Custom',
    features: ['Everything in Pro', 'Custom integrations', 'Dedicated support', 'SLA guarantee', 'Custom reporting'],
    stripePriceId: '',
  },
];
