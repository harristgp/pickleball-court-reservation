'use client';

import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import Link from 'next/link';
import { Badge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import type { FacilitySummary } from '@/lib/types';

function createCourtIcon() {
  return L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    html: `<div class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg ring-2 ring-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg></div>`,
  });
}

function LocationButton({ onLocate }: { onLocate: () => void }) {
  const map = useMap();
  return (
    <button
      type="button"
      onClick={() => {
        map.locate({ setView: true, maxZoom: 14 });
        onLocate();
      }}
      className="absolute bottom-4 right-4 z-[1000] rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-700 shadow-lg ring-1 ring-zinc-200 hover:bg-zinc-50"
    >
      Use my location
    </button>
  );
}

export function CourtMap({
  facilities,
  center,
  onSelectCourt,
}: {
  facilities: FacilitySummary[];
  center?: { lat: number; lng: number };
  onSelectCourt?: (court: FacilitySummary) => void;
}) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const defaultCenter = useMemo(
    () => (center ? [center.lat, center.lng] : [14.5995, 120.9842]) as [number, number],
    [center],
  );

  const icon = useMemo(() => createCourtIcon(), []);

  useEffect(() => {
    if (!center) {
      navigator.geolocation?.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
      );
    }
  }, [center]);

  return (
    <div className="relative h-[400px] w-full overflow-hidden rounded-xl">
      <MapContainer
        center={userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter}
        zoom={12}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <LocationButton onLocate={() => {}} />
        {facilities.map((court) => (
          <Marker
            key={court.id}
            position={[court.latitude, court.longitude]}
            icon={icon}
            eventHandlers={{
              click: () => onSelectCourt?.(court),
            }}
          >
            <Popup>
              <div className="min-w-[180px] p-1">
                <Link href={`/browse/facility/${court.id}`} className="block">
                  <p className="text-sm font-semibold text-zinc-900 hover:text-brand-700">{court.name}</p>
                  <p className="text-xs text-zinc-500">{court.ownerName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {court.hasIndoor && <Badge tone="blue">Indoor</Badge>}
                    {court.hasOutdoor && <Badge tone="emerald">Outdoor</Badge>}
                  </div>
                  <p className="mt-1 text-xs font-medium text-zinc-700">
                    {court.minRate !== null ? formatMoney(court.minRate) : 'Contact'}+/hr
                  </p>
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
