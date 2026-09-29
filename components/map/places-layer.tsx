'use client';

import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';

interface Place {
  id: string;
  name: string;
  kind: 'bar' | 'park' | 'gym' | 'cafe' | 'club' | 'other';
  lat: number;
  lng: number;
  peakHint?: string;
  verified: boolean;
}

interface PlacesLayerProps {
  map: maplibregl.Map | null;
  places: Place[];
  onPlaceClick?: (place: Place) => void;
}

/**
 * Places layer with check-in and "I'm going" TTL
 * Shows verified venue pins with peak time hints
 */
export function PlacesLayer({ map, places, onPlaceClick }: PlacesLayerProps) {
  useEffect((): void | (() => void) => {
    if (!map || places.length === 0) return;

    const source = map.getSource('places') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: places.map(place => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [place.lng, place.lat] },
          properties: {
            id: place.id,
            name: place.name,
            kind: place.kind,
            verified: place.verified,
            peakHint: place.peakHint,
          },
        })),
      });
    }

    if (!onPlaceClick) return;

    const handleClick = (e: any) => {
      const features = map.queryRenderedFeatures({ layers: ['place-pins'] });
      if (features.length > 0) {
        const props = features[0].properties;
        const coords = (features[0].geometry as any).coordinates as [number, number];
        onPlaceClick({
          id: props.id,
          name: props.name,
          kind: props.kind,
          lat: coords[1],
          lng: coords[0],
          verified: props.verified,
          peakHint: props.peakHint,
        });
      }
    };

    map.on('click', 'place-pins', handleClick);
    return () => map.off('click', 'place-pins', handleClick);
  }, [map, places, onPlaceClick]);

  return null;
}

/**
 * Check-in types:
 * - 'here': Currently at place (expires in 4h)
 * - 'going': Planning to go (expires in 24h)
 */
export interface CheckIn {
  userId: string;
  placeId: string;
  kind: 'here' | 'going';
  expiresAt: Date;
}
