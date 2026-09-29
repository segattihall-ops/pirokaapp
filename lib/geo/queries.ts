/**
 * PostGIS queries for location-based discovery
 * - Nearby users (Pulse)
 * - Heatmaps / Hotspots
 * - Region clustering
 */

import { supabaseAdmin } from '@/lib/db/client';

export type NearbyUser = {
  userId: string;
  distance_m: number;
  distance_mi: number;
  photo_url?: string;
  handle?: string;
  intent?: string;
};

export type Hotspot = {
  center: [number, number]; // [lon, lat]
  count: number;
  intensity: 'low' | 'medium' | 'high';
};

/**
 * Find nearby users within radius
 * Returns users sorted by distance
 *
 * Query:
 * SELECT u.id, ST_Distance(l.public_geo, $1::geography) as m
 * FROM locations l
 * JOIN users u ON u.id = l.user_id
 * WHERE ST_DWithin(l.public_geo, $1::geography, 5000)
 *   AND u.visibility != 'hidden'
 *   AND NOT EXISTS (SELECT 1 FROM blocks WHERE ...)
 * ORDER BY m LIMIT 200
 */
export async function findNearbyUsers(
  lat: number,
  lon: number,
  radiusMeters: number = 5000,
  userId: string,
  limit: number = 200
): Promise<NearbyUser[]> {
  if (!supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin.rpc('nearby_users', {
      user_lat: lat,
      user_lon: lon,
      radius_m: radiusMeters,
      requester_id: userId,
      limit_count: limit
    });

    if (error) {
      console.error('Nearby users query failed:', error);
      return [];
    }

    // Transform to our type
    return (data || []).map((row: any) => ({
      userId: row.id,
      distance_m: Math.round(row.distance_m),
      distance_mi: Math.round((row.distance_m / 1609.34) * 10) / 10,
      photo_url: row.photo_url,
      handle: row.handle,
      intent: row.intent
    }));
  } catch (error) {
    console.error('Failed to fetch nearby users:', error);
    return [];
  }
}

/**
 * Find hotspots (clustered users) for heatmap visualization
 * Uses ST_ClusterKMeans to group nearby users
 */
export async function findHotspots(
  lat: number,
  lon: number,
  radiusMeters: number = 25000
): Promise<Hotspot[]> {
  if (!supabaseAdmin) return [];

  try {
    const { data, error } = await supabaseAdmin.rpc('nearby_hotspots', {
      center_lat: lat,
      center_lon: lon,
      radius_m: radiusMeters
    });

    if (error) {
      console.error('Hotspots query failed:', error);
      return [];
    }

    // Transform to our type
    return (data || []).map((row: any) => {
      const count = row.count || 0;
      let intensity: 'low' | 'medium' | 'high' = 'low';
      if (count > 20) intensity = 'high';
      else if (count > 5) intensity = 'medium';

      return {
        center: [row.lon, row.lat] as [number, number],
        count,
        intensity
      };
    });
  } catch (error) {
    console.error('Failed to fetch hotspots:', error);
    return [];
  }
}

/**
 * Check if location is in risk region
 */
export async function isRiskRegion(lat: number, lon: number): Promise<boolean> {
  if (!supabaseAdmin) return false;

  try {
    // Query users table for risk_region flag
    const { data, error } = await supabaseAdmin
      .from('locations')
      .select('risk_region')
      .eq('user_id', 'temp') // This is a placeholder
      .limit(1);

    // TODO: Implement risk region detection via PostGIS
    // For now: return false (no risk regions flagged)
    return false;
  } catch (error) {
    console.error('Risk region check failed:', error);
    return false;
  }
}

/**
 * Get city/region from coordinates
 * Uses reverse geocoding (placeholder - needs external service)
 */
export async function getCityFromCoordinates(
  lat: number,
  lon: number
): Promise<{ city: string; country: string } | null> {
  // TODO: Integrate reverse geocoding service (MapBox, etc)
  // For now: return null
  return null;
}

/**
 * Distance between two coordinates in miles
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.asin(Math.sqrt(a));
  return Math.round(R * c * 10) / 10;
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
