'use client';

import maplibregl from 'maplibre-gl';
import { CARTO_FALLBACK_STYLE, PIROKA_BASEMAP_STYLE } from './basemap-style';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { getPosition, intentMeta, type Position } from '@/lib/geo/client';
import { LOCATION_REFRESH_MS, PRESENCE_HEARTBEAT_MS } from '@/lib/geo/presence';
import { INTENT_CHIPS, fmtDur, matchesIntentChip, type IntentChip } from '@/lib/intent';
import { useFlag } from '@/lib/flags/client';
import type { NearbyPerson, Visitor } from '@/app/api/nearby/route';
import { ProfileSheet } from './profile-sheet';
import { StatusSheet, type MyStatus } from './status-sheet';
import { FilterSheet } from './filter-sheet';
import { MyCardSheet } from './my-card-sheet';
import { TravelSheet, type TravelView } from './travel-sheet';
import { VisitorsSheet } from './visitors-sheet';
import { AssistantPanel } from './assistant-panel';
import { EMPTY_FILTERS, POSITION_LABEL, activeFilterCount, matchesFilters, type Filters } from './filters';
import { distanceLabel } from '@/lib/geo/client';
import { NAV_ICON_PATHS } from '@/lib/design/icon-paths';
import { approx, tripText, isPopping, isSelfPinVisible } from '@/lib/map/pin-anatomy';
import {
  pinElement,
  updatePinElement,
  youElement,
  updateYouElement,
  pinRingDegrees,
  timeLeftLabel,
} from './pins';
import { placePinElement, eventPinElement, arrivalPinElement, hotspotLabelElement, flagUrl } from './place-pins';
import { DemoProfileSheet } from './demo-profile-sheet';
import { demoWorld, type DemoArrival, type DemoEvent, type DemoPlace } from '@/lib/demo/presence';
import { promosFor, type Promo } from './promos';

const ESRI_STYLE = PIROKA_BASEMAP_STYLE;
const CARTO_STYLE = CARTO_FALLBACK_STYLE;
const RADIUS_M = 5000;
const FREE_M = 3219; // 2 miles — Free members open profiles within this ring (prototype FREE_M).
const REFRESH_MS = 60_000;
const RING_TICK_MS = 30_000;

type MapLayers = { people: boolean; activity: boolean; labels: boolean };
// Labels default off: the prototype keeps map pins clean (name/time surface in the hover card and profile).
const DEFAULT_LAYERS: MapLayers = { people: true, activity: true, labels: false };

type DesperateState = {
  allowed: boolean;
  active: { until: string; reached: number } | null;
  nextAt: string | null;
};

/** At a scrubbed time T, is this person on the map? Looking people always; others when their window covers T. */
function availableAt(p: NearbyPerson, T: number, scrubbed: boolean): boolean {
  if (!scrubbed) return true;
  if (p.intent === 'looking') return true;
  if (!p.intentEndsAt) return false;
  const end = new Date(p.intentEndsAt).getTime();
  const start = p.intentStartsAt ? new Date(p.intentStartsAt).getTime() : end - 2 * 60 * 60_000;
  return start <= T && T < end;
}

const EMPTY_ATTRS = {
  gender: [],
  orientation: [],
  communities: [],
  ethnicity: [],
  position: [],
  origin: null,
};
/** Pin builders read attrs; tolerate a partial person (e.g. a test mock) and honour the position toggle. */
/** Map the backend place kinds onto the six glyphs the pin builder draws. */
function normalizeKind(kind: string): DemoPlace['kind'] {
  const k = kind.toLowerCase();
  if (k === 'club') return 'club';
  if (k === 'sauna') return 'sauna';
  if (k === 'park' || k === 'beach') return 'park';
  if (k === 'cafe' || k === 'restaurant' || k === 'shop') return 'cafe';
  if (k === 'gym') return 'gym';
  return 'bar';
}

function withPos(p: NearbyPerson, showPosition: boolean): NearbyPerson {
  const attrs = p.attrs ?? EMPTY_ATTRS;
  return { ...p, attrs: { ...attrs, position: showPosition ? (attrs.position ?? []) : [] } };
}

