import { useEffect, useState, useCallback } from 'react';
import { findNearbyUsers, findHotspots, type NearbyUser, type Hotspot } from '@/lib/geo/queries';

export function useNearbyUsers(userId: string, enabled: boolean = true) {
  const [users, setUsers] = useState<NearbyUser[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<[number, number] | null>(null);

  // Get current location
  const getCurrentLocation = useCallback(() => {
    return new Promise<[number, number]>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject('Geolocation not supported');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve([
            position.coords.latitude,
            position.coords.longitude
          ]);
        },
        (error) => {
          reject(error.message);
        }
      );
    });
  }, []);

  // Fetch nearby users and hotspots
  const fetchNearby = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const [lat, lon] = await getCurrentLocation();
      setLocation([lat, lon]);

      // Fetch nearby users (5km radius)
      const nearbyUsers = await findNearbyUsers(lat, lon, 5000, userId, 200);
      setUsers(nearbyUsers);

      // Fetch hotspots for heatmap
      const nearbyHotspots = await findHotspots(lat, lon, 25000);
      setHotspots(nearbyHotspots);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch nearby users');
    } finally {
      setIsLoading(false);
    }
  }, [enabled, getCurrentLocation, userId]);

  // Refresh on mount
  useEffect(() => {
    if (enabled) {
      fetchNearby();
    }
  }, [enabled, fetchNearby]);

  return {
    users,
    hotspots,
    location,
    isLoading,
    error,
    refresh: fetchNearby
  };
}
