import { getSession } from '@/lib/auth/server';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!stripe) {
      return Response.json({ error: 'Billing not configured' }, { status: 503 });
    }

    const { priceId } = await request.json();
    if (!priceId || typeof priceId !== 'string') {
      return Response.json({ error: 'Invalid price ID' }, { status: 400 });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer_email: session.email ?? undefined,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXTAUTH_URL}/app/account?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXTAUTH_URL}/app/me`,
      metadata: {
        userId: session.userId,
      },
    });

    if (!checkoutSession.url) {
      throw new Error('No checkout URL generated');
    }

    return Response.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return Response.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
