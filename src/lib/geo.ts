import { prisma } from '@/lib/prisma';
import type { NearbyClub } from '@/lib/types';
import type { RadiusOption } from '@/lib/validators';

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.045;

interface NearbyRow {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  description: string;
  imageUrl: string | null;
  latitude: number;
  longitude: number;
  minRate: string | number | null;
  maxRate: string | number | null;
  courtCount: bigint | number;
  hasIndoor: boolean;
  hasOutdoor: boolean;
  distanceKm: number;
}

/**
 * Great-circle distance in kilometres. Kept in TypeScript as well as SQL so the
 * map component and tests can label a distance without a round trip.
 */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Clubs within `radiusKm` of a point, nearest first.
 *
 * Two-stage filter. The BETWEEN clauses are a cheap bounding box that the
 * (latitude, longitude) index can serve, discarding almost every row without
 * evaluating a trigonometric expression. The Haversine distance is then
 * computed only for survivors, and the outer query trims the box corners down
 * to a true circle.
 *
 * LEAST(1.0, ...) clamps the acos argument: at distance zero floating point
 * rounding can push the cosine fractionally above 1, which would make acos()
 * return NaN and silently drop the club a player is standing inside.
 */
export async function findNearbyClubs(
  lat: number,
  lng: number,
  radiusKm: RadiusOption | number,
): Promise<NearbyClub[]> {
  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  // Longitude degrees shrink toward the poles; guard the cosine near +/-90.
  const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));

  const rows = await prisma.$queryRaw<NearbyRow[]>`
    SELECT * FROM (
      SELECT
        c.id,
        c.name,
        c.slug,
        c.city,
        c.address,
        c.description,
        c."imageUrl",
        c.latitude,
        c.longitude,
        MIN(ct."hourlyRate")                                          AS "minRate",
        MAX(ct."hourlyRate")                                          AS "maxRate",
        COUNT(ct.id)                                                  AS "courtCount",
        COALESCE(BOOL_OR(ct.type = 'INDOOR'), false)                  AS "hasIndoor",
        COALESCE(BOOL_OR(ct.type = 'OUTDOOR'), false)                 AS "hasOutdoor",
        ${EARTH_RADIUS_KM} * acos(LEAST(1.0,
          cos(radians(${lat})) * cos(radians(c.latitude)) *
          cos(radians(c.longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(c.latitude))
        ))                                                            AS "distanceKm"
      FROM "Club" c
      LEFT JOIN "Court" ct ON ct."clubId" = c.id AND ct."isActive" = true
      WHERE c."isActive" = true
        AND c.latitude  BETWEEN ${lat - latDelta} AND ${lat + latDelta}
        AND c.longitude BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
      GROUP BY c.id
    ) q
    WHERE q."distanceKm" <= ${radiusKm}
    ORDER BY q."distanceKm" ASC
    LIMIT 50
  `;

  return rows.map(serialiseRow);
}

/** Every active club, unsorted by distance — the pre-geolocation view. */
export async function listActiveClubs(): Promise<NearbyClub[]> {
  const clubs = await prisma.club.findMany({
    where: { isActive: true },
    include: { courts: { where: { isActive: true }, select: { hourlyRate: true, type: true } } },
    orderBy: { name: 'asc' },
  });

  return clubs.map((club) => {
    const rates = club.courts.map((court) => court.hourlyRate.toNumber());
    return {
      id: club.id,
      name: club.name,
      slug: club.slug,
      city: club.city,
      address: club.address,
      description: club.description,
      imageUrl: club.imageUrl,
      latitude: club.latitude,
      longitude: club.longitude,
      minRate: rates.length ? Math.min(...rates) : null,
      maxRate: rates.length ? Math.max(...rates) : null,
      courtCount: club.courts.length,
      hasIndoor: club.courts.some((court) => court.type === 'INDOOR'),
      hasOutdoor: club.courts.some((court) => court.type === 'OUTDOOR'),
    };
  });
}

function serialiseRow(row: NearbyRow): NearbyClub {
  const toNumber = (value: string | number | null) =>
    value === null ? null : typeof value === 'number' ? value : Number.parseFloat(value);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    city: row.city,
    address: row.address,
    description: row.description,
    imageUrl: row.imageUrl,
    latitude: row.latitude,
    longitude: row.longitude,
    minRate: toNumber(row.minRate),
    maxRate: toNumber(row.maxRate),
    courtCount: Number(row.courtCount),
    hasIndoor: row.hasIndoor,
    hasOutdoor: row.hasOutdoor,
    distanceKm: Number(row.distanceKm),
  };
}
