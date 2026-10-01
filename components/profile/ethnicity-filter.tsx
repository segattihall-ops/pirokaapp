'use client';

import { useState, useEffect } from 'react';

interface EthnicityFilterProps {
  initialEthnicity?: string[];
  onUpdate?: (ethnicity: string[]) => void;
}

const ETHNICITIES = [
  'White', 'Black', 'Latino/Hispanic', 'Asian', 'Middle Eastern', 'Native American',
  'Pacific Islander', 'South Asian', 'East Asian', 'Southeast Asian', 'Mixed',
  'Other'
];

export function EthnicityFilter({ initialEthnicity = [], onUpdate }: EthnicityFilterProps) {
  const [selected, setSelected] = useState<string[]>(initialEthnicity);
  const [loading, setLoading] = useState(false);

  const toggleEthnicity = async (ethnicity: string) => {
    const updated = selected.includes(ethnicity)
      ? selected.filter((e) => e !== ethnicity)
      : [...selected, ethnicity];
    
    setSelected(updated);
    
    setLoading(true);
    try {
      const res = await fetch('/api/me/profile-attrs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ethnicity: updated }),
      });

      if (!res.ok) {
        setSelected(selected);
        console.error('Failed to update ethnicity');
        return;
      }

      onUpdate?.(updated);
    } catch (err) {
      setSelected(selected);
      console.error('Error updating ethnicity:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-[12px] font-semibold text-fg-2">Ethnicity (Optional)</label>
      <div className="grid grid-cols-2 gap-2">
        {ETHNICITIES.map((eth) => (
          <button
            key={eth}
            onClick={() => toggleEthnicity(eth)}
            disabled={loading}
            className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
              selected.includes(eth)
                ? 'border-green bg-green/10 text-fg-1'
                : 'border-line-2 bg-transparent text-fg-3 hover:border-line-1'
            } disabled:opacity-50`}
          >
            {eth}
          </button>
        ))}
      </div>
    </div>
  );
}
