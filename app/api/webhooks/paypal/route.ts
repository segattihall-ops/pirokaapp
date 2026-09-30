/**
 * PayPal webhook endpoint
 * Handles subscription and payment events
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import {
  verifyPayPalWebhook,
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionCancelled,
  handlePaymentCompleted,
  handlePaymentFailed,
} from '@/lib/billing/paypal';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const webhookId = process.env.PAYPAL_WEBHOOK_ID!;

    // Verify webhook signature
    const signatureHeader = request.headers.get('paypal-transmission-sig') || '';
    const isValid = await verifyPayPalWebhook(webhookId, body, signatureHeader);

    if (!isValid) {
      console.warn('Invalid PayPal webhook signature');
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const eventType = body.event_type;

    // Log event
    if (supabaseAdmin) {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: 'SYSTEM',
        action: `paypal_webhook_${eventType}`,
        details: { event_id: body.id, event_type: eventType },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      });
    }

    // Handle different event types
    switch (eventType) {
      case 'billing.subscription.created': {
        const { userId, subscriptionId, plan, status } = handleSubscriptionCreated(body);

        if (supabaseAdmin) await supabaseAdmin.from('users').update({
          plan,
          paypal_subscription_id: subscriptionId,
          subscription_status: status,
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        if (supabaseAdmin) await supabaseAdmin.from('audit_logs').insert({
          user_id: userId,
          action: 'subscription_created',
          details: { plan, subscription_id: subscriptionId, status },
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        });

        break;
      }

      case 'billing.subscription.updated': {
        const { userId, subscriptionId, plan, status } = handleSubscriptionUpdated(body);

        if (supabaseAdmin) await supabaseAdmin.from('users').update({
          plan,
          subscription_status: status,
          updated_at: new Date().toISOString(),
        }).eq('paypal_subscription_id', subscriptionId);

        if (supabaseAdmin) await supabaseAdmin.from('audit_logs').insert({
          user_id: userId,
          action: 'subscription_updated',
          details: { plan, subscription_id: subscriptionId, status },
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        });

        break;
      }

      case 'billing.subscription.cancelled': {
        const { userId, subscriptionId, canceledReason } = handleSubscriptionCancelled(body);

        if (supabaseAdmin) await supabaseAdmin.from('users').update({
          plan: 'free',
          paypal_subscription_id: null,
          subscription_status: 'CANCELLED',
          updated_at: new Date().toISOString(),
        }).eq('paypal_subscription_id', subscriptionId);

        if (supabaseAdmin) await supabaseAdmin.from('audit_logs').insert({
          user_id: userId,
          action: 'subscription_cancelled',
          details: { subscription_id: subscriptionId, reason: canceledReason },
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        });

        break;
      }

      case 'billing.subscription.payment.completed': {
        const { userId, amount, currency, paymentId } = handlePaymentCompleted(body);

        // Record payment
        if (supabaseAdmin) await supabaseAdmin.from('payments').insert({
          user_id: userId,
          payment_id: paymentId,
          amount,
          currency,
          status: 'COMPLETED',
          provider: 'paypal',
        });

        // Update subscription status to active
        if (supabaseAdmin) await supabaseAdmin.from('users').update({
          subscription_status: 'ACTIVE',
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        if (supabaseAdmin) await supabaseAdmin.from('audit_logs').insert({
          user_id: userId,
          action: 'payment_completed',
          details: { payment_id: paymentId, amount, currency },
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        });

        break;
      }

      case 'billing.subscription.payment.failed': {
        const { userId, subscriptionId, failureReason } = handlePaymentFailed(body);

        // Record failed payment
        if (supabaseAdmin) await supabaseAdmin.from('payments').insert({
          user_id: userId,
          payment_id: subscriptionId,
          amount: 0,
          currency: 'USD',
          status: 'FAILED',
          provider: 'paypal',
        });

        // Update subscription status
        if (supabaseAdmin) await supabaseAdmin.from('users').update({
          subscription_status: 'PAYMENT_FAILED',
          updated_at: new Date().toISOString(),
        }).eq('id', userId);

        if (supabaseAdmin) await supabaseAdmin.from('audit_logs').insert({
          user_id: userId,
          action: 'payment_failed',
          details: { subscription_id: subscriptionId, reason: failureReason },
          ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        });

        break;
      }

      default:
        console.log(`Unhandled PayPal event: ${eventType}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PayPal webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
