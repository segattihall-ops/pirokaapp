import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';
import { saveLocation } from '@/lib/db/client';
import { fuzzLocation } from '@/lib/geo/fuzz';
import crypto from 'crypto';

/**
 * POST /api/onboarding/location/save
 * Save user's true location and fuzzed public location
 * Never send raw coordinates to client
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { lat, lng, countryCode } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Generate a random seed for location fuzzing (rotates per session)
    const fuzzSeed = crypto.randomBytes(16);

    // Fuzz the location for public visibility
    const { lat: publicLat, lng: publicLng } = fuzzLocation(lat, lng, fuzzSeed);

    // Save to database (server-only operation)
    const { data, error } = await saveLocation(
      session.userId,
      lat,
      lng,
      fuzzSeed,
      publicLat,
      publicLng,
      countryCode
    );

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Failed to save location' }, { status: 500 });
    }

    // Client receives ONLY the fuzzed location (never raw)
    return NextResponse.json({
      ok: true,
      public: { lat: publicLat, lng: publicLng },
      // true_geo is never sent to client
    });
  } catch (error) {
    console.error('Error saving location:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
