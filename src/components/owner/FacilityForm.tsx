'use client';

import { useFormState } from 'react-dom';
import Link from 'next/link';
import { Alert, Button, Field, Input, SubmitButton, Textarea } from '@/components/ui';
import { createFacilityAction, updateFacilityAction } from '@/actions/facility';
import { IDLE_ACTION_STATE } from '@/lib/types';

export function FacilityForm({
  facility,
}: {
  facility?: {
    id: string;
    name: string;
    description: string | null;
    address: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
    openHour: number;
    closeHour: number;
    isActive: boolean;
  };
}) {
  const action = facility ? updateFacilityAction : createFacilityAction;
  const [state, formAction] = useFormState(action, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-card">
      {facility && <input type="hidden" name="facilityId" value={facility.id} />}

      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

      <Field label="Facility name" htmlFor="name" error={state.fieldErrors?.name}>
        <Input
          id="name"
          name="name"
          defaultValue={facility?.name}
          placeholder="Pickleball Paradise"
          required
        />
      </Field>

      <Field label="Description (optional)" htmlFor="description">
        <Textarea
          id="description"
          name="description"
          defaultValue={facility?.description ?? ''}
          rows={3}
          placeholder="Tell players what makes your facility special…"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Street address" htmlFor="address" error={state.fieldErrors?.address}>
          <Input
            id="address"
            name="address"
            defaultValue={facility?.address}
            placeholder="123 Main St"
            required
          />
        </Field>
        <Field label="City" htmlFor="city" error={state.fieldErrors?.city}>
          <Input
            id="city"
            name="city"
            defaultValue={facility?.city}
            placeholder="Austin"
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Latitude (optional)" htmlFor="latitude" error={state.fieldErrors?.latitude}>
          <Input
            id="latitude"
            name="latitude"
            type="number"
            step="any"
            defaultValue={facility?.latitude?.toString() ?? ''}
            placeholder="30.2672"
          />
        </Field>
        <Field label="Longitude (optional)" htmlFor="longitude" error={state.fieldErrors?.longitude}>
          <Input
            id="longitude"
            name="longitude"
            type="number"
            step="any"
            defaultValue={facility?.longitude?.toString() ?? ''}
            placeholder="-97.7431"
          />
        </Field>
        <Field label="Open hour" htmlFor="openHour" error={state.fieldErrors?.openHour}>
          <Input
            id="openHour"
            name="openHour"
            type="number"
            min={0}
            max={23}
            defaultValue={facility?.openHour ?? 6}
            required
          />
        </Field>
        <Field label="Close hour" htmlFor="closeHour" error={state.fieldErrors?.closeHour}>
          <Input
            id="closeHour"
            name="closeHour"
            type="number"
            min={1}
            max={24}
            defaultValue={facility?.closeHour ?? 22}
            required
          />
        </Field>
      </div>

      {facility && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={facility.isActive}
            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
          />
          Active (visible to players)
        </label>
      )}

      <div className="flex gap-3 pt-2">
        <SubmitButton>{facility ? 'Save changes' : 'Create facility'}</SubmitButton>
        {facility && (
          <Link href="/owner/facilities">
            <Button variant="ghost">Cancel</Button>
          </Link>
        )}
      </div>
    </form>
  );
}
