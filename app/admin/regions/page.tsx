'use client';

import { useState } from 'react';
import { ConsoleHeader } from '@/components/admin/console/ui';
import { useRole, useToast } from '@/components/admin/console/shell';
import { RISK_COUNTRIES, seedRegions } from '@/lib/admin/ts-seed';

export default function RegionsPage() {
  const { role } = useRole();
  const toast = useToast();
  const admin = role === 'Admin';
  const [regions, setRegions] = useState<Record<string, boolean>>(() => seedRegions());

  const toggle = (c: string) => {
    if (!admin) return toast('Only admins can change risk regions.');
    const on = regions[c];
    setRegions((r) => ({ ...r, [c]: !on }));
    toast(`${on ? 'Removed' : 'Added'} ${c} ${on ? 'from' : 'to'} risk regions.`);
  };

  return (
    <>
      <ConsoleHeader title="Risk regions" sub="Automatic protections by country" demo />
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
              className="flex items-center justify-between gap-2.5 rounded-[12px] border px-3.5 py-2.5 text-left text-[13px] font-medium text-fg"
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
