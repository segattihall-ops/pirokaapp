'use client';

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPosition, INTENTS, intentMeta, type Position } from '@/lib/geo/client';
import { LOCATION_REFRESH_MS, PRESENCE_HEARTBEAT_MS } from '@/lib/geo/presence';
import { ringDegrees as statusRingDegrees, type Intent as StatusIntent } from '@/lib/intent';
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
const RING_TICK_MS = 30_000;

const FILTERS: { label: string; intent: string | null }[] = [
  { label: 'Everyone', intent: null },
  { label: 'Now', intent: 'now' },
  { label: 'Tonight', intent: 'tonight' },
  { label: 'Hosting', intent: 'hosting' },
  { label: 'Visitors', intent: 'visiting' },
];

type DiscoveryFilters = {
  photosOnly: boolean;
  verifiedOnly: boolean;
  recentOnly: boolean;
  maxDistanceM: number;
};

type MapLayers = {
  people: boolean;
  activity: boolean;
  labels: boolean;
};

const DEFAULT_FILTERS: DiscoveryFilters = {
  photosOnly: false,
  verifiedOnly: false,
  recentOnly: false,
  maxDistanceM: RADIUS_M,
};

const DEFAULT_LAYERS: MapLayers = {
  people: true,
  activity: true,
  labels: true,
};

function escapeUrl(url: string): string {
  return url.replace(/[()'"]/g, '');
}

function pinRingDegrees(p: NearbyPerson, now: number): number {
  if (!p.intent || !p.intentEndsAt) return 360;
  const end = new Date(p.intentEndsAt).getTime();
  if (!Number.isFinite(end) || end <= now) return 8;
  const parsedStart = p.intentStartsAt ? new Date(p.intentStartsAt).getTime() : Number.NaN;
  const start = Number.isFinite(parsedStart) ? parsedStart : end - 2 * 60 * 60_000;
  return statusRingDegrees(
    { intent: p.intent as StatusIntent, startsAt: start, endsAt: end },
    now,
  );
}

function timeLeftLabel(iso: string | null | undefined, now: number): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'ending';
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.ceil(minutes / 60);
  return `${hours}h`;
}

function activityLabel(activity: NearbyPerson['activity']): string {
  if (activity === 'active') return 'active now';
  if (activity === 'recent') return 'recent';
  return 'today';
}

function isRecent(p: NearbyPerson): boolean {
  return p.activity === 'active' || p.activity === 'recent';
}

function matchesDiscoveryFilters(p: NearbyPerson, filters: DiscoveryFilters): boolean {
  if (filters.photosOnly && !p.photo) return false;
  if (filters.verifiedOnly && !p.verified) return false;
  if (filters.recentOnly && !isRecent(p)) return false;
  return p.distanceM <= filters.maxDistanceM;
}

function pinElement(p: NearbyPerson, now: number, showLabels: boolean): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'tap';
  el.style.cssText =
    'background:none;border:0;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;min-width:50px';

  const shell = document.createElement('span');
  shell.dataset.pinShell = 'true';
  shell.style.cssText =
    'position:relative;width:48px;height:48px;border-radius:999px;padding:3px;box-shadow:0 7px 18px rgba(0,0,0,.58);display:block';

  const photo = document.createElement('span');
  photo.dataset.pinPhoto = 'true';
  photo.style.cssText =
    'position:relative;display:flex;width:100%;height:100%;border-radius:999px;border:2px solid #070707;background:#1a1a1a center/cover no-repeat;align-items:center;justify-content:center;font:700 15px/1 Geist,ui-sans-serif,sans-serif;color:#f5f5f5;overflow:hidden';
  shell.appendChild(photo);

  const verified = document.createElement('span');
  verified.dataset.pinVerified = 'true';
  verified.setAttribute('aria-label', 'Verified');
  verified.textContent = '✓';
  verified.style.cssText =
    'position:absolute;right:-3px;bottom:-3px;width:18px;height:18px;border-radius:999px;background:#f5f5f5;color:#070707;display:flex;align-items:center;justify-content:center;font:800 10px/1 Geist,sans-serif;box-shadow:0 0 0 2px #070707';
  shell.appendChild(verified);

  const time = document.createElement('span');
  time.dataset.pinTime = 'true';
  time.style.cssText =
    'position:absolute;left:50%;top:-8px;transform:translateX(-50%);height:18px;padding:0 5px;border-radius:999px;background:#070707;color:#f5f5f5;display:flex;align-items:center;font:700 9px/1 Geist,sans-serif;white-space:nowrap;box-shadow:0 0 0 1px rgba(255,255,255,.12)';
  shell.appendChild(time);

  const live = document.createElement('span');
  live.dataset.pinLive = 'true';
  live.setAttribute('aria-hidden', 'true');
  live.style.cssText =
    'position:absolute;left:-2px;bottom:2px;width:9px;height:9px;border-radius:999px;background:#34d399;box-shadow:0 0 0 2px #070707,0 0 10px rgba(52,211,153,.75)';
  shell.appendChild(live);

  el.appendChild(shell);

  const label = document.createElement('span');
  label.dataset.pinLabel = 'true';
  label.style.cssText =
    'max-width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:999px;background:rgba(7,7,7,.82);padding:3px 7px;font:700 9px/1.15 Geist,ui-sans-serif,sans-serif;text-shadow:0 1px 2px #000';
  el.appendChild(label);

  updatePinElement(el, p, now, showLabels);
  return el;
}

