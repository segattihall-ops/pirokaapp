'use client';

import { useState, useEffect } from 'react';

interface TestingSite {
  id: string;
  name: string;
  address: string;
  zip?: string | null;
  services?: string[] | null;
  cost?: string | null;
  phone?: string | null;
  notes?: string | null;
  verified?: boolean;
}

/**
 * Sexual health testing site directory
 * Filtered by distance and test type
 * Integration with Google Maps for directions
 * Part of sexual health features
 */
export function TestingDirectory() {
  const [sites, setSites] = useState<TestingSite[]>([]);
  const [testType, setTestType] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/testing-sites');
      if (res.ok) {
        const data = await res.json();
        setSites(data.sites || []);
      }
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = sites.filter((site) => {
    if (testType === 'all') return true;
    return (site.services ?? []).some((t) => t.toLowerCase().includes(testType.toLowerCase()));
  });

  return (
    <div className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-6">
      <h2 className="text-[18px] font-bold text-white">Testing Sites</h2>

      <div className="flex gap-2 overflow-x-auto">
        <button
          onClick={() => setTestType('all')}
          className={`whitespace-nowrap rounded-full px-3 py-2 text-[12px] font-semibold transition-colors ${
            testType === 'all' ? 'bg-green text-ink-950' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          All Tests
        </button>
        <button
          onClick={() => setTestType('STI')}
          className={`whitespace-nowrap rounded-full px-3 py-2 text-[12px] font-semibold transition-colors ${
            testType === 'STI' ? 'bg-green text-ink-950' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          STI Testing
        </button>
        <button
          onClick={() => setTestType('HIV')}
          className={`whitespace-nowrap rounded-full px-3 py-2 text-[12px] font-semibold transition-colors ${
            testType === 'HIV' ? 'bg-green text-ink-950' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          HIV Testing
        </button>
        <button
          onClick={() => setTestType('PrEP')}
          className={`whitespace-nowrap rounded-full px-3 py-2 text-[12px] font-semibold transition-colors ${
            testType === 'PrEP' ? 'bg-green text-ink-950' : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          PrEP
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-fg-3">Loading sites...</div>
      ) : filtered.length === 0 ? (
        <div className="py-8 text-center text-fg-3">No testing sites found</div>
      ) : (
        <div className="max-h-[400px] space-y-3 overflow-y-auto">
          {filtered.map((site) => (
            <div key={site.id} className="rounded-lg border border-line-2 bg-white/[0.04] p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[14px] font-bold text-white">{site.name}</p>
                  <p className="text-[12px] text-fg-3">{site.address}</p>
                  <p className="mt-1 text-[11px] text-fg-4">
                    {(site.services ?? []).join(' · ')}
                    {site.cost ? ` · ${site.cost}` : ''}
                  </p>
                  {site.notes && <p className="mt-1 text-[11px] text-fg-4">{site.notes}</p>}
                </div>
                {site.verified && <p className="text-[12px] font-semibold text-green">✓ Verified</p>}
              </div>
              <div className="mt-3 flex gap-2">
                <a
                  href={`tel:${site.phone}`}
                  className="flex-1 rounded bg-green py-2 text-center text-[12px] font-semibold text-ink-950"
                >
                  Call
                </a>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(site.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded bg-white/10 py-2 text-center text-[12px] font-semibold text-white"
                >
                  Directions
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
