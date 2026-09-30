'use client';

import { useState } from 'react';

/**
 * Smart search with Claude validation
 * API: /api/smart-filter
 * - Takes user prompt (plain language)
 * - Calls Claude with structured prompt
 * - Validates output against allowed options
 * - Returns structured filters
 */
export function SmartFilter() {
  const [prompt, setPrompt] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/smart-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      if (res.ok) {
        const data = await res.json();
        setResults(data);
      } else {
        console.error('Smart search failed');
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
        <label className="text-[12px] font-semibold text-fg-2">What are you looking for?</label>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g., 'Show me guys in their 20s who are into hiking and have verified photos'"
          className="w-full mt-2 p-3 rounded-lg border border-line-2 bg-white/5 text-white text-[14px] placeholder-fg-4 focus:border-green focus:outline-none resize-none"
          rows={3}
        />
      </div>

      <button
        onClick={handleSearch}
        disabled={!prompt.trim() || loading}
        className="w-full py-2 rounded-lg bg-green text-ink-950 font-medium disabled:opacity-50"
      >
        {loading ? 'Searching...' : 'Search'}
      </button>

      {results && (
        <div className="text-[12px] text-fg-3">
          <p>Found {results.count || 0} matches</p>
          {results.filters && (
            <div className="mt-2 space-y-1">
              {Object.entries(results.filters).map(([key, value]) => (
                <p key={key}><span className="font-semibold">{key}:</span> {String(value)}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