function updatePinElement(
  el: HTMLButtonElement,
  p: NearbyPerson,
  now: number,
  showLabels: boolean,
) {
  const meta = intentMeta(p.intent);
  const color = meta?.color ?? 'rgba(255,255,255,0.38)';
  const degrees = pinRingDegrees(p, now);
  const left = timeLeftLabel(p.intentEndsAt, now);
  const recent = isRecent(p);

  el.setAttribute('aria-label', p.handle ? `@${p.handle}` : 'Member');
  el.dataset.userId = p.id;
  el.dataset.intent = p.intent ?? 'none';
  el.dataset.activity = p.activity;
  el.dataset.distanceM = String(p.distanceM);

  const shell = el.querySelector<HTMLElement>('[data-pin-shell]');
  const photo = el.querySelector<HTMLElement>('[data-pin-photo]');
  const verified = el.querySelector<HTMLElement>('[data-pin-verified]');
  const time = el.querySelector<HTMLElement>('[data-pin-time]');
  const live = el.querySelector<HTMLElement>('[data-pin-live]');
  const label = el.querySelector<HTMLElement>('[data-pin-label]');
  if (!shell || !photo || !verified || !time || !live || !label) return;

  shell.style.background = `conic-gradient(${color} ${degrees}deg,rgba(255,255,255,.14) 0deg)`;
  photo.style.backgroundImage = p.photo ? `url('${escapeUrl(p.photo)}')` : 'none';
  photo.textContent = p.photo ? '' : (p.handle ?? '?').slice(0, 1).toUpperCase();

  verified.hidden = !p.verified;
  time.hidden = !left;
  time.textContent = left;
  live.hidden = !recent;

  label.hidden = !showLabels;
  label.textContent = [meta?.label, activityLabel(p.activity)].filter(Boolean).join(' · ');
  label.style.color = meta?.color ?? '#aaa';
}

