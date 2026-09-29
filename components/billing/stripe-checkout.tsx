'use client';

import { useState } from 'react';

interface Plan {
  id: 'plus' | 'premium';
  name: string;
  price: number;
  features: string[];
  priceId: string;
}

const PLANS: Plan[] = [
  {
    id: 'plus',
    name: 'Plus',
    price: 5,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PLUS || '',
    features: [
      'Unlimited albums (5 photos)',
      'Saved trips',
      'Priority support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 10,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PREMIUM || '',
    features: [
      'Everything in Plus',
      'Taste learning & match scoring',
      'Smart search with AI',
      'Early access to new features',
    ],
  },
];

/**
 * Stripe Checkout for Plus ($5) and Premium ($10)
 * Webhooks update users.plan
 * Plus: album limits (5) + saved trips
 * Premium: taste learning + smart search
 */
export function StripeCheckout() {
  const [selectedPlan, setSelectedPlan] = useState<'plus' | 'premium'>('plus');
  const [isLoading, setIsLoading] = useState(false);

  const handleCheckout = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: PLANS.find(p => p.id === selectedPlan)?.priceId }),
      });

      if (res.ok) {
        const { url } = await res.json();
        window.location.href = url;
      }
    } catch (error) {
      console.error('Checkout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 rounded-hero border border-line-1 bg-ink-900 p-6">
      <div>
        <h2 className="text-[20px] font-bold text-white mb-2">Upgrade to Plus or Premium</h2>
        <p className="text-[14px] text-fg-3">Unlock advanced features and support πroka</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {PLANS.map(plan => (
          <button
            key={plan.id}
            onClick={() => setSelectedPlan(plan.id)}
            className={`p-4 rounded-lg border-2 transition-colors text-left ${
              selectedPlan === plan.id
                ? 'border-green bg-white/[0.08]'
                : 'border-line-2 bg-white/[0.04] hover:border-line-1'
            }`}
          >
            <div className="text-[16px] font-bold text-white">{plan.name}</div>
            <div className="text-[20px] font-bold text-green mt-1">${plan.price}/mo</div>
            <ul className="text-[12px] text-fg-3 mt-3 space-y-1">
              {plan.features.slice(0, 2).map((feature, i) => (
                <li key={i}>✓ {feature}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <button
        onClick={handleCheckout}
        disabled={isLoading}
        className="w-full py-3 rounded-lg bg-green text-ink-950 font-bold disabled:opacity-50"
      >
        {isLoading ? 'Processing...' : 'Continue to Stripe'}
      </button>
    </div>
  );
}
