'use client';

import Link from 'next/link';

const LockIcon = ({ size }: { size: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="mx-auto text-green"
    aria-hidden
  >
    <rect x="4" y="10" width="16" height="11" rx="3" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);
import { PLAN_NAMES } from '@/lib/billing/feature-gates';
import type { Plan } from '@/lib/billing/paypal';

interface FeaturePaywallProps {
  featureName: string;
  requiredPlan: Exclude<Plan, 'free'>;
  description?: string;
  fullScreen?: boolean;
}

export function FeaturePaywall({
  featureName,
  requiredPlan,
  description,
  fullScreen = false,
}: FeaturePaywallProps) {
  const planName = PLAN_NAMES[requiredPlan];

  if (fullScreen) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4 py-6">
        <div className="flex max-w-sm flex-col gap-6 text-center">
          <div>
            <LockIcon size={44} />
            <h1 className="mt-2 text-h2">{featureName}</h1>
            <p className="mt-2 text-[14px] text-fg-3">
              {description || `${featureName} is available on ${planName} and above.`}
            </p>
          </div>

          <div className="space-y-3">
            <Link href="/app/me#billing" className="btn-primary w-full">
              Upgrade to {planName}
            </Link>
            <Link href="/app/map" className="btn-secondary w-full">
              Back to app
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass flex flex-col gap-4 rounded-card border border-line-1 px-4 py-6 text-center">
      <div>
        <LockIcon size={32} />
        <h3 className="mt-2 text-[15px] font-semibold text-fg">{featureName}</h3>
        <p className="mt-1 text-[13px] text-fg-3">{description || `Available on ${planName}`}</p>
      </div>

      <Link href="/app/me#billing" className="btn-primary">
        Upgrade to {planName}
      </Link>
    </div>
  );
}
