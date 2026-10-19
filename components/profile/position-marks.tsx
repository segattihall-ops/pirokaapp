'use client';

import { useState } from 'react';
import { POSITION_MARKS, canonicalPositionMark } from '@/lib/design/icon-paths';

interface PositionMarksProps {
  initialMarks?: string[];
  onUpdate?: (marks: string[]) => void;
}

export function PositionMarks({ initialMarks = [], onUpdate }: PositionMarksProps) {
  const [marks, setMarks] = useState<string[]>(initialMarks.map(canonicalPositionMark).filter((m): m is NonNullable<typeof m> => Boolean(m)));
  const [loading, setLoading] = useState(false);

  const positions = POSITION_MARKS;

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
            className={`flex min-h-11 w-full items-center gap-3 rounded-btn border px-3 py-2 text-left text-[12px] transition-colors ${
              marks.includes(pos.id)
                ? 'border-sel-border bg-sel-fill text-fg'
                : 'border-line-2 bg-transparent text-fg-3 hover:border-line-1'
            } disabled:opacity-50`}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={pos.path} /></svg>
            <span className="font-medium">{pos.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
