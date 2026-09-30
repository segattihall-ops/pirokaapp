import { getSession } from '@/lib/auth/server';
import { PAYPAL_PLANS } from '@/lib/billing/paypal';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId } = await request.json();
    if (!planId || typeof planId !== 'string') {
      return Response.json({ error: 'Invalid plan ID' }, { status: 400 });
    }

    // Map plan IDs to PayPal plan IDs
    const paypalPlanId =
      planId === 'plus' ? PAYPAL_PLANS.plus :
      planId === 'premium' ? PAYPAL_PLANS.premium :
      null;

    if (!paypalPlanId) {
      return Response.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Return PayPal plan ID for frontend to use with PayPal Buttons
    return Response.json({
      planId: paypalPlanId,
      customId: session.userId,
      email: session.email,
    });
  } catch (error) {
    console.error('Billing error:', error);
    return Response.json(
      { error: 'Failed to prepare subscription' },
      { status: 500 }
    );
  }
}
