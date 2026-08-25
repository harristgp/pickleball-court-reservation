'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Crosshair, Trophy } from 'lucide-react';
import { registerClubAction } from '@/actions/owner';
import { IDLE_ACTION_STATE } from '@/lib/types';
import { Alert, Field, Input, SubmitButton, Textarea } from '@/components/ui';

type GeoState = 'idle' | 'locating' | 'denied' | 'unsupported';

const GEO_MESSAGE: Record<GeoState, string | null> = {
  idle: null,
  locating: 'Finding your position…',
  denied: 'Location permission was refused. Type the coordinates in manually.',
  unsupported: 'This browser cannot share a location. Type the coordinates in manually.',
};

/**
 * Club registration for an owner who signed up through /register.
 *
 * Coordinates are entered rather than geocoded: geocoding needs a third-party
 * API key, and the map only needs a lat/lng pair. The browser can fill both in
 * one click when the owner is standing at the club.
 */
export function ClubSetupForm() {
  const [state, formAction] = useFormState(registerClubAction, IDLE_ACTION_STATE);
  const [coords, setCoords] = useState<{ lat: string; lng: string }>({ lat: '', lng: '' });
  const [geo, setGeo] = useState<GeoState>('idle');

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeo('unsupported');
      return;
    }
    setGeo('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
        });
        setGeo('idle');
      },
      () => setGeo('denied'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const geoMessage = GEO_MESSAGE[geo];

  return (
    <form action={formAction} className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <Trophy className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Set up your club</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            This is what players see on the discover map. You can change any of it later.
          </p>
        </div>
      </div>

      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

      <Field label="Club name" htmlFor="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" placeholder="Smash City BGC" required maxLength={80} />
      </Field>

      <Field
        label="Description"
        htmlFor="description"
        hint="Surface type, lighting, parking — whatever helps a player choose."
        error={state.fieldErrors?.description}
      >
        <Textarea
          id="description"
          name="description"
          rows={3}
          required
          maxLength={1000}
          placeholder="Four cushioned indoor courts with tournament-grade lighting and free parking."
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Street address" htmlFor="address" error={state.fieldErrors?.address}>
          <Input id="address" name="address" placeholder="7th Avenue corner 29th Street" required maxLength={160} />
        </Field>
        <Field label="City" htmlFor="city" error={state.fieldErrors?.city}>
          <Input id="city" name="city" placeholder="Taguig" required maxLength={80} />
        </Field>
      </div>

      <Field label="Contact number" htmlFor="phone" hint="Optional" error={state.fieldErrors?.phone}>
        <Input id="phone" name="phone" placeholder="0917 555 0142" maxLength={32} />
      </Field>

      <fieldset className="rounded-xl border border-zinc-200 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Map location</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Latitude" htmlFor="latitude" error={state.fieldErrors?.latitude}>
            <Input
              id="latitude"
              name="latitude"
              type="number"
              step="any"
              min={-90}
              max={90}
              required
              placeholder="14.550700"
              value={coords.lat}
              onChange={(event) => setCoords((current) => ({ ...current, lat: event.target.value }))}
            />
          </Field>
          <Field label="Longitude" htmlFor="longitude" error={state.fieldErrors?.longitude}>
            <Input
              id="longitude"
              name="longitude"
              type="number"
              step="any"
              min={-180}
              max={180}
              required
              placeholder="121.050100"
              value={coords.lng}
              onChange={(event) => setCoords((current) => ({ ...current, lng: event.target.value }))}
            />
          </Field>
        </div>

        <button
          type="button"
          onClick={useMyLocation}
          disabled={geo === 'locating'}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm ring-1 ring-inset ring-zinc-300 transition-colors hover:bg-zinc-50 disabled:opacity-60"
        >
          <Crosshair className="h-3.5 w-3.5" aria-hidden />
          Use my current location
        </button>

        {geoMessage && <p className="mt-2 text-xs text-zinc-500">{geoMessage}</p>}
        <p className="mt-2 text-xs text-zinc-400">
          Standing somewhere else? Right-click the spot on Google Maps and paste the two numbers it shows.
        </p>
      </fieldset>

      <SubmitButton>Create club</SubmitButton>
    </form>
  );
}
