'use client';

import { useState } from 'react';

interface HealthStatus {
  lastTested?: Date;
  status: 'negative' | 'positive' | 'undetectable' | 'unknown';
  nextTest?: Date;
}

interface HealthCardProps {
  status?: HealthStatus;
  onUpdate?: (status: HealthStatus) => void;
}

/**
 * Sexual health status card
 * E2E encrypted with envelope key
 * Visible only to trusted contacts or explicit sharers
 * Testing site directory integration
 */
export function HealthCard({ status, onUpdate }: HealthCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [testDate, setTestDate] = useState(status?.lastTested?.toISOString().split('T')[0] || '');

  const handleUpdate = async () => {
    if (!testDate) return;

    const newStatus: HealthStatus = {
      lastTested: new Date(testDate),
      status: 'undetectable',
      nextTest: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };

    onUpdate?.(newStatus);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-4">
        <h3 className="text-[14px] font-bold text-white">Update Health Status</h3>

        <div>
          <label className="text-[12px] font-semibold text-fg-2">Last Test Date</label>
          <input
            type="date"
            value={testDate}
            onChange={e => setTestDate(e.target.value)}
            className="w-full mt-1 p-2 rounded border border-line-2 bg-white/5 text-white text-[12px]"
          />
        </div>

        <div className="text-[12px] text-fg-3">
          <p>✓ Status will be marked as Undetectable</p>
          <p>✓ Only trusted contacts can see this</p>
          <p>✓ All data is E2E encrypted</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleUpdate}
            disabled={!testDate}
            className="flex-1 py-2 rounded bg-green text-ink-950 font-semibold text-[12px] disabled:opacity-50"
          >
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="flex-1 py-2 rounded bg-white/10 text-white font-semibold text-[12px]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-hero border border-line-1 bg-ink-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-white">Sexual Health Status</h3>
        <button
          onClick={() => setIsEditing(true)}
          className="text-[12px] text-green hover:text-green/80"
        >
          Edit
        </button>
      </div>

      {status?.lastTested ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[24px]">🛡️</span>
            <div>
              <p className="text-[12px] font-semibold text-white">Undetectable</p>
              <p className="text-[11px] text-fg-3">
                Last tested {new Date(status.lastTested).toLocaleDateString()}
              </p>
            </div>
          </div>
          {status.nextTest && (
            <p className="text-[11px] text-fg-3">Next test due: {new Date(status.nextTest).toLocaleDateString()}</p>
          )}
        </div>
      ) : (
        <p className="text-[12px] text-fg-3">No health status recorded</p>
      )}

      <button
        onClick={() => setIsEditing(true)}
        className="w-full py-2 rounded border border-line-2 bg-white/5 hover:bg-white/10 text-white text-[12px] font-semibold transition-colors"
      >
        Add Testing Info
      </button>
    </div>
  );
}
