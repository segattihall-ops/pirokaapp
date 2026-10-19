'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConsoleHeader } from '@/components/admin/console/ui';
import { useRole, useToast } from '@/components/admin/console/shell';
import { RISK_COUNTRIES, seedRegions } from '@/lib/admin/ts-seed';

export default function RegionsPage() {
  const { role } = useRole();
  const toast = useToast();
  const admin = role === 'Admin';
  const [configured, setConfigured] = useState(true);
  const [regions, setRegions] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    const r = await fetch('/api/admin/risk-regions', { cache: 'no-store' }).catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as { regions: Record<string, boolean> };
      setConfigured(true);
      // Countries without a row default to off.
      setRegions(Object.fromEntries(RISK_COUNTRIES.map((c) => [c, Boolean(j.regions[c])])));
    } else {
      setConfigured(false);
      setRegions(seedRegions());
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (c: string) => {
    if (!admin) return toast('Only admins can change risk regions.');
    const on = regions[c];
    setRegions((r) => ({ ...r, [c]: !on })); // optimistic
    if (configured) {
      const r = await fetch('/api/admin/risk-regions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: c, enabled: !on }),
      }).catch(() => null);
      if (!r?.ok) {
        setRegions((rr) => ({ ...rr, [c]: on })); // revert
        const j = r ? await r.json().catch(() => null) : null;
        return toast(j?.error ?? 'Could not update the region.');
      }
    }
    toast(`${on ? 'Removed' : 'Added'} ${c} ${on ? 'from' : 'to'} risk regions.`);
  };

  return (
    <>
      <ConsoleHeader title="Risk regions" sub="Automatic protections by country" demo={!configured} />
      <span className="-mt-1.5 text-[13px] text-fg-3">
        In these regions location is widened to Area, photos stay blurred until mutual, and fast meetups are
        flagged.
      </span>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2">
        {RISK_COUNTRIES.map((c) => {
          const on = regions[c];
          return (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className="flex items-center justify-between gap-2.5 rounded-input border px-3.5 py-2.5 text-left text-[13px] font-medium text-fg"
              style={{
                borderColor: on ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.1)',
                background: on ? 'rgba(251,191,36,0.06)' : 'transparent',
              }}
            >
              {c}
              <span className="text-[11px] font-bold" style={{ color: on ? '#fbbf24' : '#666' }}>
                {on ? 'PROTECTED' : 'OFF'}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
