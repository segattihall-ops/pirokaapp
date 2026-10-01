'use client';

import { useState, useEffect } from 'react';

interface HealthCard {
  id: string;
  status: 'unverified' | 'pending' | 'verified' | 'rejected';
  hiv_month?: number;
  sti_month?: number;
  prevention?: string[];
  visibility: 'private' | 'verified_only' | 'everyone';
  verified_month?: number;
  verified_tests?: string[];
  created_at: string;
}

export function HealthCardDisplay() {
  const [card, setCard] = useState<HealthCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCard = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setCard(data.card);
        }
      } catch (error) {
        console.error('Failed to load health card:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCard();
  }, []);

  if (loading) {
    return <div className="text-center text-fg-3">Loading health status...</div>;
  }

  if (!card) {
    return <div className="text-center text-fg-4">No health card yet. Upload your test results to get started.</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <span className="rounded bg-green/20 px-2 py-1 text-[12px] font-medium text-green">✓ Verified</span>;
      case 'pending':
        return <span className="rounded bg-yellow/20 px-2 py-1 text-[12px] font-medium text-yellow">⏳ Pending review</span>;
      case 'rejected':
        return <span className="rounded bg-red-400/20 px-2 py-1 text-[12px] font-medium text-red-300">✗ Rejected</span>;
      default:
        return <span className="rounded bg-fg-4/20 px-2 py-1 text-[12px] font-medium text-fg-3">Unverified</span>;
    }
  };

  return (
    <div className="rounded-lg border border-line-1 bg-ink-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-semibold text-fg-1">Health Status</h3>
        {getStatusBadge(card.status)}
      </div>

      <div className="mt-4 space-y-3">
        {card.hiv_month !== undefined && (
          <div className="text-[12px]">
            <p className="font-medium text-fg-2">HIV Test</p>
            <p className="text-fg-4">Last tested: {card.hiv_month} month{card.hiv_month !== 1 ? 's' : ''} ago</p>
          </div>
        )}

        {card.sti_month !== undefined && (
          <div className="text-[12px]">
            <p className="font-medium text-fg-2">STI Test</p>
            <p className="text-fg-4">Last tested: {card.sti_month} month{card.sti_month !== 1 ? 's' : ''} ago</p>
          </div>
        )}

        {card.prevention && card.prevention.length > 0 && (
          <div className="text-[12px]">
            <p className="font-medium text-fg-2">Prevention</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {card.prevention.map(p => (
                <span key={p} className="rounded-full bg-green/20 px-2 py-0.5 text-green capitalize">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="text-[11px] text-fg-4">
          Visibility: <span className="capitalize">{card.visibility.replace('_', ' ')}</span>
        </div>
      </div>
    </div>
  );
}
