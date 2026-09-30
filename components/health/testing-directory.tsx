'use client';

import { useState, useEffect } from 'react';

interface TestingSite {
  id: string;
  name: string;
  address: string;
  distance: number;
  hours: string;
  tests: string[];
  phone: string;
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
      const res = await fetch('/api/health/testing-sites');
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

  const filtered = sites.filter(site => {
    if (testType === 'all') return true;
    return site.tests.includes(testType);
  });

  return (
    <div className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-6">
      <h2 className="text-[18px] font-bold text-white">Testing Sites</h2>

      <div className="flex gap-2 overflow-x-auto">
        <button
          onClick={() => setTestType('all')}
          className={`px-3 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${
            testType === 'all'
              ? 'bg-green text-ink-950'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          All Tests
        </button>
        <button
          onClick={() => setTestType('STI')}
          className={`px-3 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${
            testType === 'STI'
              ? 'bg-green text-ink-950'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          STI Testing
        </button>
        <button
          onClick={() => setTestType('HIV')}
          className={`px-3 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${
            testType === 'HIV'
              ? 'bg-green text-ink-950'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          HIV Testing
        </button>
        <button
          onClick={() => setTestType('PrEP')}
          className={`px-3 py-2 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors ${
            testType === 'PrEP'
              ? 'bg-green text-ink-950'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          PrEP
        </button>
      </div>

      {loading ? (
        <div className="text-center text-fg-3 py-8">Loading sites...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-fg-3 py-8">No testing sites found</div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {filtered.map(site => (
            <div key={site.id} className="p-3 rounded-lg border border-line-2 bg-white/[0.04]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[14px] font-bold text-white">{site.name}</p>
                  <p className="text-[12px] text-fg-3">{site.address}</p>
                  <p className="text-[11px] text-fg-4 mt-1">{site.hours}</p>
                </div>
                <p className="text-[12px] font-semibold text-green">{site.distance.toFixed(1)} km</p>
              </div>
              <div className="flex gap-2 mt-3">
                <a
                  href={`tel:${site.phone}`}
                  className="flex-1 py-2 rounded text-center bg-green text-ink-950 font-semibold text-[12px]"
                >
                  Call
                </a>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(site.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 rounded text-center bg-white/10 text-white font-semibold text-[12px]"
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
