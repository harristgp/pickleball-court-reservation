'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import dynamic from 'next/dynamic';
import { Crosshair, Loader2, MapPinOff, SearchX, SlidersHorizontal } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Input, Select } from '@/components/ui';
import { OwnerCard } from '@/components/discover/OwnerCard';
import { RADIUS_OPTIONS } from '@/lib/validators';
import type { FacilitySummary } from '@/lib/types';

const CourtMap = dynamic(() => import('@/components/map/CourtMap').then((m) => m.CourtMap), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-zinc-100" />,
});

type CourtFilter = 'ALL' | 'INDOOR' | 'OUTDOOR';

export function DiscoverClient({ initialFacilities }: { initialFacilities: FacilitySummary[] }) {
  const [facilities, setFacilities] = useState(initialFacilities);
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState<number>(25);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState('');
  const [courtType, setCourtType] = useState<CourtFilter>('ALL');

  const fetchNearby = useCallback(
    (lat: number, lng: number, km: number) => {
      startTransition(async () => {
        try {
          const { haversineKm } = await import('@/lib/geo');
          const filtered = initialFacilities
            .map((f) => ({
              ...f,
              distanceKm: haversineKm(lat, lng, f.latitude, f.longitude),
            }))
            .filter((f) => f.distanceKm <= km)
            .sort((a, b) => a.distanceKm - b.distanceKm);
          setFacilities(filtered);
        } catch {
          setGeoError('Could not load nearby facilities. Showing all facilities instead.');
          setFacilities(initialFacilities);
        }
      });
    },
    [initialFacilities],
  );

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('This browser does not support location sharing. Showing all facilities.');
      return;
    }

    setLocating(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        const point: [number, number] = [position.coords.latitude, position.coords.longitude];
        setOrigin(point);
        fetchNearby(point[0], point[1], radius);
      },
      (error) => {
        setLocating(false);
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission denied. Showing all facilities instead.'
            : 'Could not read your location. Showing all facilities instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [fetchNearby, radius]);

  const changeRadius = useCallback(
    (km: number) => {
      setRadius(km);
      if (origin) fetchNearby(origin[0], origin[1], km);
    },
    [fetchNearby, origin],
  );

  const clearLocation = useCallback(() => {
    setOrigin(null);
    setGeoError(null);
    setFacilities(initialFacilities);
  }, [initialFacilities]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return facilities.filter((facility) => {
      if (courtType === 'INDOOR' && !facility.hasIndoor) return false;
      if (courtType === 'OUTDOOR' && !facility.hasOutdoor) return false;
      if (!needle) return true;
      return (
        facility.name.toLowerCase().includes(needle) ||
        facility.ownerName.toLowerCase().includes(needle) ||
        facility.city.toLowerCase().includes(needle)
      );
    });
  }, [facilities, courtType, query]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="court-search" className="mb-1.5 block text-xs font-medium text-zinc-600">
              Search
            </label>
            <Input
              id="court-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Court or owner name"
            />
          </div>

          <div className="w-40">
            <label htmlFor="court-type" className="mb-1.5 block text-xs font-medium text-zinc-600">
              Court type
            </label>
            <Select
              id="court-type"
              value={courtType}
              onChange={(event) => setCourtType(event.target.value as CourtFilter)}
            >
              <option value="ALL">Indoor or outdoor</option>
              <option value="INDOOR">Indoor only</option>
              <option value="OUTDOOR">Outdoor only</option>
            </Select>
          </div>

          <Button
            type="button"
            variant={origin ? 'secondary' : 'primary'}
            onClick={locate}
            disabled={locating || pending}
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Crosshair className="h-4 w-4" aria-hidden />
            )}
            {origin ? 'Update my location' : 'Use my location'}
          </Button>
        </div>

        {origin && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
            <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Within
            </span>
            {RADIUS_OPTIONS.map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => changeRadius(km)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  radius === km ? 'bg-brand-500 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {km} km
              </button>
            ))}
            {pending && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" aria-hidden />}
            <button
              type="button"
              onClick={clearLocation}
              className="ml-auto text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
            >
              Clear location
            </button>
          </div>
        )}

        {geoError && (
          <div className="mt-3">
            <Alert tone="error">{geoError}</Alert>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-600">
              <span className="font-semibold text-zinc-900">{visible.length}</span> facilit{visible.length === 1 ? 'y' : 'ies'}
              {origin ? ` within ${radius} km` : ''}
            </p>
            {origin && <Badge tone="brand">Sorted by distance</Badge>}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={origin ? <MapPinOff className="h-8 w-8" /> : <SearchX className="h-8 w-8" />}
              title={origin ? 'No facilities in this radius' : 'No facilities match those filters'}
              description={
                origin
                  ? 'Try a wider radius, or clear your location to browse every facility.'
                  : 'Clear the search box or pick a different filter.'
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {visible.map((facility) => (
                <OwnerCard key={facility.id} facility={facility} />
              ))}
            </div>
          )}
        </div>

        <div className="h-[420px] overflow-hidden rounded-xl border border-zinc-200 shadow-card lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <CourtMap facilities={visible} center={origin ? { lat: origin[0], lng: origin[1] } : undefined} />
        </div>
      </div>
    </div>
  );
}
