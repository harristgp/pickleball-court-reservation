'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Pencil, X } from 'lucide-react';
import { Alert, Button, Field, Input, SubmitButton } from '@/components/ui';
import { addCourtAction, updateCourtAction } from '@/actions/facility';
import { IDLE_ACTION_STATE } from '@/lib/types';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

interface Court {
  id: string;
  name: string;
  type: string;
  hourlyRate: number;
  openHour: number;
  closeHour: number;
  isActive: boolean;
}

export function FacilityCourtManager({
  facilityId,
  courts,
}: {
  facilityId: string;
  courts: Court[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-zinc-900">Courts</h2>

      {courts.length === 0 && (
        <p className="text-sm text-zinc-500">No courts yet. Add one below.</p>
      )}

      <div className="space-y-3">
        {courts.map((court) => (
          <div
            key={court.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span className="font-medium text-zinc-900">{court.name}</span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-xs font-medium',
                  court.type === 'INDOOR' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700',
                )}
              >
                {court.type === 'INDOOR' ? 'Indoor' : 'Outdoor'}
              </span>
              <span className="text-sm text-zinc-500">{formatMoney(court.hourlyRate)}/hr</span>
              {!court.isActive && <span className="text-xs text-red-400">(disabled)</span>}
            </div>
            <button
              type="button"
              onClick={() => setEditingId(editingId === court.id ? null : court.id)}
              className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              {editingId === court.id ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-card">
        <h3 className="mb-3 text-sm font-semibold text-zinc-700">Add new court</h3>
        <CourtForm facilityId={facilityId} />
      </div>

      {editingId && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5">
          <h3 className="mb-3 text-sm font-semibold text-zinc-700">Edit court</h3>
          <CourtForm
            facilityId={facilityId}
            court={courts.find((c) => c.id === editingId)!}
            onDone={() => setEditingId(null)}
          />
        </div>
      )}
    </div>
  );
}

function CourtForm({
  facilityId,
  court,
  onDone,
}: {
  facilityId: string;
  court?: Court;
  onDone?: () => void;
}) {
  const action = court ? updateCourtAction : addCourtAction;
  const [state, formAction] = useFormState(action, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="space-y-3">
      {court && <input type="hidden" name="courtId" value={court.id} />}
      <input type="hidden" name="facilityId" value={facilityId} />

      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Field label="Court name" htmlFor={`name-${court?.id ?? 'new'}`} error={state.fieldErrors?.name}>
          <Input
            id={`name-${court?.id ?? 'new'}`}
            name="name"
            defaultValue={court?.name ?? ''}
            placeholder="Court A"
            required
          />
        </Field>

        <div>
          <label htmlFor={`type-${court?.id ?? 'new'}`} className="mb-1 block text-xs font-medium text-zinc-600">
            Type
          </label>
          <select
            id={`type-${court?.id ?? 'new'}`}
            name="type"
            defaultValue={court?.type ?? 'OUTDOOR'}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="OUTDOOR">Outdoor</option>
            <option value="INDOOR">Indoor</option>
          </select>
        </div>

        <Field label="Rate ($/hr)" htmlFor={`hourlyRate-${court?.id ?? 'new'}`} error={state.fieldErrors?.hourlyRate}>
          <Input
            id={`hourlyRate-${court?.id ?? 'new'}`}
            name="hourlyRate"
            type="number"
            min={0}
            step={0.01}
            defaultValue={court?.hourlyRate?.toString() ?? '10'}
            required
          />
        </Field>

        <Field label="Open hour" htmlFor={`openHour-${court?.id ?? 'new'}`}>
          <Input
            id={`openHour-${court?.id ?? 'new'}`}
            name="openHour"
            type="number"
            min={0}
            max={23}
            defaultValue={court?.openHour?.toString() ?? '6'}
            required
          />
        </Field>

        <Field label="Close hour" htmlFor={`closeHour-${court?.id ?? 'new'}`}>
          <Input
            id={`closeHour-${court?.id ?? 'new'}`}
            name="closeHour"
            type="number"
            min={1}
            max={24}
            defaultValue={court?.closeHour?.toString() ?? '22'}
            required
          />
        </Field>
      </div>

      {court && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={court.isActive}
            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
          />
          Active
        </label>
      )}

      <div className="flex gap-2">
        <SubmitButton size="sm">{court ? 'Update court' : 'Add court'}</SubmitButton>
        {onDone && (
          <Button onClick={onDone} variant="ghost" size="sm">
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
