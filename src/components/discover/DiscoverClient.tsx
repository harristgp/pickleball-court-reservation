'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { Crosshair, Loader2, MapPinOff, SearchX, SlidersHorizontal } from 'lucide-react';
import { Alert, Badge, Button, EmptyState, Input, Select } from '@/components/ui';
import { ClubCard } from '@/components/discover/ClubCard';
import { MapPanel } from '@/components/map/MapPanel';
import { RADIUS_OPTIONS } from '@/lib/validators';
import type { NearbyClub } from '@/lib/types';

type CourtFilter = 'ALL' | 'INDOOR' | 'OUTDOOR';

export function DiscoverClient({ initialClubs }: { initialClubs: NearbyClub[] }) {
  const [clubs, setClubs] = useState(initialClubs);
  const [origin, setOrigin] = useState<[number, number] | null>(null);
  const [radius, setRadius] = useState<number>(25);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pending, startTransition] = useTransition();

  const [query, setQuery] = useState('');
  const [city, setCity] = useState('ALL');
  const [courtType, setCourtType] = useState<CourtFilter>('ALL');

  const cities = useMemo(
    () => Array.from(new Set(initialClubs.map((club) => club.city))).sort(),
    [initialClubs],
  );

  const fetchNearby = useCallback(
    (lat: number, lng: number, km: number) => {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/clubs/nearby?lat=${lat}&lng=${lng}&radius=${km}`);
          if (!response.ok) throw new Error('Nearby search failed');
          const data: { clubs: NearbyClub[] } = await response.json();
          setClubs(data.clubs);
        } catch {
          setGeoError('Could not load nearby clubs. Showing all clubs instead.');
          setClubs(initialClubs);
        }
      });
    },
    [initialClubs],
  );

  const locate = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('This browser does not support location sharing. Showing all clubs.');
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
        // A denied or unavailable location must never blank the page: the full
        // club list is still perfectly usable, just unsorted by distance.
        setGeoError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission denied. Showing all clubs instead.'
            : 'Could not read your location. Showing all clubs instead.',
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
    setClubs(initialClubs);
  }, [initialClubs]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return clubs.filter((club) => {
      if (city !== 'ALL' && club.city !== city) return false;
      if (courtType === 'INDOOR' && !club.hasIndoor) return false;
      if (courtType === 'OUTDOOR' && !club.hasOutdoor) return false;
      if (!needle) return true;
      return (
        club.name.toLowerCase().includes(needle) ||
        club.city.toLowerCase().includes(needle) ||
        club.address.toLowerCase().includes(needle)
      );
    });
  }, [city, clubs, courtType, query]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="club-search" className="mb-1.5 block text-xs font-medium text-zinc-600">
              Search
            </label>
            <Input
              id="club-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Club name, city, or street"
            />
          </div>

          <div className="w-40">
            <label htmlFor="club-city" className="mb-1.5 block text-xs font-medium text-zinc-600">
              City
            </label>
            <Select id="club-city" value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="ALL">All cities</option>
              {cities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-40">
            <label htmlFor="club-type" className="mb-1.5 block text-xs font-medium text-zinc-600">
              Court type
            </label>
            <Select
              id="club-type"
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
              <span className="font-semibold text-zinc-900">{visible.length}</span> club
              {visible.length === 1 ? '' : 's'}
              {origin ? ` within ${radius} km` : ''}
            </p>
            {origin && <Badge tone="brand">Sorted by distance</Badge>}
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={origin ? <MapPinOff className="h-8 w-8" /> : <SearchX className="h-8 w-8" />}
              title={origin ? 'No clubs in this radius' : 'No clubs match those filters'}
              description={
                origin
                  ? 'Try a wider radius, or clear your location to browse every club.'
                  : 'Clear the search box or pick a different city.'
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {visible.map((club) => (
                <ClubCard key={club.id} club={club} />
              ))}
            </div>
          )}
        </div>

        <div className="h-[420px] overflow-hidden rounded-xl border border-zinc-200 shadow-card lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]">
          <MapPanel clubs={visible} center={origin} radiusKm={origin ? radius : undefined} />
        </div>
      </div>
    </div>
  );
}
