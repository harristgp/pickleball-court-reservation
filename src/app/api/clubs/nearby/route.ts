import { NextResponse } from 'next/server';
import { findNearbyClubs } from '@/lib/geo';
import { nearbyQuerySchema } from '@/lib/validators';

/**
 * Proximity search for the discover page.
 *
 * Exposed as a route handler rather than a server action so the map can refetch
 * on every radius change without a navigation, and so the same query is usable
 * from any future client (native app, embed) without duplication.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = nearbyQuerySchema.safeParse({
    lat: searchParams.get('lat'),
    lng: searchParams.get('lng'),
    radius: searchParams.get('radius'),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid coordinates or radius.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { lat, lng, radius } = parsed.data;
  const clubs = await findNearbyClubs(lat, lng, radius);

  return NextResponse.json({ clubs, radius, origin: { lat, lng } });
}
