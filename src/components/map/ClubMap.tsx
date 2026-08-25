'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatMoney } from '@/lib/money';
import type { NearbyClub } from '@/lib/types';

/**
 * Leaflet's default marker points at PNG files resolved relative to the CSS,
 * which webpack rewrites and breaks. Building the pin from an inline divIcon
 * sidesteps the asset pipeline entirely and lets the pin be themed with the
 * same palette as the rest of the UI.
 */
const clubIcon = L.divIcon({
  className: 'dc-pin',
  html: `
    <span style="
      display:grid;place-items:center;
      width:30px;height:30px;border-radius:9999px;
      background:#75b61d;color:#fff;
      border:2.5px solid #fff;
      box-shadow:0 2px 8px rgba(24,40,6,.45);
      font-size:15px;line-height:1;">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/><path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18M3 12h18"/>
      </svg>
    </span>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  popupAnchor: [0, -16],
});

/** Re-frames the map whenever the result set changes. */
function FitToResults({ clubs, center }: { clubs: NearbyClub[]; center: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = clubs.map((club) => [club.latitude, club.longitude]);
    if (center) points.push(center);

    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13, { animate: true });
      return;
    }
    map.fitBounds(L.latLngBounds(points).pad(0.2), { animate: true });
  }, [clubs, center, map]);

  return null;
}

export interface ClubMapProps {
  clubs: NearbyClub[];
  center: [number, number] | null;
  /** Draws the search radius when the player has shared their location. */
  radiusKm?: number;
}

export default function ClubMap({ clubs, center, radiusKm }: ClubMapProps) {
  // Metro Manila fallback so the map is never blank before geolocation.
  const initialCenter = useMemo<[number, number]>(
    () => center ?? (clubs.length ? [clubs[0].latitude, clubs[0].longitude] : [14.5547, 121.0244]),
    [center, clubs],
  );

  return (
    <MapContainer center={initialCenter} zoom={12} scrollWheelZoom className="h-full w-full">
      {/* CartoDB Voyager: clean, low-contrast basemap that lets the brand pins read clearly. */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains={['a', 'b', 'c', 'd']}
        maxZoom={20}
      />

      <FitToResults clubs={clubs} center={center} />

      {center && (
        <CircleMarker
          center={center}
          radius={7}
          pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.9, weight: 3 }}
        >
          <Popup>You are here</Popup>
        </CircleMarker>
      )}

      {center && radiusKm ? (
        /* Circle takes a radius in metres, so the ring stays true at every zoom. */
        <Circle
          center={center}
          radius={radiusKm * 1000}
          pathOptions={{ color: '#75b61d', weight: 1.5, fillColor: '#94d13a', fillOpacity: 0.07 }}
        />
      ) : null}

      {clubs.map((club) => (
        <Marker key={club.id} position={[club.latitude, club.longitude]} icon={clubIcon}>
          <Popup>
            <div className="p-3">
              <p className="text-sm font-semibold text-zinc-900">{club.name}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{club.city}</p>

              <dl className="mt-2 space-y-1 text-xs text-zinc-600">
                <div className="flex justify-between gap-3">
                  <dt>Courts</dt>
                  <dd className="font-medium text-zinc-800">{club.courtCount}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>From</dt>
                  <dd className="font-medium text-zinc-800">
                    {club.minRate === null ? '—' : `${formatMoney(club.minRate)}/hr`}
                  </dd>
                </div>
                {club.distanceKm !== undefined && (
                  <div className="flex justify-between gap-3">
                    <dt>Distance</dt>
                    <dd className="font-medium text-zinc-800">{club.distanceKm.toFixed(1)} km</dd>
                  </div>
                )}
              </dl>

              <Link
                href={`/clubs/${club.id}`}
                className="mt-3 block rounded-lg bg-brand-500 px-3 py-2 text-center text-xs font-semibold !text-white no-underline transition-colors hover:bg-brand-600"
              >
                Book now
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
