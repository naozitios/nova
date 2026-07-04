import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/di/container';

/** Creates a Stripe billing portal session for a customer and returns the portal URL. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId, returnUrl } = body;

    if (!customerId || !returnUrl) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'customerId and returnUrl are required' } }, { status: 400 });
    }

    const portalUrl = await Container.getBillingAdapter().createPortalSession(customerId, returnUrl);
    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Unknown error' } }, { status: 500 });
  }
}
