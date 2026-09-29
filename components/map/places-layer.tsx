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
  useEffect(() => {
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

    // Click handler
    if (onPlaceClick) {
      const handleClick = (e: any) => {
        const features = map.queryRenderedFeatures({ layers: ['place-pins'] });
        if (features.length > 0) {
          const props = features[0].properties;
          onPlaceClick({
            id: props.id,
            name: props.name,
            kind: props.kind,
            lat: features[0].geometry.coordinates[1],
            lng: features[0].geometry.coordinates[0],
            verified: props.verified,
            peakHint: props.peakHint,
          });
        }
      };

      map.on('click', 'place-pins', handleClick);
      return () => map.off('click', 'place-pins', handleClick);
    }
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