export function MapScreen({ userId }: { userId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const placeMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const hotspotMarkersRef = useRef<maplibregl.Marker[]>([]);
  const youRef = useRef<maplibregl.Marker | null>(null);
  const [pos, setPos] = useState<Position | null>(null);
  const [people, setPeople] = useState<NearbyPerson[]>([]);
  const [hotspots, setHotspots] = useState<{ lat: number; lon: number; count: number; up?: boolean }[]>([]);
  const [places, setPlaces] = useState<DemoPlace[]>([]);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [arrivals, setArrivals] = useState<DemoArrival[]>([]);
  const [demo, setDemo] = useState(false);
  const [interested, setInterested] = useState<NearbyPerson | null>(null);
  const [selfCard, setSelfCard] = useState<{ handle: string | null; photo: string | null; visibility: string | null }>({
    handle: null,
    photo: null,
    visibility: null,
  });
  const [chip, setChip] = useState<IntentChip>('all');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showPosition, setShowPosition] = useState(true);
  const [layers, setLayers] = useState<MapLayers>(DEFAULT_LAYERS);
  const [demand, setDemand] = useState(false);
  const [showPlaces, setShowPlaces] = useState(true);
  const router = useRouter();
  const [layersOpen, setLayersOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [scrub, setScrub] = useState(0); // minutes 0..360
  const [scrubOpen, setScrubOpen] = useState(false);
  const [status, setStatus] = useState<MyStatus>(null);
  const [plan, setPlan] = useState('free');
  const [desperate, setDesperate] = useState<DesperateState | null>(null);
  const [despFlash, setDespFlash] = useState(false);
  const [selected, setSelected] = useState<{ id: string; distanceM: number | null } | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showMyCard, setShowMyCard] = useState(false);
  const [notice, setNotice] = useState('');
  const [configured, setConfigured] = useState(true);
  const [view, setView] = useState<TravelView | null>(null);
  const viewRef = useRef<TravelView | null>(null);
  const layersButtonRef = useRef<HTMLButtonElement>(null);
  const layersMenuRef = useRef<HTMLDivElement>(null);
  const layersInitialFocusRef = useRef<'first' | 'last'>('first');
  const [showTravel, setShowTravel] = useState(false);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [showVisitors, setShowVisitors] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [promo, setPromo] = useState<Promo | null>(null);
  const promoSeenRef = useRef<Set<string>>(new Set());
  const ethnicityEnabled = useFlag('ethnicity_filter', true);
  const params = useSearchParams();
  // Simulated presence is a development aid; production never paints fake people over the live map.
  const forceDemo = process.env.NODE_ENV !== 'production' && params.get('demo') === '1';

  const scrubbed = scrub > 0;
  const T = now + scrub * 60_000;
  const free = plan === 'free' || plan === 'anonymous';
  const premium = plan === 'premium';

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), RING_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Deep links: ?user=<id> opens a profile (from a notification), ?travel=1 opens travel mode.
  useEffect(() => {
    const u = params.get('user');
    if (u && /^[0-9a-f-]{36}$/i.test(u)) setSelected({ id: u, distanceM: null });
    if (params.get('travel') === '1') setShowTravel(true);
  }, [params]);

  useEffect(() => {
    if (!layersOpen) return;
    const frame = requestAnimationFrame(() => {
      const items = Array.from(
        layersMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]') ?? [],
      );
      const target = layersInitialFocusRef.current === 'last' ? items[items.length - 1] : items[0];
      target?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [layersOpen]);

  // 1) position → publish (fuzzed server-side) → fetch nearby
  const locate = useCallback(async (ask: boolean) => {
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
    const r = await fetch('/api/me/location', { method: 'PATCH', cache: 'no-store' }).catch(() => null);
    if (r?.status === 503) setConfigured(false);
  }, []);

  const refresh = useCallback(
    async (p: Position | null) => {
      const c = viewRef.current ?? p;
      if (!c) return;
      const r = await fetch(`/api/nearby?lat=${c.lat}&lon=${c.lon}&radius=${RADIUS_M}`, {
        cache: 'no-store',
      }).catch(() => null);
      const j = r?.ok
        ? ((await r.json()) as {
            configured: boolean;
            people: NearbyPerson[];
            hotspots: typeof hotspots;
            visitors?: Visitor[];
          })
        : { configured: false, people: [], hotspots: [], visitors: [] };

      // No backend (or ?demo=1) → fill the map with simulated presence instead of leaving it empty.
      if (forceDemo || !j.configured) {
        const w = demoWorld({ lat: c.lat, lon: c.lon });
        setDemo(true);
        setConfigured(true);
        setPeople(w.people);
        setHotspots(w.hotspots);
        setPlaces(w.places);
        setEvents(w.events);
        setArrivals(w.arrivals);
        setVisitors(
          w.arrivals.map((a) => ({
            id: a.id,
            handle: a.handle,
            city: '',
            arriveOn: '',
            nights: 0,
            photo: null,
            lat: a.lat,
            lon: a.lon,
          })),
        );
        setNow(Date.now());
        return;
      }

      setDemo(false);
      setConfigured(true);
      setPeople(j.people);
      setHotspots(j.hotspots);
      setVisitors(j.visitors ?? []);
      setArrivals(
        (j.visitors ?? [])
          .filter((v) => v.lat != null && v.lon != null)
          .map((v) => ({
            id: v.id,
            handle: v.handle ?? '',
            lat: v.lat as number,
            lon: v.lon as number,
            originCode: v.originCode ?? null,
            when: tripText({ arriveOn: v.arriveOn, nights: v.nights, arrivalTime: v.arrivalTime, departOn: v.departOn, departureTime: v.departureTime }),
          })),
      );
      setNow(Date.now());

      // Real place and event pins, from the APIs that already carry coordinates. Fire-and-forget so this never
      // delays the caller (the startup sequence attaches the visibilitychange listener right after refresh).
      void (async () => {
        const [pr, ev] = await Promise.all([
          fetch(`/api/places?lat=${c.lat}&lon=${c.lon}&radius=${RADIUS_M}`, { cache: 'no-store' }).catch(
            () => null,
          ),
          fetch(`/api/events?lat=${c.lat}&lon=${c.lon}&radius=6`, { cache: 'no-store' }).catch(() => null),
        ]);
        if (pr?.ok) {
          const pj = (await pr.json().catch(() => ({}))) as {
            places?: {
              id: string;
              name: string;
              kind: string;
              lat: number;
              lon: number;
              here: number;
              going: number;
              popVotes?: number;
            }[];
          };
          setPlaces(
            (pj.places ?? []).map((x) => ({
              id: x.id,
              name: x.name,
              kind: normalizeKind(x.kind),
              lat: x.lat,
              lon: x.lon,
              here: x.here,
              arriving: x.going,
              popping: isPopping(x.popVotes ?? 0),
              popCount: x.popVotes ?? 0,
              peak: '',
            })),
          );
        } else {
          setPlaces([]);
        }
        if (ev?.ok) {
          const ej = (await ev.json().catch(() => ({}))) as {
            events?: {
              id: string;
              title: string;
              lat?: number;
              lon?: number;
              starts_at: string;
              attendee_count?: number;
            }[];
          };
          const today = new Date().toDateString();
          setEvents(
            (ej.events ?? [])
              .filter((e) => e.lat != null && e.lon != null && new Date(e.starts_at).toDateString() === today)
              .map((e) => ({
                id: e.id,
                name: e.title,
                lat: e.lat as number,
                lon: e.lon as number,
                time: new Date(e.starts_at).toLocaleTimeString([], { hour: 'numeric' }),
                going: e.attendee_count ?? 0,
              })),
          );
        } else {
          setEvents([]);
        }
      })();
    },
    [forceDemo],
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
    fetch('/api/billing/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => alive && setPlan(j.plan ?? 'free'))
      .catch(() => {});
    fetch('/api/me/desperate', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && j && setDesperate(j))
      .catch(() => {});
    // Your own handle and main photo, for the self-pin "Your profile" card.
    fetch(`/api/users/${userId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        const main = (j.photos ?? []).find((x: { slot: number }) => x.slot === 0);
        setSelfCard({ handle: j.handle ?? null, photo: main?.url ?? null, visibility: j.visibility ?? null });
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (refreshTimer) clearInterval(refreshTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (locationTimer) clearInterval(locationTimer);
      document.removeEventListener('visibilitychange', resumeVisible);
    };
  }, [heartbeat, locate, refresh, userId]);

  // 2) map
  useEffect(() => {
    if (!containerRef.current || mapRef.current || !pos) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: ESRI_STYLE,
      center: [pos.lon, pos.lat],
      zoom: 13,
      attributionControl: false,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('error', (e) => {
      if (String(e.error?.message ?? '').includes('style') && map.getStyle()?.name === 'Piroka Esri Dark Gray')
        map.setStyle(CARTO_STYLE);
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
      map.addSource('demand', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'demand-heat',
        type: 'circle',
        source: 'demand',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'weight'], 1, 30, 8, 90],
          'circle-color': '#34d399',
          'circle-opacity': ['interpolate', ['linear'], ['get', 'weight'], 1, 0.06, 8, 0.4],
          'circle-blur': 1,
        },
      });
    });
    const you = youElement();
    // Default invisible until the self-only visibility preference is loaded.
    you.style.display = 'none';
    youRef.current = new maplibregl.Marker({ element: you }).setLngLat([pos.lon, pos.lat]).addTo(map);
    you.setAttribute('aria-label', 'You (approximate)');
    you.addEventListener('click', (e) => {
      e.stopPropagation();
      setShowMyCard(true);
    });
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

  // Self pin reflects your current intent ring and the red Desperate ring.
  // A Hidden location (or an unknown visibility on API failure) shows no dot at all.
  useEffect(() => {
    const el = youRef.current?.getElement();
    if (!el) return;
    el.style.display = isSelfPinVisible(selfCard.visibility) ? '' : 'none';
    const meta = intentMeta(status?.intent);
    const degrees = status
      ? pinRingDegrees(
          {
            intent: status.intent as NearbyPerson['intent'],
            intentStartsAt: status.starts_at,
            intentEndsAt: status.ends_at,
          } as NearbyPerson,
          now,
        )
      : 360;
    const left = status?.ends_at ? timeLeftLabel(status.ends_at, now) : '';
    const label = meta ? meta.label + (left ? ` · ${left}` : '') : 'You';
    updateYouElement(el, {
      color: '#34d399',
      degrees,
      photo: selfCard.photo,
      desperate: Boolean(desperate?.active),
      label,
    });
  }, [status, now, desperate, selfCard.photo, selfCard.visibility]);

  const searchFiltered = useMemo(() => people.filter((p) => matchesFilters(p, filters)), [people, filters]);
  const shown = useMemo(
    () => searchFiltered.filter((p) => matchesIntentChip(p.intent, chip) && availableAt(p, T, scrubbed)),
    [searchFiltered, chip, T, scrubbed],
  );

  // 3) pins + layers. All coordinates below come from public_geo via nearby_users.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const visibleIds = new Set(layers.people ? shown.map((p) => p.id) : []);
    for (const [id, marker] of markersRef.current) {
      if (!visibleIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    }

    if (layers.people) {
      for (const p of shown) {
        const existing = markersRef.current.get(p.id);
        if (existing) {
          const el = existing.getElement() as HTMLButtonElement;
          updatePinElement(el, withPos(p, showPosition), now, layers.labels);
          existing.setLngLat([p.lon, p.lat]);
          continue;
        }
        const el = pinElement(withPos(p, showPosition), now, layers.labels);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const target = e.currentTarget as HTMLButtonElement;
          const distanceM = Number(target.dataset.distanceM);
          setSelected({
            id: target.dataset.userId ?? p.id,
            distanceM: viewRef.current || !Number.isFinite(distanceM) ? null : distanceM,
          });
        });
        el.addEventListener('mouseenter', () => {
          if (window.matchMedia?.('(hover: hover)').matches) setHoverId(p.id);
        });
        el.addEventListener('mouseleave', () => setHoverId((cur) => (cur === p.id ? null : cur)));
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([p.lon, p.lat])
          .addTo(map);
        updatePinElement(el, withPos(p, showPosition), now, layers.labels);
        markersRef.current.set(p.id, marker);
      }
    }

    const hs = map.getSource('hotspots') as maplibregl.GeoJSONSource | undefined;
    hs?.setData({
      type: 'FeatureCollection',
      features: layers.activity
        ? hotspots.map((h) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
            properties: { count: h.count },
          }))
        : [],
    });

    // Demand heat map: green intensity binned from live people, transparent where empty, off by default.
    const dm = map.getSource('demand') as maplibregl.GeoJSONSource | undefined;
    if (dm) {
      let features: GeoJSON.Feature[] = [];
      if (demand) {
        const cells = new Map<string, { lat: number; lon: number; n: number }>();
        for (const p of shown) {
          if (p.intent === 'looking') continue;
          const key = `${Math.round(p.lat / 0.004)},${Math.round(p.lon / 0.005)}`;
          const c = cells.get(key) ?? { lat: 0, lon: 0, n: 0 };
          c.lat += p.lat;
          c.lon += p.lon;
          c.n += 1;
          cells.set(key, c);
        }
        features = [...cells.values()].map((c) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lon / c.n, c.lat / c.n] },
          properties: { weight: c.n },
        }));
      }
      dm.setData({ type: 'FeatureCollection', features });
    }
  }, [shown, hotspots, layers, demand, showPosition, now]);

  // Place / event / arrival markers + hotspot count labels. Gated behind the "Places & events" layer so the
  // design's neutral white place pins, tonight's events and traveler arrivals sit beside the person pins.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    type Spec = {
      id: string;
      lat: number;
      lon: number;
      label: string;
      build: () => HTMLButtonElement;
      onClick: () => void;
    };
    const specs: Spec[] = [];
    if (showPlaces) {
      for (const pl of places)
        specs.push({
          id: pl.id,
          lat: pl.lat,
          lon: pl.lon,
          label: `${pl.name} · ${pl.here} here`,
          build: () => placePinElement(pl),
          onClick: () => router.push('/app/places'),
        });
      for (const ev of events)
        specs.push({
          id: ev.id,
          lat: ev.lat,
          lon: ev.lon,
          label: `${ev.name} · ${ev.time} · ${ev.going} going`,
          build: () => eventPinElement(ev),
          onClick: () => router.push('/app/places?tab=events'),
        });
    }
    for (const a of arrivals)
      specs.push({
        id: a.id,
        lat: a.lat,
        lon: a.lon,
        label: `${a.handle || 'Traveler'} · ${a.when}`,
        build: () => arrivalPinElement(a),
        onClick: () => setShowVisitors(true),
      });

    const wanted = new Set(specs.map((s) => s.id));
    for (const [id, marker] of placeMarkersRef.current) {
      if (!wanted.has(id)) {
        marker.remove();
        placeMarkersRef.current.delete(id);
      }
    }
    for (const s of specs) {
      if (placeMarkersRef.current.has(s.id)) {
        placeMarkersRef.current.get(s.id)!.setLngLat([s.lon, s.lat]);
        continue;
      }
      const el = s.build();
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        s.onClick();
      });
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([s.lon, s.lat])
        .addTo(map);
      // MapLibre overwrites aria-label with a generic "Map marker" during addTo(); restore the descriptive one.
      el.setAttribute('aria-label', s.label);
      placeMarkersRef.current.set(s.id, marker);
    }

    for (const m of hotspotMarkersRef.current) m.remove();
    hotspotMarkersRef.current = layers.activity
      ? hotspots
          .filter((h) => (h.count ?? 0) >= 3)
          .map((h) =>
            new maplibregl.Marker({ element: hotspotLabelElement(h.count, h.up ?? true), anchor: 'center' })
              .setLngLat([h.lon, h.lat])
              .addTo(map),
          )
      : [];
  }, [places, events, arrivals, hotspots, showPlaces, layers.activity, router]);

  // Free members see their 2-mile reach ring; it clears when travelling.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pos) return;
    const draw = () => {
      const circle = freeRing(pos.lon, pos.lat, FREE_M);
      const src = map.getSource('free-ring') as maplibregl.GeoJSONSource | undefined;
      const on = free && !view;
      if (!src) {
        map.addSource('free-ring', { type: 'geojson', data: circle });
        map.addLayer({
          id: 'free-ring-line',
          type: 'line',
          source: 'free-ring',
          paint: {
            'line-color': '#34d399',
            'line-width': 1.5,
            'line-dasharray': [2, 2],
            'line-opacity': 0.5,
          },
        });
      } else {
        src.setData(circle);
      }
      map.setLayoutProperty('free-ring-line', 'visibility', on ? 'visible' : 'none');
    };
    if (map.isStyleLoaded()) draw();
    else map.once('load', draw);
  }, [pos, free, view]);

  // Desperate flash: a red vignette for ~3s after sending, then it fades.
  useEffect(() => {
    if (!despFlash) return;
    const t = setTimeout(() => setDespFlash(false), 2800);
    return () => clearTimeout(t);
  }, [despFlash]);

  // Growth banners: never in the first ~20s, one at a time, each shown once per session, auto-dismiss after 12s.
  useEffect(() => {
    if (promo || aiOpen || showStatus || filtersOpen || selected) return;
    const pool = promosFor(plan).filter((p) => !promoSeenRef.current.has(p.id));
    if (!pool.length) return;
    const t = setTimeout(() => {
      const next = pool[0];
      promoSeenRef.current.add(next.id);
      setPromo(next);
    }, 20_000);
    return () => clearTimeout(t);
  }, [promo, aiOpen, showStatus, filtersOpen, selected, plan]);

  useEffect(() => {
    if (!promo) return;
    const t = setTimeout(() => setPromo(null), 12_000);
    return () => clearTimeout(t);
  }, [promo]);

  // "Someone nearby is interested" — simulated in demo mode (real mode drives this from a backend signal later).
  useEffect(() => {
    if (!demo || interested || selected || aiOpen) return;
    const t = setTimeout(() => {
      const live = people.filter((p) => p.intent && p.intent !== 'looking' && p.distanceM < 2500);
      if (live.length) setInterested(live[Math.floor(Math.random() * live.length)]);
    }, 9000);
    return () => clearTimeout(t);
  }, [demo, interested, selected, aiOpen, people]);

  useEffect(() => {
    if (!interested) return;
    const t = setTimeout(() => setInterested(null), 10_000);
    return () => clearTimeout(t);
  }, [interested]);

  const liveCount = useMemo(
    () =>
      searchFiltered.filter((p) => p.intent && p.intent !== 'looking' && availableAt(p, T, scrubbed)).length,
    [searchFiltered, T, scrubbed],
  );
  const nowCount = useMemo(
    () =>
      searchFiltered.filter((p) => matchesIntentChip(p.intent, 'now') && availableAt(p, T, scrubbed)).length,
    [searchFiltered, T, scrubbed],
  );
  const mine = intentMeta(status?.intent);
  const filterCount = activeFilterCount(filters);
  const activeLayerCount = Object.values(layers).filter(Boolean).length;
  const hovered = hoverId ? shown.find((p) => p.id === hoverId) : null;

  const closeLayersMenu = () => {
    setLayersOpen(false);
    requestAnimationFrame(() => layersButtonRef.current?.focus());
  };

  const onLayersMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      layersMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemcheckbox"]') ?? [],
    );
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      closeLayersMenu();
      return;
    }
    if (event.key === 'Tab') {
      setLayersOpen(false);
      return;
    }
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length;
    if (event.key === 'ArrowUp')
      next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next === null) return;
    event.preventDefault();
    items[next]?.focus();
  };

  const sendDesperate = async () => {
    if (!premium) {
      setNotice('Desperate alerts are part of Premium.');
      return;
    }
    const r = await fetch('/api/me/desperate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pos ? { lat: pos.lat, lng: pos.lon } : {}),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (r?.ok && j) {
      setDesperate(j);
      setDespFlash(true);
    } else if (j?.error) {
      setDesperate((d) => ({
        allowed: true,
        active: j.active ?? d?.active ?? null,
        nextAt: j.nextAt ?? d?.nextAt ?? null,
      }));
      setNotice(j.error);
    }
  };

  const stopDesperate = async () => {
    const r = await fetch('/api/me/desperate', { method: 'DELETE' }).catch(() => null);
    if (r?.ok) setDesperate(await r.json());
  };

  const applySmart = (f: Filters, c: IntentChip) => {
    setFilters(f);
    setChip(c);
  };

  const despActive = Boolean(desperate?.active);
  const despLeftMin = desperate?.active
    ? Math.max(0, Math.ceil((new Date(desperate.active.until).getTime() - now) / 60_000))
    : 0;

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

      {despFlash && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[60]"
          style={{
            boxShadow: 'inset 0 0 0 4px rgba(239,68,68,0.95), inset 0 0 180px rgba(239,68,68,0.45)',
            animation: 'piFade .4s ease-out both',
          }}
        />
      )}

      {/* Top overlay */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2.5 p-3.5 pr-[64px] pt-[calc(14px+var(--safe-top))] rail:pr-[14px]">
        <div className="flex flex-wrap items-center gap-2 rail:pr-[250px]">
          <button
            type="button"
            onClick={() => setShowStatus(true)}
            className="tap pointer-events-auto flex min-w-0 items-center gap-2.5 whitespace-nowrap rounded-btn border border-line-2 bg-ink-850/90 px-4 text-[13px] font-semibold backdrop-blur-md"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: mine?.color ?? 'transparent', border: mine ? 0 : '1px solid #666' }}
            />
            <span className="truncate">
              {mine ? `You: ${mine.label}` : 'Set your intent'}
              {status?.intent === 'travel' && status.travel_mi ? ` · ${status.travel_mi} mi` : ''}
            </span>
          </button>
          <button
            type="button"
            onClick={despActive ? stopDesperate : sendDesperate}
            aria-label="Desperate alert"
            title={
              premium
                ? 'Send a red alert to people nearby (Premium · every 3 hours)'
                : 'Desperate alerts are part of Premium'
            }
            className={`tap pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-chip border px-3.5 text-[12px] font-bold backdrop-blur-md ${
              despActive ? 'border-danger bg-[rgba(239,68,68,0.16)] text-fg' : 'border-line-2 bg-ink-850/90'
            }`}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22c4 0 7-3 7-7 0-3-2-5.5-3.5-7-.2 2-1.3 3.3-2.5 3.8C13.5 8.5 12 5 9 2c.3 3-1.5 5.5-3 7.5A7.9 7.9 0 0 0 5 15c0 4 3 7 7 7z" />
            </svg>
            <span className={despActive ? '' : 'hidden sm:inline'}>
              {despActive ? `Desperate · ${despLeftMin}m` : 'Desperate'}
            </span>
            {!premium && !despActive && (
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#999"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" />
              </svg>
            )}
          </button>
          <span className="pointer-events-none hidden min-h-11 items-center gap-2 rounded-btn border border-line-2 bg-ink-850/90 px-3 text-[12px] text-fg-3 backdrop-blur-md rail:flex">
            Near you <strong className="font-semibold text-green">{liveCount} ready</strong>
          </span>
          <button
            type="button"
            onClick={() => setShowTravel(true)}
            aria-label="Travel mode"
            className={`tap pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-chip border bg-ink-850/90 px-3.5 text-[13px] font-medium backdrop-blur-md rail:hidden ${
              view ? 'border-sel-border text-green' : 'border-line-2'
            }`}
          >
            <PlaneIcon /> <span className="max-w-[120px] truncate">{view ? view.label.split(',')[0] : 'Travel'}</span>
          </button>
          {pos && !pos.precise && !view && (
            <button
              type="button"
              onClick={() => locate(true).then(refresh)}
              className="tap pointer-events-auto shrink-0 rounded-[14px] border border-line-2 bg-ink-850/90 px-4 text-[13px] font-medium text-green backdrop-blur-md"
            >
              Use my location
            </button>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rail:absolute rail:right-[72px] rail:top-[calc(14px+var(--safe-top))]">
          <div className="relative">
            <button
              ref={layersButtonRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={layersOpen}
              aria-controls="map-layers-menu"
              onClick={() => {
                layersInitialFocusRef.current = 'first';
                setLayersOpen((v) => !v);
                setFiltersOpen(false);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                event.preventDefault();
                layersInitialFocusRef.current = event.key === 'ArrowUp' ? 'last' : 'first';
                setLayersOpen(true);
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
                ref={layersMenuRef}
                id="map-layers-menu"
                role="menu"
                aria-label="Map layers"
                onKeyDown={onLayersMenuKeyDown}
                className="absolute left-0 top-12 z-30 w-[230px] rail:left-auto rail:right-0 rounded-[16px] border border-line-2 bg-ink-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
              >
                {(
                  [
                    ['people', 'People pins'],
                    ['activity', 'Activity glow'],
                    ['labels', 'Pin labels'],
                  ] as [keyof MapLayers, string][]
                ).map(([key, label]) => {
                  const on = layers[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      role="menuitemcheckbox"
                      aria-checked={on}
                      onClick={() => setLayers((cur) => ({ ...cur, [key]: !cur[key] }))}
                      className="tap flex h-11 w-full items-center justify-between rounded-[11px] px-3 text-left text-[13px] hover:bg-white/5"
                    >
                      <span>{label}</span>
                      <span className={on ? 'font-bold text-green' : 'font-bold text-fg-4'}>
                        {on ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  );
                })}
                <span className="mx-3 my-1 block h-px bg-line-1" />
                <button
                  type="button"
                  onClick={() => setShowPlaces((v) => !v)}
                  className="tap flex h-11 w-full items-center justify-between rounded-[11px] px-3 text-left text-[13px] hover:bg-white/5"
                >
                  <span>Places &amp; events</span>
                  <span className={showPlaces ? 'font-bold text-green' : 'font-bold text-fg-4'}>
                    {showPlaces ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDemand((v) => !v)}
                  className="tap flex h-11 w-full items-center justify-between rounded-[11px] px-3 text-left text-[13px] hover:bg-white/5"
                >
                  <span>Demand heat map</span>
                  <span className={demand ? 'font-bold text-green' : 'font-bold text-fg-4'}>
                    {demand ? 'ON' : 'OFF'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLayersOpen(false);
                    setShowTravel(true);
                  }}
                  className="tap flex h-11 w-full items-center justify-between rounded-[11px] px-3 text-left text-[13px] hover:bg-white/5"
                >
                  <span>Travel to a city</span>
                  <span className="text-fg-4">→</span>
                </button>
                <p className="px-3 pb-2 pt-1 text-[10px] leading-relaxed text-fg-4">
                  Person pins use privacy-fuzzed map positions only.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => {
              setFiltersOpen(true);
              setLayersOpen(false);
            }}
            className={`tap relative flex h-10 items-center gap-2 rounded-[14px] border bg-ink-850/90 px-3.5 text-[12px] font-semibold backdrop-blur-md ${
              filterCount ? 'border-sel-border text-green' : 'border-line-2'
            }`}
          >
            Filter
            {filterCount > 0 && (
              <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-green px-1 text-[10px] font-bold text-ink-950">
                {filterCount}
              </span>
            )}
          </button>

          {demo && (
            <span className="ml-auto rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-warning backdrop-blur-md">
              Demo data
            </span>
          )}
          <span
            className={`hidden rounded-full border border-line-1 bg-ink-850/75 px-2.5 py-1.5 text-[10px] text-fg-4 backdrop-blur-md sm:block ${demo ? '' : 'ml-auto'}`}
          >
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
          {INTENT_CHIPS.map((c) => {
            const active = chip === c.key;
            const count = searchFiltered.filter(
              (p) =>
                matchesIntentChip(p.intent, c.key) &&
                availableAt(p, T, scrubbed) &&
                (c.key !== 'all' || p.intent !== 'looking'),
            ).length;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={active}
                onClick={() => setChip(c.key)}
                className={`chip shrink-0 bg-ink-850/90 backdrop-blur-md ${active ? 'chip-selected' : ''}`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
                {c.label}
                <span className="text-[10px] text-fg-4">{count}</span>
              </button>
            );
          })}
        </div>

        {despActive && (
          <div className="pointer-events-auto flex items-center gap-2.5 self-start rounded-input border border-danger bg-[rgba(239,68,68,0.16)] px-3 py-2 text-[12px] backdrop-blur-md">
            <span className="font-bold">You&apos;re desperate</span>
            <span className="text-fg-2">
              {despLeftMin}m left · seen by {desperate?.active?.reached ?? 0} nearby
            </span>
            <button type="button" onClick={stopDesperate} className="tap-link font-semibold text-green">
              Stop
            </button>
          </div>
        )}

        {interested && (
          <button
            type="button"
            onClick={() => {
              setSelected({ id: interested.id, distanceM: interested.distanceM });
              setInterested(null);
            }}
            className="glass pointer-events-auto flex items-center gap-3 self-start rounded-card px-3 py-2 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-800 text-[16px] font-bold text-fg-3">
              ?
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-bold">Someone nearby is interested</span>
              <span className="text-[12px] text-fg-3">
                {approx(interested.distanceM)} · they&apos;ll see you if you like them back
              </span>
            </span>
            <span className="shrink-0 text-[12px] font-semibold text-green">See →</span>
          </button>
        )}

        {(notice || !configured) && (
          <p className="pointer-events-auto rounded-input border border-line-2 bg-ink-850/90 px-3 py-2 text-[12px] text-fg-3 backdrop-blur-md">
            {!configured ? 'Discovery needs Supabase — add the keys and run the migrations.' : notice}
          </p>
        )}
      </div>

      {/* Right controls: zoom + locate */}
      <div className="pointer-events-auto absolute right-3.5 top-1/2 flex -translate-y-1/2 flex-col gap-2">
        <div className="flex flex-col overflow-hidden rounded-[14px] border border-line-2 bg-ink-850/90 backdrop-blur-md">
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => mapRef.current?.zoomIn()}
            className="tap h-11 w-11 text-[22px]"
          >
            +
          </button>
          <span className="h-px bg-line-1" />
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => mapRef.current?.zoomOut()}
            className="tap h-11 w-11 text-[22px]"
          >
            −
          </button>
        </div>
        <button
          type="button"
          aria-label="Locate me"
          onClick={() =>
            pos && mapRef.current?.flyTo({ center: [pos.lon, pos.lat], zoom: 14, duration: 700 })
          }
          className="tap flex h-11 w-11 items-center justify-center rounded-[14px] border border-line-2 bg-ink-850/90 text-green backdrop-blur-md"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M12 19a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 2v3M12 19v3M2 12h3M19 12h3M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
          </svg>
        </button>
      </div>

      {/* Desktop hover preview */}
      {hovered && !selected && !showMyCard && !filtersOpen && !showStatus && (
        <HoverPreview
          person={hovered}
          now={now}
          premium={premium}
          anchor={mapRef.current?.project([hovered.lon, hovered.lat]) ?? null}
          mapWidth={containerRef.current?.clientWidth ?? 0}
          mapHeight={containerRef.current?.clientHeight ?? 0}
        />
      )}

      {/* Bottom pills: scrubber + counts + visitors */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-col items-center gap-2 px-3">
        {scrubOpen ? (
          <div className="glass pointer-events-auto flex w-[min(520px,100%)] flex-col gap-2 rounded-sheet px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">
                {scrubbed ? `In ${fmtDur(scrub)}` : 'Right now'}{' '}
                <span className="font-normal text-fg-3">· {liveCount} available</span>
              </span>
              <div className="flex items-center gap-2">
                {scrubbed && (
                  <button
                    type="button"
                    onClick={() => setScrub(0)}
                    className="tap-link text-[11px] font-semibold text-green"
                  >
                    Back to now
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setScrubOpen(false)}
                  aria-label="Close time scrubber"
                  className="tap-link text-[16px] text-fg-3"
                >
                  ×
                </button>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={360}
              step={15}
              value={scrub}
              onChange={(e) => setScrub(Number(e.target.value))}
              aria-label="Time from now"
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-fg-4">
              <span>Now</span>
              <span>+2h</span>
              <span>+4h</span>
              <span>+6h</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setScrubOpen(true)}
            className="tap pointer-events-auto flex items-center gap-2 rounded-chip border border-line-2 bg-ink-850/90 px-4 text-[13px] font-semibold backdrop-blur-md"
          >
            <span className="h-2 w-2 rounded-full bg-green" />
            {scrubbed ? `In ${fmtDur(scrub)}` : 'Right now'}
            <span className="font-normal text-fg-3">
              {nowCount} available · {shown.length} shown
            </span>
          </button>
        )}
        {visitors.length > 0 && (
          <button
            type="button"
            onClick={() => setShowVisitors(true)}
            className="tap pointer-events-auto flex shrink-0 items-center gap-1.5 rounded-chip border border-line-2 bg-ink-850/90 px-3.5 text-[13px] font-medium backdrop-blur-md"
          >
            <PlaneIcon /> {visitors.length} visiting
          </button>
        )}
      </div>

      {/* π assistant */}
      {!aiOpen && (
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          aria-label="Chat with πroka"
          className="tap absolute bottom-[calc(78px+var(--safe-bottom))] right-3.5 z-40 flex h-12 items-center gap-2 rounded-chip border border-sel-border bg-ink-850/95 pl-1.5 pr-4 shadow-float backdrop-blur-md rail:bottom-4"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green text-[18px] font-bold text-ink-950">
            π
          </span>
          <span className="text-[13px] font-semibold">Ask πroka</span>
        </button>
      )}
      {aiOpen && (
        <AssistantPanel
          people={shown}
          premium={premium}
          onApply={applySmart}
          onOpenPerson={(id) => {
            setAiOpen(false);
            setSelected({ id, distanceM: null });
          }}
          onClose={() => setAiOpen(false)}
        />
      )}

      {/* Growth banner */}
      {promo && (
        <div
          role="status"
          className="glass absolute bottom-[calc(150px+var(--safe-bottom))] left-1/2 z-40 flex w-[min(460px,calc(100%-24px))] -translate-x-1/2 items-center gap-3 rounded-sheet border-sel-border p-3 rail:bottom-[86px]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-green text-ink-950">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={promo.d} />
            </svg>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-bold">{promo.title}</span>
            <span className="text-[12px] leading-snug text-fg-2">{promo.sub}</span>
          </span>
          <a
            href={promo.go === 'testing' ? '/app/places?tab=testing' : '/app/me#billing'}
            className="shrink-0 rounded-[10px] bg-white px-3 py-2 text-[12px] font-semibold text-ink-950"
            onClick={() => setPromo(null)}
          >
            {promo.cta}
          </a>
          <button
            type="button"
            onClick={() => setPromo(null)}
            aria-label="Dismiss"
            className="tap shrink-0 text-[18px] text-fg-3"
          >
            ×
          </button>
        </div>
      )}

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
      {filtersOpen && (
        <FilterSheet
          filters={filters}
          ethnicityEnabled={ethnicityEnabled}
          visibleCount={shown.length}
          showPosition={showPosition}
          onShowPosition={setShowPosition}
          onChange={(next, c) => {
            setFilters(next);
            if (c) setChip(c);
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}
      {showMyCard && (
        <MyCardSheet
          handle={selfCard.handle}
          photo={selfCard.photo}
          status={status}
          now={now}
          onEditIntent={() => {
            setShowMyCard(false);
            setShowStatus(true);
          }}
          onClose={() => setShowMyCard(false)}
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
      {selected &&
        (selected.id.startsWith('demo:') ? (
          (() => {
            const p = people.find((x) => x.id === selected.id);
            return p ? <DemoProfileSheet person={p} onClose={() => setSelected(null)} /> : null;
          })()
        ) : (
          <ProfileSheet
            userId={selected.id}
            distanceM={selected.distanceM}
            onClose={() => setSelected(null)}
          />
        ))}
    </div>
  );
}

/** A dashed circle polygon around a point, in GeoJSON, for the Free 2-mile reach ring. */
function freeRing(lon: number, lat: number, radiusM: number): GeoJSON.Feature {
  const points = 64;
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * 2 * Math.PI;
    coords.push([lon + Math.cos(a) * dLon, lat + Math.sin(a) * dLat]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: {} };
}

/** The card flips to the left of a pin when the right edge would clip it. */
export function hoverCardPosition(
  anchor: { x: number; y: number },
  width: number,
  height: number,
): { left: number; top: number; flipped: boolean } {
  const cardWidth = 224;
  const estimatedHeight = 340;
  const rightWouldClip = anchor.x + 28 + cardWidth > width - 12;
  const left = rightWouldClip ? anchor.x - cardWidth - 28 : anchor.x + 28;
  return {
    left: Math.max(12, Math.min(left, Math.max(12, width - cardWidth - 12))),
    top: Math.max(12, Math.min(anchor.y - 160, Math.max(12, height - estimatedHeight - 12))),
    flipped: rightWouldClip,
  };
}

/** Desktop pointer-hover card; data appears only if the member shared it or the backend computed it. */
function HoverPreview({ person, now, premium, anchor, mapWidth, mapHeight }: {
  person: NearbyPerson;
  now: number;
  premium: boolean;
  anchor: { x: number; y: number } | null;
  mapWidth: number;
  mapHeight: number;
}) {
  const meta = intentMeta(person.intent);
  const time = person.intentEndsAt ? fmtDur(Math.max(0, (new Date(person.intentEndsAt).getTime() - now) / 60_000)) : '';
  const state = person.relationship ?? 'stranger';
  const blur = person.photoRevealed && (state === 'mutual' || state === 'meet') ? 0 : state === 'chatted' ? 5 : 11;
  const position = person.attrs?.position?.map((p) => POSITION_LABEL[p] ?? p).find(Boolean);
  const country = person.attrs?.origin;
  const flag = country && /^(?:[a-z]{2}|us-[a-z]{2})$/i.test(country) ? flagUrl(country.toLowerCase()) : null;
  const hasScore = premium && typeof person.matchScore === 'number' && Number.isFinite(person.matchScore);
  const pos = anchor ? hoverCardPosition(anchor, mapWidth, mapHeight) : null;
  if (!pos || mapWidth < 260 || mapHeight < 340) return null;
  return (
    <div
      data-testid="person-hover-card"
      data-flipped={pos.flipped ? 'true' : 'false'}
      aria-hidden="true"
      className="piroka-hover-card pointer-events-none absolute z-30 hidden w-[224px] overflow-hidden rounded-card border border-line-3 bg-ink-850 shadow-float motion-reduce:animate-none rail:block"
      style={{ left: pos.left, top: pos.top }}
    >
      <div className="relative flex h-[210px] items-center justify-center overflow-hidden bg-ink-800">
        {person.photo ? (
          // The URL is pre-authorized server-side and only yields clear pixels to mutual/Meet connections.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.photo} alt="" className="h-full w-full object-cover" style={{ filter: `blur(${blur}px)` }} />
        ) : (
          <svg aria-hidden="true" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#666666" strokeWidth={1.4} strokeLinecap="round">
            <path d={NAV_ICON_PATHS.me} />
          </svg>
        )}
        <span className="absolute left-2.5 top-2.5 flex max-w-[calc(100%-20px)] items-center gap-1.5 rounded-chip bg-ink-950/80 px-2.5 py-1 text-[11px] font-semibold text-fg">
          <span aria-hidden className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: meta?.color ?? '#666666' }} />
          <span className="truncate">{meta?.label ?? 'On the map'}{time && ` · ${time}`}</span>
        </span>
        {hasScore && (
          <span className="absolute right-2.5 top-10 rounded-chip bg-green px-2 py-1 text-[11px] font-bold text-ink-950">
            {Math.round(person.matchScore! * 100)}% your type
          </span>
        )}
        {blur > 0 && person.photo && (
          <span className="absolute bottom-2.5 left-2.5 rounded-chip bg-ink-950/80 px-2 py-1 text-[10px] text-fg-2">
            Blurred until mutual
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 px-[14px] pb-[14px] pt-3">
        <div className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="truncate">{person.handle ? `@${person.handle}` : 'Anonymous'}{typeof person.age === 'number' && person.age >= 18 ? `, ${person.age}` : ''}</span>
          {flag && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flag} alt="Origin" width={20} height={14} className="h-[14px] w-5 rounded-[3px] object-cover" />
          )}
        </div>
        <span className="text-[12px] text-fg-2">
          {[position, person.body, approx(person.distanceM)].filter(Boolean).join(' · ')}
        </span>
        {typeof person.responseMinutes === 'number' && person.responseMinutes >= 0 && (
          <span className="text-[11px] text-fg-3">
            Replies in {person.responseMinutes <= 5 ? 'minutes' : `~${person.responseMinutes} min`}
          </span>
        )}
        <span className="text-[11px] text-fg-4">Click to open profile</span>
      </div>
    </div>
  );
}

/** Inline SVG, never an emoji: icons follow the fixed semantic token system. */
function PlaneIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>;
}
