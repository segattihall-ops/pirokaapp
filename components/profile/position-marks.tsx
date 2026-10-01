'use client';

import { useState, useEffect } from 'react';

interface PositionMarksProps {
  initialMarks?: string[];
  onUpdate?: (marks: string[]) => void;
}

export function PositionMarks({ initialMarks = [], onUpdate }: PositionMarksProps) {
  const [marks, setMarks] = useState<string[]>(initialMarks);
  const [loading, setLoading] = useState(false);

  const positions = [
    { id: 'top', label: 'Top', description: 'Prefer receptive/penetrative' },
    { id: 'versatile', label: 'Versatile', description: 'Enjoy both roles' },
    { id: 'bottom', label: 'Bottom', description: 'Prefer penetrative' },
  ];

  const toggleMark = async (mark: string) => {
    const updated = marks.includes(mark) ? marks.filter((m) => m !== mark) : [...marks, mark];
    setMarks(updated);
    
    setLoading(true);
    try {
      const res = await fetch('/api/me/profile-attrs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionMarks: updated }),
      });

      if (!res.ok) {
        setMarks(marks);
        console.error('Failed to update position marks');
        return;
      }

      onUpdate?.(updated);
    } catch (err) {
      setMarks(marks);
      console.error('Error updating position marks:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-[12px] font-semibold text-fg-2">Position Marks</label>
      <div className="space-y-2">
        {positions.map((pos) => (
          <button
            key={pos.id}
            onClick={() => toggleMark(pos.id)}
            disabled={loading}
            className={`w-full rounded-lg border px-3 py-2 text-left text-[12px] transition-colors ${
              marks.includes(pos.id)
                ? 'border-green bg-green/10 text-fg-1'
                : 'border-line-2 bg-transparent text-fg-3 hover:border-line-1'
            } disabled:opacity-50`}
          >
            <div className="font-medium">{pos.label}</div>
            <div className="text-fg-4 text-[11px]">{pos.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
