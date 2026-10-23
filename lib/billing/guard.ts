import 'server-only';
import { NextResponse } from 'next/server';
import { BILLING_DISABLED_ERROR, billingEnabled } from './enabled';

/**
 * 503 before any PayPal call when new checkouts are switched off.
 * Returns null when BILLING_ENABLED is exactly "true" so the route continues
 * exactly as it did before the kill switch existed.
 * Do not use this on webhooks, cancellation, or receipts.
 */
export function newCheckoutClosedResponse(): NextResponse | null {
  if (billingEnabled()) return null;
  return NextResponse.json({ error: BILLING_DISABLED_ERROR }, { status: 503 });
}
