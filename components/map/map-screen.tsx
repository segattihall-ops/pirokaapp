'use client';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPosition, INTENTS, intentMeta, type Position } from '@/lib/geo/client';
import type { NearbyPerson, Visitor } from '@/app/api/nearby/route';
import { ProfileSheet } from './profile-sheet';
import { StatusSheet, type MyStatus } from './status-sheet';
import { TravelSheet, type TravelView } from './travel-sheet';
import { VisitorsSheet } from './visitors-sheet';

const CARTO_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const ESRI_STYLE =
  'https://basemap.arcgisonline.com/arcgis/rest/services/World_Dark_Gray_Base/VectorTileServer/resources/styles/root.json';
const RADIUS_M = 5000;
const REFRESH_MS = 60_000;

const FILTERS: { label: string; intent: string | null }[] = [
  { label: 'Everyone', intent: null },
  { label: 'Now', intent: 'now' },
  { label: 'Tonight', intent: 'tonight' },
  { label: 'Hosting', intent: 'hosting' },
  { label: 'Visitors', intent: 'visiting' },
];

function pinElement(p: NearbyPerson): HTMLElement {
  const meta = intentMeta(p.intent);
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', p.handle ? `@${p.handle}` : 'Member');
  el.className = 'tap';
  el.style.cssText = 'background:none;border:0;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px';
  const ring = meta ? meta.color : 'rgba(255,255,255,0.35)';
  el.innerHTML = `
    <span style="width:38px;height:38px;border-radius:999px;border:3px solid ${ring};background:#1a1a1a center/cover no-repeat;box-shadow:0 6px 16px rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;font:600 14px/1 Geist,ui-sans-serif,sans-serif;color:#f5f5f5;overflow:hidden;${p.photo ? `background-image:url('${p.photo}')` : ''}">${p.photo ? '' : (p.handle ?? '?').slice(0, 1).toUpperCase()}</span>
    ${meta ? `<span style="font:700 9px/1 Geist,ui-sans-serif,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${meta.color};text-shadow:0 1px 2px #000">${meta.label}</span>` : ''}`;
  return el;
}

function youElement(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', 'You (approximate)');
  el.innerHTML = `<span style="display:flex;width:54px;height:54px;border-radius:999px;border:3px solid #34d399;background:#1a1a1a;align-items:center;justify-content:center;font:600 22px/1 Geist,ui-sans-serif,sans-serif;color:#fff;box-shadow:0 0 0 12px rgba(52,211,153,.12),0 6px 16px rgba(0,0,0,.55)">π</span>`;
  return el;
}

