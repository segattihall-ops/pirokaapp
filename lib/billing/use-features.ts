'use client';

import { useEffect, useState } from 'react';
import type { Plan } from './paypal';
import type { Feature } from './feature-gates';
import { hasFeature } from './feature-gates';

export function useFeatures() {
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/billing/status', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as { plan: Plan };
          setPlan(data.plan);
        }
      } catch (err) {
        console.error('Failed to load plan:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return {
    plan,
    loading,
    hasFeature: (feature: Feature) => hasFeature(plan, feature),
    isPremium: plan === 'premium',
    isPlus: plan === 'plus' || plan === 'premium',
  };
}
