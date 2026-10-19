import type { StyleSpecification } from 'maplibre-gl';

/**
 * The App v2 prototype defaults to Esri Canvas World Dark Gray Base with its
 * Reference tiles above the basemap. Keep the layers separate so labels stay
 * readable and map markers remain in full semantic colour.
 *
 * Source of truth: design_handoff/design/Piroka App v2.dc.html
 */
const ESRI_CANVAS = 'https://services.arcgisonline.com/arcgis/rest/services/Canvas';

export const PIROKA_BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  name: 'Piroka Esri Dark Gray',
  sources: {
    'esri-dark-base': {
      type: 'raster',
      tiles: [`${ESRI_CANVAS}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
      attribution: 'Esri, HERE, Garmin',
    },
    'esri-dark-reference': {
      type: 'raster',
      tiles: [`${ESRI_CANVAS}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'esri-dark-base',
      type: 'raster',
      source: 'esri-dark-base',
      paint: {
        'raster-saturation': -1,
        'raster-contrast': 0.05,
        'raster-brightness-max': 1,
      },
    },
    {
      id: 'esri-dark-reference',
      type: 'raster',
      source: 'esri-dark-reference',
      paint: {
        'raster-saturation': -1,
        'raster-opacity': 0.98,
      },
    },
  ],
};

/** Explicit fallback available to operators without changing UI tokens. */
export const CARTO_FALLBACK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
