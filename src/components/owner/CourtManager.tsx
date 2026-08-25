'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { Pencil, Plus, Trash2, Trophy } from 'lucide-react';
import { saveCourtAction, deleteCourtAction } from '@/actions/owner';
import { formatHour } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { IDLE_ACTION_STATE } from '@/lib/types';
import { Alert, Badge, Button, Card, EmptyState, Field, Input, Select, SubmitButton } from '@/components/ui';

export interface CourtRow {
  id: string;
  name: string;
  type: 'INDOOR' | 'OUTDOOR';
  hourlyRate: number;
  openHour: number;
  closeHour: number;
  isActive: boolean;
  bookingCount: number;
}

const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

export function CourtManager({ courts }: { courts: CourtRow[] }) {
  const [editing, setEditing] = useState<CourtRow | null>(null);
  const [creating, setCreating] = useState(courts.length === 0);

  const open = creating || editing !== null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {courts.length} court{courts.length === 1 ? '' : 's'} · players can only book active courts.
        </p>
        {!open && (
          <Button
            onClick={() => {
              setEditing(null);
              setCreating(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add court
          </Button>
        )}
      </div>

      {open && (
        <CourtForm
          key={editing?.id ?? 'new'}
          court={editing}
          onDone={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      {courts.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<Trophy className="h-6 w-6" aria-hidden />}
            title="No courts yet"
            description="Add your first court so players have something to book."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Court</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Rate / hour</th>
                  <th className="px-4 py-3">Open hours</th>
                  <th className="px-4 py-3">Bookings</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {courts.map((court) => (
                  <tr key={court.id} className={court.isActive ? '' : 'bg-zinc-50/60 text-zinc-400'}>
                    <td className="px-4 py-3 font-medium text-zinc-900">
                      <span className="flex items-center gap-2">
                        {court.name}
                        {!court.isActive && <Badge tone="neutral">Inactive</Badge>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={court.type === 'INDOOR' ? 'blue' : 'emerald'}>
                        {court.type === 'INDOOR' ? 'Indoor' : 'Outdoor'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatMoney(court.hourlyRate)}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {formatHour(court.openHour)} – {formatHour(court.closeHour)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{court.bookingCount}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setCreating(false);
                            setEditing(court);
                          }}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                          Edit
                        </button>
                        <DeleteCourtButton courtId={court.id} hasBookings={court.bookingCount > 0} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CourtForm({ court, onDone }: { court: CourtRow | null; onDone: () => void }) {
  const [state, formAction] = useFormState(saveCourtAction, IDLE_ACTION_STATE);

  return (
    <Card className="border-brand-200 bg-brand-50/40 p-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="id" value={court?.id ?? ''} />

        <h3 className="font-semibold text-zinc-900">{court ? `Edit ${court.name}` : 'New court'}</h3>
        {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
            <Input id="name" name="name" required defaultValue={court?.name ?? ''} placeholder="Court 1" />
          </Field>
          <Field label="Surface" htmlFor="type" error={state.fieldErrors?.type}>
            <Select id="type" name="type" defaultValue={court?.type ?? 'OUTDOOR'}>
              <option value="OUTDOOR">Outdoor</option>
              <option value="INDOOR">Indoor</option>
            </Select>
          </Field>
          <Field label="Rate per hour" htmlFor="hourlyRate" error={state.fieldErrors?.hourlyRate}>
            <Input
              id="hourlyRate"
              name="hourlyRate"
              type="number"
              min="1"
              step="0.01"
              required
              defaultValue={court?.hourlyRate ?? 400}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Opens" htmlFor="openHour" error={state.fieldErrors?.openHour}>
              <Select id="openHour" name="openHour" defaultValue={String(court?.openHour ?? 6)}>
                {HOURS.slice(0, 24).map((hour) => (
                  <option key={hour} value={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Closes" htmlFor="closeHour" error={state.fieldErrors?.closeHour}>
              <Select id="closeHour" name="closeHour" defaultValue={String(court?.closeHour ?? 22)}>
                {HOURS.slice(1).map((hour) => (
                  <option key={hour} value={hour}>
                    {formatHour(hour)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={court?.isActive ?? true}
            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500"
          />
          Bookable by players
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <SubmitButton pendingLabel="Saving…">{court ? 'Save changes' : 'Create court'}</SubmitButton>
          <button
            type="button"
            onClick={onDone}
            className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
          >
            {state.ok ? 'Close' : 'Cancel'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function DeleteCourtButton({ courtId, hasBookings }: { courtId: string; hasBookings: boolean }) {
  const [state, formAction] = useFormState(deleteCourtAction, IDLE_ACTION_STATE);

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="courtId" value={courtId} />
      {state.message && <span className="text-xs text-zinc-500">{state.message}</span>}
      <SubmitButton variant="ghost" size="sm" pendingLabel="…" className="text-red-600 hover:bg-red-50">
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        {hasBookings ? 'Deactivate' : 'Delete'}
      </SubmitButton>
    </form>
  );
}
