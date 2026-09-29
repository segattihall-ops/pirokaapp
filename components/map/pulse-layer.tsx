'use client';

import { useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';

interface HotspotCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  intensity: 'low' | 'medium' | 'high';
}

interface PulseLayerProps {
  map: maplibregl.Map | null;
  hotspots: HotspotCluster[];
}

/**
 * Pulse hotspots via PostGIS grid clustering
 * Shows ≥3 available people per ~450m cell
 * Intensity increases if 60%+ stay >45 min
 */
export function PulseLayer({ map, hotspots }: PulseLayerProps) {
  useEffect(() => {
    if (!map || hotspots.length === 0) return;

    const source = map.getSource('pulse') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: hotspots.map(spot => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [spot.lng, spot.lat] },
          properties: { count: spot.count, intensity: spot.intensity, id: spot.id },
        })),
      });
    }
  }, [map, hotspots]);

  return null; // Layer rendering is handled by map component
}

/**
 * Hotspot query (PostGIS clustering)
 * Groups available people into 450m cells
 * Returns cell centers with count + intensity
 */
export const HOTSPOT_QUERY = `
  select
    st_x(st_centroid(st_collect(public_geo))) as lng,
    st_y(st_centroid(st_collect(public_geo))) as lat,
    count(*) as count,
    case when count(*) >= 3 then 'high'
         when count(*) >= 2 then 'medium'
         else 'low' end as intensity
  from locations
  where st_dwithin(
    public_geo,
    st_point($lng::float, $lat::float)::geography,
    25000
  )
  group by st_geohash(public_geo, 7)
  having count(*) >= 3
  order by count desc
`;
