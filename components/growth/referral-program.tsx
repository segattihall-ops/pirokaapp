'use client';

import { useState } from 'react';

interface ReferralStats {
  code: string;
  referred: number;
  verified: number;
  bonus: number;
}

/**
 * Referral program with invite codes
 * Track referrals and earn bonuses
 * Social growth engine for user acquisition
 * Viral loop incentives
 */
export function ReferralProgram({ stats }: { stats?: ReferralStats }) {
  const [copied, setCopied] = useState(false);
  const code = stats?.code || 'SHARE123';
  const referralUrl = `https://piroka.app?ref=${code}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-6">
      <div>
        <h2 className="text-[18px] font-bold text-white">Refer & Earn</h2>
        <p className="text-[12px] text-fg-3 mt-1">Share πroka with friends and earn rewards</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-white/[0.04] border border-line-2">
            <div className="text-[11px] text-fg-3">Invited</div>
            <div className="text-[18px] font-bold text-green">{stats.referred}</div>
          </div>
          <div className="p-2 rounded-lg bg-white/[0.04] border border-line-2">
            <div className="text-[11px] text-fg-3">Verified</div>
            <div className="text-[18px] font-bold text-green">{stats.verified}</div>
          </div>
          <div className="p-2 rounded-lg bg-white/[0.04] border border-line-2">
            <div className="text-[11px] text-fg-3">Bonus</div>
            <div className="text-[18px] font-bold text-green">${stats.bonus}</div>
          </div>
        </div>
      )}

      {/* Share */}
      <div className="space-y-2">
        <label className="text-[12px] font-semibold text-fg-2">Your invite link</label>
        <div className="flex gap-2">
          <input
            value={referralUrl}
            readOnly
            className="flex-1 p-2 rounded-lg bg-white/5 text-white text-[12px] border border-line-2"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2 rounded-lg bg-green text-ink-950 font-bold text-[12px] whitespace-nowrap"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Share Buttons */}
      <div className="flex gap-2">
        <a
          href={`https://twitter.com/intent/tweet?text=Join%20πroka%20${referralUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 rounded-lg bg-[#1DA1F2] text-white font-bold text-[12px] text-center hover:opacity-80"
        >
          Twitter
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${referralUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 rounded-lg bg-[#4267B2] text-white font-bold text-[12px] text-center hover:opacity-80"
        >
          Facebook
        </a>
        <button
          onClick={() => navigator.share?.({ url: referralUrl })}
          className="flex-1 py-2 rounded-lg bg-white/10 text-white font-bold text-[12px] hover:bg-white/20"
        >
          Share
        </button>
      </div>

      <p className="text-[11px] text-fg-4">
        🎁 Earn $5 when friends verify. They get $5 credit too!
      </p>
    </div>
  );
}
