'use client';

import { useState } from 'react';
import type { ModerationResult } from '@/lib/ai/types';

export function ModerationAssist() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ModerationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCheck = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/moderation/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data.moderation);
      } else {
        console.error('Moderation check failed');
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-4">
      <div>
        <label className="text-[12px] font-semibold text-fg-2">Check message</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Enter text to check for moderation violations..."
          className="w-full mt-2 p-3 rounded-lg border border-line-2 bg-white/5 text-white text-[14px] placeholder-fg-4 focus:border-green focus:outline-none resize-none"
          rows={3}
          maxLength={5000}
        />
        <p className="text-[10px] text-fg-4 mt-1">{text.length}/5000</p>
      </div>

      <button
        onClick={handleCheck}
        disabled={!text.trim() || loading}
        className="w-full py-2 rounded-lg bg-green text-ink-950 font-medium disabled:opacity-50"
      >
        {loading ? 'Checking...' : 'Check'}
      </button>

      {result && (
        <div className="text-[12px] space-y-2 p-3 rounded-lg bg-white/5">
          <div className={`font-semibold ${result.safe ? 'text-green' : 'text-red-400'}`}>
            {result.safe ? '✓ Safe' : '⚠ Contains violations'}
          </div>

          {result.flags.length > 0 && (
            <div className="space-y-1">
              {result.flags.map((flag, i) => (
                <div key={i} className="text-fg-3">
                  <div className="font-medium capitalize">{flag.category}</div>
                  <div className="text-[10px] text-fg-4">Confidence: {(flag.confidence * 100).toFixed(0)}%</div>
                  <div className="text-[10px] text-fg-4">{flag.reason}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
