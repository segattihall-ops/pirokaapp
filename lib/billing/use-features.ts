'use client';

import { useEffect, useState } from 'react';
import type { Plan } from './paypal';
import type { Feature } from './feature-gates';
import { hasFeature } from './feature-gates';

export function useFeatures() {
  const [plan, setPlan] = useState<Plan>('free');
  // Launch window: everyone gets every feature until it closes (billing plan is unchanged).
  const [allAccess, setAllAccess] = useState(false);
  const [allAccessUntil, setAllAccessUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/billing/status', { cache: 'no-store' });
        if (res.ok) {
          const data = (await res.json()) as {
            plan: Plan;
            allAccess?: boolean;
            allAccessUntil?: string | null;
          };
          setPlan(data.plan);
          setAllAccess(Boolean(data.allAccess));
          setAllAccessUntil(data.allAccessUntil ?? null);
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
    allAccess,
    allAccessUntil,
    hasFeature: (feature: Feature) => allAccess || hasFeature(plan, feature),
    isPremium: allAccess || plan === 'premium',
    isPlus: allAccess || plan === 'plus' || plan === 'premium',
  };
}
