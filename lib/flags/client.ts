'use client';

import { useEffect, useState } from 'react';

let cached: Record<string, boolean> | null = null;
let inflight: Promise<Record<string, boolean>> | null = null;

async function loadFlags(): Promise<Record<string, boolean>> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetch('/api/flags', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { flags: {} }))
      .then((j) => (cached = (j.flags ?? {}) as Record<string, boolean>))
      .catch(() => (cached = {}))
      .finally(() => (inflight = null));
  }
  return inflight;
}

/** `const smart = useFlag('smart_search')` — false until loaded, then sticky for the page lifetime. */
export function useFlag(key: string, fallback = false): boolean {
  const [on, setOn] = useState<boolean>(cached?.[key] ?? fallback);
  useEffect(() => {
    let live = true;
    loadFlags().then((f) => live && setOn(f[key] ?? fallback));
    return () => {
      live = false;
    };
  }, [key, fallback]);
  return on;
}
