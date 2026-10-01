'use client';

import { useState, useEffect } from 'react';

interface Share {
  owner_id: string;
  grantee_id: string;
  shared_at: string;
}

export function HealthShare() {
  const [owned, setOwned] = useState<Share[]>([]);
  const [granteeId, setGranteeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const fetchShares = async () => {
      try {
        const res = await fetch('/api/health/share');
        if (res.ok) {
          const data = await res.json();
          setOwned(data.owned || []);
        }
      } catch (err) {
        console.error('Failed to load shares:', err);
      }
    };

    fetchShares();
  }, []);

  const handleShare = async () => {
    if (!granteeId) {
      setError('Please enter a user ID');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/health/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granteeId }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to share');
        return;
      }

      setSuccess(`Shared with user`);
      setGranteeId('');

      // Refresh shares
      const res2 = await fetch('/api/health/share');
      if (res2.ok) {
        const data = await res2.json();
        setOwned(data.owned || []);
      }
    } catch (err) {
      setError('Failed to share. Try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnshare = async (id: string) => {
    if (!confirm('Stop sharing with this user?')) return;

    try {
      const res = await fetch(`/api/health/share/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setOwned(owned.filter(s => s.grantee_id !== id));
      }
    } catch (err) {
      console.error('Unshare failed:', err);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-line-1 bg-ink-900 p-4">
      <h3 className="text-[14px] font-semibold text-fg-1">Share Health Status</h3>

      <div className="space-y-3">
        <input
          type="text"
          placeholder="User ID to share with"
          value={granteeId}
          onChange={e => setGranteeId(e.target.value)}
          className="w-full rounded-lg border border-line-2 bg-white/5 px-3 py-2 text-[13px] text-white placeholder-fg-4 focus:border-green focus:outline-none"
        />

        {error && <p className="text-[12px] text-red-400">{error}</p>}
        {success && <p className="text-[12px] text-green">{success}</p>}

        <button
          onClick={handleShare}
          disabled={!granteeId || loading}
          className="w-full rounded-lg bg-green py-2 font-medium text-ink-950 disabled:opacity-50"
        >
          {loading ? 'Sharing...' : 'Share'}
        </button>
      </div>

      {owned.length > 0 && (
        <div className="space-y-2 border-t border-line-1 pt-4">
          <p className="text-[12px] font-medium text-fg-2">Shared with ({owned.length})</p>
          {owned.map(share => (
            <div key={share.grantee_id} className="flex items-center justify-between rounded bg-white/5 p-2">
              <p className="text-[12px] text-fg-3">User: {share.grantee_id.slice(0, 8)}...</p>
              <button
                onClick={() => handleUnshare(share.grantee_id)}
                className="text-[11px] text-fg-4 hover:text-red-400"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-fg-4">
        Only verified health status is shared. Recipients can see your test dates and prevention methods, but never personal
        details.
      </p>
    </div>
  );
}
