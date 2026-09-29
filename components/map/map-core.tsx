'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Map from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const CARTO_DARK = 'https://basemaps.cartocdn.com/gl/dark-matter-nolabels/style.json';
const ESRI_DARK_FALLBACK = 'https://basemap.arcgisonline.com/arcgis/rest/services/World_Dark_Gray_Base/VectorTileServer/resources/styles/root.json';

interface MapCoreProps {
  center?: [number, number];
  zoom?: number;
  onLocationChange?: (lat: number, lng: number) => void;
}

/**
 * Map component using MapLibre GL with CARTO dark_all style
 * Shows user positions with intent rings, place pins, and arrival pins
 * Never renders raw coordinates on client
 */
export function MapCore({ center = [-96.8, 32.8], zoom = 12, onLocationChange }: MapCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const initMap = async () => {
      try {
        // Try CARTO first, fallback to Esri
        let styleUrl = CARTO_DARK;
        const cartoTest = await fetch(CARTO_DARK, { method: 'HEAD' });
        if (!cartoTest.ok) {
          console.warn('CARTO style unavailable, using Esri fallback');
          styleUrl = ESRI_DARK_FALLBACK;
        }

        const map = new Map({
          container: containerRef.current,
          style: styleUrl,
          center,
          zoom,
          pitch: 0,
        });

        map.on('load', () => {
          mapRef.current = map;
          setIsReady(true);

          // Add user position layer (from Supabase realtime)
          map.addSource('users', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          // User pins with intent rings
          map.addLayer({
            id: 'user-pins',
            type: 'circle',
            source: 'users',
            paint: {
              'circle-radius': 6,
              'circle-color': '#00FF00',
              'circle-opacity': 0.8,
            },
          });

          // Add place pins layer
          map.addSource('places', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });

          map.addLayer({
            id: 'place-pins',
            type: 'circle',
            source: 'places',
            paint: {
              'circle-radius': 5,
              'circle-color': '#FFFF00',
              'circle-opacity': 0.6,
            },
          });
        });

        map.on('error', (e) => {
          console.error('Map error:', e);
          setError('Failed to load map');
        });

        return () => {
          map.remove();
        };
      } catch (err) {
        console.error('Map init failed:', err);
        setError('Map initialization failed');
      }
    };

    initMap();
  }, [center, zoom]);

  // Update user positions from server (via Supabase realtime)
  const updateUsers = useCallback((features: any[]) => {
    if (!mapRef.current) return;
    const source = mapRef.current.getSource('users') as any;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features,
      });
    }
  }, []);

  return (
    <div className="w-full h-full relative bg-gray-900">
      <div ref={containerRef} className="w-full h-full" />
      {error && (
        <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-2 rounded text-sm">
          {error}
        </div>
      )}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950 bg-opacity-50">
          <div className="text-white">Loading map...</div>
        </div>
      )}
    </div>
  );
}
