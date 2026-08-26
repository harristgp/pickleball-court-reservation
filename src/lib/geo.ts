import { prisma } from '@/lib/prisma';
import type { FacilitySummary } from '@/lib/types';
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
  photos: string[];
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
 * Facilities within `radiusKm` of a point, nearest first.
 *
 * Two-stage filter. The BETWEEN clauses are a cheap bounding box that the
 * (latitude, longitude) index can serve, discarding almost every row without
 * evaluating a trigonometric expression. The Haversine distance is then
 * computed only for survivors, and the outer query trims the box corners down
 * to a true circle.
 */
export async function findNearbyFacilities(
  lat: number,
  lng: number,
  radiusKm: RadiusOption | number,
): Promise<FacilitySummary[]> {
  const latDelta = radiusKm / KM_PER_DEGREE_LAT;
  const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));

  const rows = await prisma.$queryRaw<NearbyRow[]>`
    SELECT * FROM (
      SELECT
        f.id,
        f.name,
        f."ownerId",
        u.name AS "ownerName",
        f.city,
        f.address,
        f.latitude,
        f.longitude,
        f.photos,
        (SELECT MIN(c."hourlyRate") FROM "Court" c WHERE c."facilityId" = f.id AND c."isActive" = true) AS "minRate",
        (SELECT MAX(c."hourlyRate") FROM "Court" c WHERE c."facilityId" = f.id AND c."isActive" = true) AS "maxRate",
        (SELECT COUNT(*)::int FROM "Court" c WHERE c."facilityId" = f.id AND c."isActive" = true) AS "courtCount",
        (SELECT EXISTS(SELECT 1 FROM "Court" c WHERE c."facilityId" = f.id AND c."isActive" = true AND c.type = 'INDOOR')) AS "hasIndoor",
        (SELECT EXISTS(SELECT 1 FROM "Court" c WHERE c."facilityId" = f.id AND c."isActive" = true AND c.type = 'OUTDOOR')) AS "hasOutdoor",
        ${EARTH_RADIUS_KM} * acos(LEAST(1.0,
          cos(radians(${lat})) * cos(radians(f.latitude)) *
          cos(radians(f.longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(f.latitude))
        )) AS "distanceKm"
      FROM "Facility" f
      INNER JOIN "User" u ON u.id = f."ownerId"
      WHERE f."isActive" = true
        AND u."isActive" = true
        AND f.latitude  BETWEEN ${lat - latDelta} AND ${lat + latDelta}
        AND f.longitude BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
    ) q
    WHERE q."distanceKm" <= ${radiusKm}
      AND q."courtCount" > 0
    ORDER BY q."distanceKm" ASC
    LIMIT 50
  `;

  return rows.map(serialiseRow);
}

/** Paginated list of active facilities for the browse page. */
export async function listActiveFacilities({
  page = 1,
  pageSize = 12,
  search,
  courtType,
}: {
  page?: number;
  pageSize?: number;
  search?: string;
  courtType?: 'ALL' | 'INDOOR' | 'OUTDOOR';
} = {}): Promise<{ facilities: FacilitySummary[]; total: number }> {
  const where: {
    isActive: boolean;
    owner?: { isActive: boolean };
    courts?: { some: { isActive: boolean; type?: 'INDOOR' | 'OUTDOOR' } };
    OR?: Record<string, unknown>[];
  } = {
    isActive: true,
    owner: { isActive: true },
    courts: { some: { isActive: true } },
  };

  if (search) {
    const needle = search.trim();
    where.OR = [
      { name: { contains: needle, mode: 'insensitive' } },
      { city: { contains: needle, mode: 'insensitive' } },
      { address: { contains: needle, mode: 'insensitive' } },
      { owner: { name: { contains: needle, mode: 'insensitive' } } },
    ];
  }

  if (courtType === 'INDOOR') {
    where.courts = { some: { isActive: true, type: 'INDOOR' } };
  } else if (courtType === 'OUTDOOR') {
    where.courts = { some: { isActive: true, type: 'OUTDOOR' } };
  }

  const [total, facilities] = await Promise.all([
    prisma.facility.count({ where }),
    prisma.facility.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true } },
        courts: {
          where: { isActive: true },
          select: { type: true, hourlyRate: true },
        },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    total,
    facilities: facilities.map((facility) => {
      const rates = facility.courts.map((c) => c.hourlyRate.toNumber());
      return {
        id: facility.id,
        name: facility.name,
        ownerId: facility.owner.id,
        ownerName: facility.owner.name,
        city: facility.city,
        address: facility.address,
        latitude: facility.latitude ?? 0,
        longitude: facility.longitude ?? 0,
        minRate: rates.length ? Math.min(...rates) : null,
        maxRate: rates.length ? Math.max(...rates) : null,
        courtCount: facility.courts.length,
        hasIndoor: facility.courts.some((c) => c.type === 'INDOOR'),
        hasOutdoor: facility.courts.some((c) => c.type === 'OUTDOOR'),
        photos: facility.photos,
      };
    }),
  };
}

/** All active facilities (no pagination) — used by the discover page and nearby search. */
export async function listAllActiveFacilities(): Promise<FacilitySummary[]> {
  const facilities = await prisma.facility.findMany({
    where: { isActive: true, owner: { isActive: true } },
    include: {
      owner: { select: { id: true, name: true } },
      courts: {
        where: { isActive: true },
        select: { type: true, hourlyRate: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return facilities
    .filter((f) => f.courts.length > 0)
    .map((facility) => {
      const rates = facility.courts.map((c) => c.hourlyRate.toNumber());
      return {
        id: facility.id,
        name: facility.name,
        ownerId: facility.owner.id,
        ownerName: facility.owner.name,
        city: facility.city,
        address: facility.address,
        latitude: facility.latitude ?? 0,
        longitude: facility.longitude ?? 0,
        minRate: rates.length ? Math.min(...rates) : null,
        maxRate: rates.length ? Math.max(...rates) : null,
        courtCount: facility.courts.length,
        hasIndoor: facility.courts.some((c) => c.type === 'INDOOR'),
        hasOutdoor: facility.courts.some((c) => c.type === 'OUTDOOR'),
        photos: facility.photos,
      };
    });
}

function serialiseRow(row: NearbyRow): FacilitySummary {
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
    photos: row.photos ?? [],
    distanceKm: Number(row.distanceKm),
  };
}
