import { headers } from 'next/headers';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/db/client';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe webhook handler
 * Processes subscription events (created, updated, deleted, etc.)
 * Updates user plan in database
 *
 * Events handled:
 * - customer.subscription.created: User upgraded to plan
 * - customer.subscription.updated: Plan changed
 * - customer.subscription.deleted: Subscription cancelled
 * - invoice.payment_succeeded: Payment processed
 * - invoice.payment_failed: Payment failed
 */
export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    return Response.json(
      { error: 'Stripe not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.text();
    const signature = (await headers()).get('stripe-signature') || '';

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (error) {
      console.error('Webhook signature verification failed:', error);
      return Response.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Route event handlers
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return Response.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle subscription created
 * User upgraded to Plus or Premium
 */
async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  if (!supabaseAdmin) return;

  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.warn('No userId in subscription metadata');
    return;
  }

  // Map Stripe price to plan name
  const plan = getPlanFromSubscription(subscription);

  try {
    await supabaseAdmin
      .from('users')
      .update({
        plan,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
      })
      .eq('id', userId);

    console.log(`Subscription created for user ${userId}: ${plan}`);
  } catch (error) {
    console.error(`Failed to create subscription for user ${userId}:`, error);
  }
}

/**
 * Handle subscription updated
 * User changed or renewed plan
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  if (!supabaseAdmin) return;

  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const plan = getPlanFromSubscription(subscription);

  try {
    await supabaseAdmin
      .from('users')
      .update({ plan })
      .eq('id', userId);

    console.log(`Subscription updated for user ${userId}: ${plan}`);
  } catch (error) {
    console.error(`Failed to update subscription for user ${userId}:`, error);
  }
}

/**
 * Handle subscription cancelled
 * User downgraded to free tier
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  if (!supabaseAdmin) return;

  const userId = subscription.metadata?.userId;
  if (!userId) return;

  try {
    await supabaseAdmin
      .from('users')
      .update({
        plan: 'free',
        stripe_subscription_id: null,
      })
      .eq('id', userId);

    console.log(`Subscription cancelled for user ${userId}, downgraded to free`);
  } catch (error) {
    console.error(`Failed to cancel subscription for user ${userId}:`, error);
  }
}

/**
 * Handle payment succeeded
 * Invoice paid successfully
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  if (!supabaseAdmin) return;

  const userId = invoice.metadata?.userId;
  if (!userId) return;

  try {
    // Log successful payment
    await supabaseAdmin.from('audit_log').insert({
      moderator_id: 'system',
      target_user_id: userId,
      action: 'payment_succeeded',
      details: {
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
      },
      created_at: new Date().toISOString(),
    });

    console.log(`Payment succeeded for user ${userId}: $${(invoice.amount_paid / 100).toFixed(2)}`);
  } catch (error) {
    console.error(`Failed to log payment for user ${userId}:`, error);
  }
}

/**
 * Handle payment failed
 * Invoice payment failed
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  if (!supabaseAdmin) return;

  const userId = invoice.metadata?.userId;
  if (!userId) return;

  try {
    // Log failed payment
    await supabaseAdmin.from('audit_log').insert({
      moderator_id: 'system',
      target_user_id: userId,
      action: 'payment_failed',
      details: {
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_due,
        currency: invoice.currency,
        error: invoice.last_finalization_error?.message,
      },
      created_at: new Date().toISOString(),
    });

    console.log(`Payment failed for user ${userId}: ${invoice.last_finalization_error?.message}`);
  } catch (error) {
    console.error(`Failed to log payment failure for user ${userId}:`, error);
  }
}

/**
 * Map Stripe subscription to plan name
 * Looks at price IDs to determine Plus or Premium
 */
function getPlanFromSubscription(subscription: Stripe.Subscription): 'free' | 'plus' | 'premium' {
  const priceId = subscription.items.data[0]?.price.id;

  if (!priceId) return 'free';

  const plusPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS;
  const premiumPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM;

  if (priceId === plusPriceId) return 'plus';
  if (priceId === premiumPriceId) return 'premium';

  return 'free';
}