function youElement(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', 'You (approximate)');
  el.innerHTML =
    '<span style="display:flex;width:54px;height:54px;border-radius:999px;border:3px solid #34d399;background:#1a1a1a;align-items:center;justify-content:center;font:600 22px/1 Geist,ui-sans-serif,sans-serif;color:#fff;box-shadow:0 0 0 12px rgba(52,211,153,.12),0 6px 16px rgba(0,0,0,.55)">π</span>';
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
  const [intentFilter, setIntentFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState<DiscoveryFilters>(DEFAULT_FILTERS);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [layersOpen, setLayersOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RING_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Deep links: ?user=<id> opens a profile (notifications), ?travel=1 opens travel mode (Me → Trips).
  useEffect(() => {
    const u = params.get('user');
    if (u && /^[0-9a-f-]{36}$/i.test(u)) setSelected({ id: u, distanceM: null });
    if (params.get('travel') === '1') setShowTravel(true);
  }, [params]);

  // 1) position → publish (fuzzed server-side) → fetch nearby
  const locate = useCallback(async (ask: boolean) => {
    // Every POST establishes a new coordinate-capture timestamp, so it must be backed by a
    // fresh browser/IP lookup rather than the session cache.
    const p = await getPosition({ ask, fresh: true });
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

  const heartbeat = useCallback(async () => {
    const r = await fetch('/api/me/location', {
      method: 'PATCH',
      cache: 'no-store',
    }).catch(() => null);
    if (r?.status === 503) setConfigured(false);
  }, []);

  // Travel mode looks at another city; nothing about your own position is published for it.
  const refresh = useCallback(
    async (p: Position | null) => {
      const c = viewRef.current ?? p;
      if (!c) return;
      const r = await fetch(`/api/nearby?lat=${c.lat}&lon=${c.lon}&radius=${RADIUS_M}`, {
        cache: 'no-store',
      }).catch(() => null);
      if (!r?.ok) return;
      const j = (await r.json()) as {
        configured: boolean;
        people: NearbyPerson[];
        hotspots: typeof hotspots;
        visitors?: Visitor[];
      };
      setConfigured(j.configured);
      setPeople(j.people);
      setHotspots(j.hotspots);
      setVisitors(j.visitors ?? []);
      setNow(Date.now());
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
    let refreshTimer: ReturnType<typeof setInterval> | undefined;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    let locationTimer: ReturnType<typeof setInterval> | undefined;
    let currentPosition: Position | null = null;

    const refreshVisible = () => {
      if (alive && document.visibilityState === 'visible') void refresh(currentPosition);
    };
    const heartbeatVisible = () => {
      if (alive && document.visibilityState === 'visible') void heartbeat();
    };
    const republishLocationVisible = async () => {
      if (!alive || document.visibilityState !== 'visible') return;
      // Publishing on resume/timer always forces a fresh lookup; it never re-stamps a cached fix.
      const p = await locate(false);
      if (!alive) return;
      currentPosition = p;
      await refresh(p);
    };
    const resumeVisible = () => {
      if (document.visibilityState === 'visible') void republishLocationVisible();
    };

    (async () => {
      const p = await locate(false);
      if (!alive) return;
      currentPosition = p;
      await refresh(p);
      refreshTimer = setInterval(refreshVisible, REFRESH_MS);
      heartbeatTimer = setInterval(heartbeatVisible, PRESENCE_HEARTBEAT_MS);
      locationTimer = setInterval(() => void republishLocationVisible(), LOCATION_REFRESH_MS);
      document.addEventListener('visibilitychange', resumeVisible);
    })();
    fetch('/api/me/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => alive && setStatus(j.status ?? null))
      .catch(() => {});
    return () => {
      alive = false;
      if (refreshTimer) clearInterval(refreshTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (locationTimer) clearInterval(locationTimer);
      document.removeEventListener('visibilitychange', resumeVisible);
    };
  }, [heartbeat, locate, refresh]);

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
      if (String(e.error?.message ?? '').includes('style') && map.getStyle()?.name !== 'esri')
        map.setStyle(ESRI_STYLE);
    });
    map.on('load', () => {
      map.addSource('hotspots', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
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
    if (mapRef.current && pos) youRef.current?.setLngLat([pos.lon, pos.lat]);
  }, [pos]);

  const filteredPeople = useMemo(
    () =>
      people.filter(
        (p) =>
          (!intentFilter || p.intent === intentFilter) &&
          matchesDiscoveryFilters(p, filters),
      ),
    [people, intentFilter, filters],
  );

  const attributeFilteredPeople = useMemo(
    () => people.filter((p) => matchesDiscoveryFilters(p, filters)),
    [people, filters],
  );

  // 3) pins + activity layer. All coordinates below come from public_geo via nearby_users.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibleIds = new Set(layers.people ? filteredPeople.map((p) => p.id) : []);
    for (const [id, marker] of markersRef.current) {
      if (!visibleIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    if (layers.people) {
      for (const p of filteredPeople) {
        const existing = markersRef.current.get(p.id);
        if (existing) {
          const el = existing.getElement() as HTMLButtonElement;
          updatePinElement(el, p, now, layers.labels);
          existing.setLngLat([p.lon, p.lat]);
          continue;
        }

        const el = pinElement(p, now, layers.labels);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = e.currentTarget as HTMLButtonElement;
          const distanceM = Number(target.dataset.distanceM);
          setSelected({
            id: target.dataset.userId ?? p.id,
            distanceM: viewRef.current || !Number.isFinite(distanceM) ? null : distanceM,
          });
        });
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([p.lon, p.lat])
          .addTo(map);
        // MapLibre assigns its generic "Map marker" label during addTo(). Restore the
        // person-specific accessible name after mounting, then keep mutating this node in place.
        updatePinElement(el, p, now, layers.labels);
        markersRef.current.set(p.id, marker);
      }
    }

    const src = map.getSource('hotspots') as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features: layers.activity
        ? hotspots.map((h) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
            properties: { count: h.count },
          }))
        : [],
    });
  }, [filteredPeople, hotspots, layers, now]);

  const nowCount = attributeFilteredPeople.filter((p) => p.intent === 'now').length;
  const mine = intentMeta(status?.intent);
  const activeFilterCount =
    Number(filters.photosOnly) +
    Number(filters.verifiedOnly) +
    Number(filters.recentOnly) +
    Number(filters.maxDistanceM < RADIUS_M);
  const activeLayerCount = Object.values(layers).filter(Boolean).length;

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setIntentFilter(null);
  };

  return (
    <div
      data-map-user={userId}
      className="relative h-[calc(100dvh-66px-var(--safe-bottom))] w-full overflow-hidden bg-ink-900 rail:h-dvh"
    >
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>
      {!pos && (
        <div className="absolute inset-0 flex items-center justify-center text-[13px] text-fg-3">
          Finding your area…
        </div>
      )}

      {/* Top overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 p-3.5 pr-[64px] pt-[calc(14px+var(--safe-top))] rail:pr-[72px]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowStatus(true)}
            className="tap pointer-events-auto flex min-w-0 items-center gap-2.5 whitespace-nowrap rounded-chip border border-line-2 bg-ink-850/90 px-4 text-[14px] font-medium backdrop-blur-md"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: mine?.color ?? 'transparent',
                border: mine ? 0 : '1px solid #666',
              }}
            />
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

        <div className="pointer-events-auto flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              aria-expanded={layersOpen}
              aria-controls="map-layers-menu"
              onClick={() => {
                setLayersOpen((v) => !v);
                setFiltersOpen(false);
              }}
              className={`tap flex h-10 items-center gap-2 rounded-[14px] border bg-ink-850/90 px-3.5 text-[12px] font-semibold backdrop-blur-md ${
                layersOpen ? 'border-sel-border text-green' : 'border-line-2'
              }`}
            >
              Layers
              <span className="text-[10px] text-fg-3">{activeLayerCount}/3</span>
            </button>
            {layersOpen && (
              <div
                id="map-layers-menu"
                role="menu"
                className="absolute left-0 top-12 z-30 w-[220px] rounded-[16px] border border-line-2 bg-ink-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
              >
                {[
                  ['people', 'People pins'],
                  ['activity', 'Activity glow'],
                  ['labels', 'Pin labels'],
                ].map(([key, label]) => {
                  const on = layers[key as keyof MapLayers];
                  return (
                    <button
                      key={key}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={on}
                      onClick={() =>
                        setLayers((current) => ({
                          ...current,
                          [key]: !current[key as keyof MapLayers],
                        }))
                      }
                      className="tap flex h-11 w-full items-center justify-between rounded-[11px] px-3 text-left text-[13px] hover:bg-white/5"
                    >
                      <span>{label}</span>
                      <span className={on ? 'font-bold text-green' : 'font-bold text-fg-4'}>
                        {on ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  );
                })}
                <p className="px-3 pb-2 pt-1 text-[10px] leading-relaxed text-fg-4">
                  Person pins use privacy-fuzzed map positions only.
                </p>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="map-filter-menu"
              onClick={() => {
                setFiltersOpen((v) => !v);
                setLayersOpen(false);
              }}
              className={`tap relative flex h-10 items-center gap-2 rounded-[14px] border bg-ink-850/90 px-3.5 text-[12px] font-semibold backdrop-blur-md ${
                filtersOpen || activeFilterCount ? 'border-sel-border text-green' : 'border-line-2'
              }`}
            >
              Filter
              {activeFilterCount > 0 && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-green px-1 text-[10px] font-bold text-ink-950">
                  {activeFilterCount}
                </span>
              )}
            </button>
            {filtersOpen && (
              <div
                id="map-filter-menu"
                className="absolute left-0 top-12 z-30 w-[min(330px,calc(100vw-28px))] rounded-[18px] border border-line-2 bg-ink-900/95 p-3.5 shadow-2xl backdrop-blur-xl"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold">Explore people</p>
                    <p className="text-[11px] text-fg-4">{filteredPeople.length} visible on map</p>
                  </div>
                  <button type="button" onClick={resetFilters} className="tap-link text-[11px] font-semibold text-green">
                    Reset
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    ['photosOnly', 'Has a photo', 'Show photo-forward profiles'],
                    ['verifiedOnly', 'Verified', 'Only verified members'],
                    ['recentOnly', 'Recent on map', 'Location refreshed in the last hour'],
                  ].map(([key, label, hint]) => {
                    const on = filters[key as keyof Pick<DiscoveryFilters, 'photosOnly' | 'verifiedOnly' | 'recentOnly'>];
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={Boolean(on)}
                        onClick={() =>
                          setFilters((current) => ({
                            ...current,
                            [key]: !current[key as keyof DiscoveryFilters],
                          }))
                        }
                        className={`tap flex items-center justify-between gap-3 rounded-[13px] border px-3 py-2.5 text-left ${
                          on ? 'border-sel-border bg-sel text-white' : 'border-line-2 bg-white/[0.02]'
                        }`}
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="text-[12px] font-semibold">{label}</span>
                          <span className="text-[10px] text-fg-4">{hint}</span>
                        </span>
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${on ? 'bg-green' : 'bg-fg-4'}`} />
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3">
                  <p className="mb-2 text-[11px] font-semibold text-fg-3">Distance</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      [1609, '1 mi'],
                      [3219, '2 mi'],
                      [RADIUS_M, '3 mi'],
                    ].map(([metres, label]) => (
                      <button
                        key={String(metres)}
                        type="button"
                        aria-pressed={filters.maxDistanceM === metres}
                        onClick={() =>
                          setFilters((current) => ({ ...current, maxDistanceM: Number(metres) }))
                        }
                        className={`tap h-9 rounded-[11px] border text-[11px] font-semibold ${
                          filters.maxDistanceM === metres
                            ? 'border-sel-border bg-sel text-green'
                            : 'border-line-2 text-fg-2'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <span className="ml-auto hidden rounded-full border border-line-1 bg-ink-850/75 px-2.5 py-1.5 text-[10px] text-fg-4 backdrop-blur-md sm:block">
            Approximate locations
          </span>
        </div>

        {view && (
          <div className="pointer-events-auto flex items-center justify-between rounded-input border border-sel-border bg-ink-850/90 px-3 py-2 text-[12px] backdrop-blur-md">
            <span className="truncate">Browsing {view.label}. Your pin stays home.</span>
            <button
              type="button"
              onClick={() => travelTo(null)}
              className="tap-link ml-3 shrink-0 font-semibold text-green"
            >
              Back to me
            </button>
          </div>
        )}

        <div className="pointer-events-auto -mx-3.5 flex gap-2 overflow-x-auto px-3.5 [scrollbar-width:none]">
          {FILTERS.map((f) => {
            const meta = intentMeta(f.intent);
            const active = intentFilter === f.intent;
            const count = attributeFilteredPeople.filter((p) => !f.intent || p.intent === f.intent).length;
            return (
              <button
                key={f.label}
                type="button"
                aria-pressed={active}
                onClick={() => setIntentFilter(f.intent)}
                className={`chip shrink-0 bg-ink-850/90 backdrop-blur-md ${active ? 'chip-selected' : ''}`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: meta?.color ?? (active ? '#34d399' : '#666') }}
                />
                {f.label}
                <span className="text-[10px] text-fg-4">{count}</span>
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
          onClick={() => setIntentFilter(intentFilter === 'now' ? null : 'now')}
          className="tap flex min-w-0 items-center gap-2 rounded-chip border border-line-2 bg-ink-850/90 px-4 text-[14px] font-medium backdrop-blur-md"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-green" />
          <span className="truncate">
            Right now{' '}
            <span className="text-fg-3">
              {nowCount} available · {filteredPeople.length} shown
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
      {selected && (
        <ProfileSheet
          userId={selected.id}
          distanceM={selected.distanceM}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

export { INTENTS };
