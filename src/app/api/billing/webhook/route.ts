import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/di/container';

/** Stripe webhook handler: processes subscription lifecycle events (checkout completed, subscription updated/deleted). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    const event = await Container.getStripeWebhookParser().parseEvent(body, signature);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const customerId = session.customer as string;
        const email = session.customer_details?.email || '';
        if (email && customerId) {
          await Container.getBillingStore().setCustomerId(email, customerId);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customer = subscription.customer as string;
        const status = subscription.status;
        if (status === 'active' || status === 'trialing') {
          await Container.getBillingStore().setPlan(customer, 'pro');
        } else {
          await Container.getBillingStore().setPlan(customer, 'free');
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'WEBHOOK_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } },
      { status: 400 }
    );
  }
}
