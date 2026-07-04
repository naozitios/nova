import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/di/container';

/** Creates a Stripe checkout session for a given price ID and returns the session URL. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { priceId, returnUrl } = body;

    if (!priceId || !returnUrl) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'priceId and returnUrl are required' } }, { status: 400 });
    }

    const sessionUrl = await Container.getBillingAdapter().createCheckoutSession(null, priceId, returnUrl);
    return NextResponse.json({ url: sessionUrl });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } }, { status: 500 });
  }
}
