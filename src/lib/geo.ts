import { prisma } from '@/lib/prisma';
import type { NearbyCourt } from '@/lib/types';
import type { RadiusOption } from '@/lib/validators';

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.045;

interface NearbyRow {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  city: string;
  address: string;
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
 * Courts within `radiusKm` of a point, nearest first.
 *
 * Two-stage filter. The BETWEEN clauses are a cheap bounding box that the
 * (latitude, longitude) index can serve, discarding almost every row without
 * evaluating a trigonometric expression. The Haversine distance is then
 * computed only for survivors, and the outer query trims the box corners down
 * to a true circle.
 *
 * LEAST(1.0, ...) clamps the acos argument: at distance zero floating point
 * rounding can push the cosine fractionally above 1, which would make acos()
 * return NaN and silently drop the court a player is standing inside.
 */
export async function findNearbyCourts(
  lat: number,
  lng: number,
  radiusKm: RadiusOption | number,
): Promise<NearbyCourt[]> {
  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  // Longitude degrees shrink toward the poles; guard the cosine near +/-90.
  const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));

  const rows = await prisma.$queryRaw<NearbyRow[]>`
    SELECT * FROM (
      SELECT
        ct.id,
        ct.name,
        ct."ownerId",
        u.name AS "ownerName",
        '' AS "city",
        '' AS "address",
        ct.latitude,
        ct.longitude,
        ct."hourlyRate" AS "minRate",
        ct."hourlyRate" AS "maxRate",
        COUNT(ct.id) OVER (PARTITION BY ct."ownerId") AS "courtCount",
        (ct.type = 'INDOOR') AS "hasIndoor",
        (ct.type = 'OUTDOOR') AS "hasOutdoor",
        ${EARTH_RADIUS_KM} * acos(LEAST(1.0,
          cos(radians(${lat})) * cos(radians(ct.latitude)) *
          cos(radians(ct.longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(ct.latitude))
        )) AS "distanceKm"
      FROM "Court" ct
      INNER JOIN "User" u ON u.id = ct."ownerId"
      WHERE ct."isActive" = true
        AND u."isActive" = true
        AND ct.latitude  BETWEEN ${lat - latDelta} AND ${lat + latDelta}
        AND ct.longitude BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
    ) q
    WHERE q."distanceKm" <= ${radiusKm}
    ORDER BY q."distanceKm" ASC
    LIMIT 50
  `;

  return rows.map(serialiseRow);
}

/** Every active court, unsorted by distance — the pre-geolocation view. */
export async function listActiveCourts(): Promise<NearbyCourt[]> {
  const courts = await prisma.court.findMany({
    where: { isActive: true, owner: { isActive: true } },
    include: {
      owner: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });

  return courts.map((court) => {
    const rate = court.hourlyRate.toNumber();
    return {
      id: court.id,
      name: court.name,
      ownerId: court.owner.id,
      ownerName: court.owner.name,
      city: '',
      address: '',
      latitude: court.latitude ?? 0,
      longitude: court.longitude ?? 0,
      minRate: rate,
      maxRate: rate,
      courtCount: 1,
      hasIndoor: court.type === 'INDOOR',
      hasOutdoor: court.type === 'OUTDOOR',
    };
  });
}

function serialiseRow(row: NearbyRow): NearbyCourt {
  const toNumber = (value: string | number | null) =>
    value === null ? null : typeof value === 'number' ? value : Number.parseFloat(value);

  return {
    id: row.id,
    name: row.name,
    ownerId: row.ownerId,
    ownerName: row.ownerName,
    city: row.city,
    address: row.address,
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