export function MapScreen({ userId }: { userId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const youRef = useRef<maplibregl.Marker | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const [people, setPeople] = useState<NearbyPerson[]>([]);
  const [hotspots, setHotspots] = useState<{ lat: number; lon: number; count: number }[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [status, setStatus] = useState<MyStatus>(null);
  const [selected, setSelected] = useState<{ id: string; distanceM: number | null } | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [notice, setNotice] = useState<string>('');
  const [configured, setConfigured] = useState(true);
  const [view, setView] = useState<TravelView | null>(null);
  const viewRef = useRef<TravelView | null>(null);
  const [showTravel, setShowTravel] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [showVisitors, setShowVisitors] = useState(false);
  const params = useSearchParams();

  // Deep links: ?user=<id> opens a profile (notifications), ?travel=1 opens travel mode (Me → Trips).
  useEffect(() => {
    const u = params.get('user');
    if (u && /^[0-9a-f-]{36}$/i.test(u)) setSelected({ id: u, distanceM: null });
    if (params.get('travel') === '1') setShowTravel(true);
  }, [params]);

  // 1) position → publish (fuzzed server-side) → fetch nearby
  const locate = useCallback(async (ask: boolean) => {
    const p = await getPosition({ ask });
    setPos(p);
    if (!p.precise) setNotice(ask ? 'Location permission denied — showing your approximate area.' : '');
    const r = await fetch('/api/me/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: p.lat, lng: p.lon }),
    }).catch(() => null);
    if (r?.status === 503) setConfigured(false);
    return p;
  }, []);

  // Travel mode looks at another city; nothing about your own position is published for it.
  const refresh = useCallback(
    async (p: Position | null) => {
      const c = viewRef.current ?? p;
      if (!c) return;
      const r = await fetch(`/api/nearby?lat=${c.lat}&lon=${c.lon}&radius=${RADIUS_M}`, { cache: 'no-store' }).catch(() => null);
      if (!r?.ok) return;
      const j = (await r.json()) as { configured: boolean; people: NearbyPerson[]; hotspots: typeof hotspots; visitors?: Visitor[] };
      setConfigured(j.configured);
      setPeople(j.people);
      setHotspots(j.hotspots);
      setVisitors(j.visitors ?? []);
    },
    [],
  );

  const travelTo = useCallback(
    (v: TravelView | null) => {
      viewRef.current = v;
      setView(v);
      const map = mapRef.current;
      const target = v ?? pos;
      if (map && target) map.flyTo({ center: [target.lon, target.lat], zoom: v ? 12 : 13, duration: 900 });
      refresh(pos);
    },
    [pos, refresh],
  );

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      const p = await locate(false);
      if (!alive) return;
      await refresh(p);
      timer = setInterval(() => document.visibilityState === 'visible' && refresh(p), REFRESH_MS);
    })();
    fetch('/api/me/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => alive && setStatus(j.status ?? null))
      .catch(() => {});
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [locate, refresh]);

  // 2) map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !pos) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_STYLE,
      center: [pos.lon, pos.lat],
      zoom: 13,
      attributionControl: false,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('error', (e) => {
      if (String(e.error?.message ?? '').includes('style') && map.getStyle()?.name !== 'esri') map.setStyle(ESRI_STYLE);
    });
    map.on('load', () => {
      map.addSource('hotspots', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'hotspots-glow',
        type: 'circle',
        source: 'hotspots',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 3, 26, 30, 70],
          'circle-color': '#34d399',
          'circle-opacity': 0.14,
          'circle-blur': 0.6,
        },
      });
    });
    const you = youElement();
    youRef.current = new maplibregl.Marker({ element: you }).setLngLat([pos.lon, pos.lat]).addTo(map);
    you.setAttribute('aria-label', 'You (approximate)');
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos !== null]);

  useEffect(() => {
    if (mapRef.current && pos) {
      youRef.current?.setLngLat([pos.lon, pos.lat]);
    }
  }, [pos]);

  // 3) pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const visible = people.filter((p) => !filter || p.intent === filter);
    const keep = new Set(visible.map((p) => p.id));
    for (const [id, m] of markersRef.current) {
      if (!keep.has(id)) {
        m.remove();
        markersRef.current.delete(id);
      }
    }
    for (const p of visible) {
      const existing = markersRef.current.get(p.id);
      if (existing) {
        existing.setLngLat([p.lon, p.lat]);
        continue;
      }
      const el = pinElement(p);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected({ id: p.id, distanceM: viewRef.current ? null : p.distanceM });
      });
      const m = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([p.lon, p.lat]).addTo(map);
      // MapLibre replaces the element's aria-label with "Map marker" on mount; restore the person's.
      el.setAttribute('aria-label', p.handle ? `@${p.handle}` : 'Member');
      el.dataset.userId = p.id;
      markersRef.current.set(p.id, m);
    }
    const src = map.getSource('hotspots') as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features: hotspots.map((h) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
        properties: { count: h.count },
      })),
    });
  }, [people, hotspots, filter]);

  const nowCount = people.filter((p) => p.intent === 'now').length;
  const mine = intentMeta(status?.intent);

  return (
    <div className="relative h-[calc(100dvh-66px-var(--safe-bottom))] w-full overflow-hidden bg-ink-900 rail:h-dvh">
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {!pos && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-fg-3">Finding your area…</div>
      )}

      {/* Top overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 p-3.5 pr-[64px] pt-[calc(14px+var(--safe-top))] rail:pr-[72px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowStatus(true)}
            className="tap pointer-events-auto flex min-w-0 items-center gap-2.5 whitespace-nowrap rounded-chip border border-line-2 bg-ink-850/90 px-4 text-[14px] font-medium backdrop-blur-md"
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: mine?.color ?? 'transparent', border: mine ? 0 : '1px solid #666' }} />
            <span className="truncate">{mine ? `You: ${mine.label}` : 'Set your intent'}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowTravel(true)}
            aria-label="Travel mode"
            className={`tap pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-chip border bg-ink-850/90 px-3.5 text-[13px] font-medium backdrop-blur-md ${
              view ? 'border-sel-border text-green' : 'border-line-2'
            }`}
          >
            ✈️ <span className="max-w-[120px] truncate">{view ? view.label.split(',')[0] : 'Travel'}</span>
          </button>
          {pos && !pos.precise && !view && (
            <button
              type="button"
              onClick={() => locate(true).then(refresh)}
              className="tap pointer-events-auto ml-auto shrink-0 rounded-[14px] border border-line-2 bg-ink-850/90 px-4 text-[13px] font-medium text-green backdrop-blur-md"
            >
              Use my location
            </button>
          )}
        </div>
        {view && (
          <div className="pointer-events-auto flex items-center justify-between rounded-input border border-sel-border bg-ink-850/90 px-3 py-2 text-[12px] backdrop-blur-md">
            <span className="truncate">Browsing {view.label}. Your pin stays home.</span>
            <button type="button" onClick={() => travelTo(null)} className="tap-link ml-3 shrink-0 font-semibold text-green">
              Back to me
            </button>
          </div>
        )}
        <div className="pointer-events-auto -mx-3.5 flex gap-2 overflow-x-auto px-3.5 [scrollbar-width:none]">
          {FILTERS.map((f) => {
            const meta = intentMeta(f.intent);
            const active = filter === f.intent;
            return (
              <button
                key={f.label}
                type="button"
                onClick={() => setFilter(f.intent)}
                className={`chip shrink-0 bg-ink-850/90 backdrop-blur-md ${active ? 'chip-selected' : ''}`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta?.color ?? (active ? '#34d399' : '#666') }} />
                {f.label}
              </button>
            );
          })}
        </div>
        {(notice || !configured) && (
          <p className="pointer-events-auto rounded-input border border-line-2 bg-ink-850/90 px-3 py-2 text-[12px] text-fg-3 backdrop-blur-md">
            {!configured ? 'Discovery needs Supabase — add the keys and run the migrations.' : notice}
          </p>
        )}
      </div>

      {/* Bottom pills */}
      <div className="absolute inset-x-0 bottom-12 flex justify-center gap-2 px-3">
        <button
          type="button"
          onClick={() => setFilter(filter === 'now' ? null : 'now')}
          className="tap flex min-w-0 items-center gap-2 rounded-chip border border-line-2 bg-ink-850/90 px-4 text-[14px] font-medium backdrop-blur-md"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-green" />
          <span className="truncate">
            Right now{' '}
            <span className="text-fg-3">
              {nowCount} available · {people.length} nearby
            </span>
          </span>
        </button>
        {visitors.length > 0 && (
          <button
            type="button"
            onClick={() => setShowVisitors(true)}
            className="tap flex shrink-0 items-center gap-1.5 rounded-chip border border-line-2 bg-ink-850/90 px-3.5 text-[13px] font-medium backdrop-blur-md"
          >
            ✈️ {visitors.length} visiting
          </button>
        )}
      </div>

      {showStatus && (
        <StatusSheet
          status={status}
          onChange={(s) => {
            setStatus(s);
            refresh(pos);
          }}
          onClose={() => setShowStatus(false)}
        />
      )}
      {showTravel && <TravelSheet view={view} onView={travelTo} onClose={() => setShowTravel(false)} />}
      {showVisitors && (
        <VisitorsSheet
          visitors={visitors}
          onOpen={(id) => {
            setShowVisitors(false);
            setSelected({ id, distanceM: null });
          }}
          onClose={() => setShowVisitors(false)}
        />
      )}
      {selected && <ProfileSheet userId={selected.id} distanceM={selected.distanceM} onClose={() => setSelected(null)} />}
    </div>
  );
}

export { INTENTS };
