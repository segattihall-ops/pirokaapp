'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type Geo = { lat: number; lon: number };

/** Launch market. Used when neither the permission nor the IP lookup gives a position. */
const FALLBACK: Geo = { lat: 32.7767, lon: -96.797 }; // Dallas, TX

/**
 * Approximate location for the homepage map. Precise geolocation only when the visitor already
 * granted it or asks for it; otherwise a coarse IP lookup, then the launch-market fallback.
 * The precise fix is jittered (~400 m) before it ever touches the canvas.
 */
export function useGeo() {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [label, setLabel] = useState('Locating…');
  const [precise, setPrecise] = useState(false);
  const alive = useRef(true);

  const set = useCallback((lat: number, lon: number, l: string, p: boolean) => {
    if (!alive.current) return;
    const j = p ? 0.004 : 0;
    setGeo({ lat: lat + (Math.random() - 0.5) * j, lon: lon + (Math.random() - 0.5) * j });
    setLabel(l);
    setPrecise(p);
  }, []);

  const requestPrecise = useCallback(() => {
    if (!navigator.geolocation) return;
    setLabel((prev) => {
      const restore = prev === 'Locating…' ? 'Nearby' : prev;
      navigator.geolocation.getCurrentPosition(
        (pos) => set(pos.coords.latitude, pos.coords.longitude, 'Your area', true),
        () => alive.current && setLabel(restore),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
      );
      return 'Locating…';
    });
  }, [set]);

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        if (navigator.permissions) {
          const p = await navigator.permissions.query({ name: 'geolocation' });
          if (p.state === 'granted') return requestPrecise();
        }
      } catch {}
      const tries: [string, (d: Record<string, unknown>) => [number, number, string | undefined]][] = [
        [
          'https://ipapi.co/json/',
          (d) => [Number(d.latitude), Number(d.longitude), d.city as string | undefined],
        ],
        [
          'https://get.geojs.io/v1/ip/geo.json',
          (d) => [Number(d.latitude), Number(d.longitude), d.city as string | undefined],
        ],
      ];
      for (const [u, f] of tries) {
        try {
          const r = await fetch(u);
          if (!r.ok) continue;
          const [la, lo, c] = f(await r.json());
          if (Number.isFinite(la) && Number.isFinite(lo) && la)
            return set(la, lo, c ? `Near ${c}` : 'Near you', false);
        } catch {}
      }
      set(FALLBACK.lat, FALLBACK.lon, 'Dallas', false);
    })();
    return () => {
      alive.current = false;
    };
  }, [requestPrecise, set]);

  return { geo, label, precise, requestPrecise };
}
