'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFormState } from 'react-dom';
import { Building2, CalendarDays, Clock, Info, Loader2, Trees, X } from 'lucide-react';
import { createMultiBookingAction } from '@/actions/booking';
import { Alert, Badge, SubmitButton, Textarea } from '@/components/ui';
import {
  addDaysToKey,
  formatDateKey,
  formatDateKeyShort,
  formatHour,
  formatSlotRange,
  todayKey,
} from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { IDLE_ACTION_STATE, type CourtAvailability, type MultiSlotSelection } from '@/lib/types';

const DAYS_AHEAD = 14;

export function MultiCourtGrid({
  facilityId,
  ownerId,
  dateKey,
  courts,
  isSignedIn,
  paymentMethods,
}: {
  facilityId: string;
  ownerId: string;
  dateKey: string;
  courts: CourtAvailability[];
  isSignedIn: boolean;
  paymentMethods: Array<{ id: string; name: string; accountName: string; qrCodeUrl: string | null; instructions: string }>;
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<MultiSlotSelection[]>([]);
  const [state, formAction] = useFormState(createMultiBookingAction, IDLE_ACTION_STATE);

  const today = todayKey();
  const days = useMemo(
    () => Array.from({ length: DAYS_AHEAD }, (_, index) => addDaysToKey(today, index)),
    [today],
  );

  const hours = useMemo(() => {
    const set = new Set<number>();
    for (const court of courts) {
      for (const slot of court.slots) {
        if (slot.state !== 'closed') set.add(slot.hour);
      }
    }
    return [...set].sort((a, b) => a - b);
  }, [courts]);

  const total = useMemo(
    () => selections.reduce((sum, s) => sum + s.rate, 0),
    [selections],
  );

  useEffect(() => {
    if (state.message && !state.ok) setSelections([]);
  }, [state]);

  const toggleSlot = useCallback(
    (courtId: string, courtName: string, hour: number, rate: number) => {
      setSelections((prev) => {
        const existing = prev.findIndex((s) => s.courtId === courtId && s.hour === hour);
        if (existing >= 0) {
          return prev.filter((_, i) => i !== existing);
        }
        return [...prev, { courtId, courtName, hour, rate, dateKey }].sort(
          (a, b) => a.hour - b.hour || a.courtName.localeCompare(b.courtName),
        );
      });
    },
    [dateKey],
  );

  function changeDate(nextKey: string) {
    setSelections([]);
    router.push(`/browse/facility/${facilityId}?date=${nextKey}`, { scroll: false });
  }

  const isSlotSelected = useCallback(
    (courtId: string, hour: number) => selections.some((s) => s.courtId === courtId && s.hour === hour),
    [selections],
  );

  return (
    <div className="space-y-5">
      <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
        {days.map((key) => {
          const { weekday, day } = formatDateKeyShort(key);
          const active = key === dateKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => changeDate(key)}
              aria-pressed={active}
              className={cn(
                'flex w-14 shrink-0 flex-col items-center rounded-lg border px-2 py-2 transition-colors',
                active
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-brand-300 hover:bg-brand-50',
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{weekday}</span>
              <span className="text-base font-bold leading-tight">{day}</span>
            </button>
          );
        })}
      </div>

      {state.message && <Alert tone={state.ok ? 'success' : 'error'}>{state.message}</Alert>}

      <div className="rounded-xl border border-zinc-200 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <CalendarDays className="h-4 w-4 text-brand-600" aria-hidden />
            {formatDateKey(dateKey)}
          </h2>
          <Legend />
        </div>

        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[168px] bg-white px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Court
                </th>
                {hours.map((hour) => (
                  <th
                    key={hour}
                    className="min-w-[74px] px-1 py-2 text-center text-[11px] font-medium text-zinc-500"
                  >
                    {formatHour(hour).replace(':00', '')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courts.map((court) => (
                <tr key={court.courtId} className="border-t border-zinc-100">
                  <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3 text-left align-middle">
                    <span className="block text-sm font-semibold text-zinc-900">{court.courtName}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <Badge tone={court.courtType === 'INDOOR' ? 'blue' : 'emerald'}>
                        {court.courtType === 'INDOOR' ? (
                          <Building2 className="h-3 w-3" aria-hidden />
                        ) : (
                          <Trees className="h-3 w-3" aria-hidden />
                        )}
                        {court.courtType === 'INDOOR' ? 'Indoor' : 'Outdoor'}
                      </Badge>
                      <span className="text-xs font-medium text-zinc-500">
                        {formatMoney(court.hourlyRate)}/hr
                      </span>
                    </span>
                  </th>

                  {hours.map((hour) => {
                    const slot = court.slots.find((entry) => entry.hour === hour);
                    const slotState = slot?.state ?? 'closed';
                    const selected = isSlotSelected(court.courtId, hour);

                    return (
                      <td key={hour} className="p-1 text-center">
                        <button
                          type="button"
                          disabled={slotState !== 'available'}
                          aria-pressed={selected}
                          aria-label={`${court.courtName}, ${formatSlotRange(hour)}, ${slotState}`}
                          onClick={() => toggleSlot(court.courtId, court.courtName, hour, court.hourlyRate)}
                          className={cn(
                            'h-9 w-full rounded-md text-[11px] font-semibold transition-all',
                            slotState === 'available' &&
                              !selected &&
                              'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-100',
                            selected && 'bg-brand-500 text-white shadow-sm ring-2 ring-brand-600',
                            slotState === 'booked' && 'cursor-not-allowed bg-red-50 text-red-400 line-through',
                            slotState === 'past' && 'cursor-not-allowed bg-zinc-50 text-zinc-300',
                            slotState === 'closed' && 'cursor-not-allowed bg-zinc-100/70 text-zinc-300',
                          )}
                        >
                          {slotState === 'available' || selected
                            ? selected
                              ? '✓'
                              : 'Open'
                            : slotState === 'booked'
                              ? 'Taken'
                              : '—'}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selections.length > 0 ? (
        <form
          action={formAction}
          className="animate-fade-in rounded-xl border border-brand-300 bg-brand-50/60 p-5 shadow-card"
        >
          <input type="hidden" name="facilityId" value={facilityId} />
          <input type="hidden" name="date" value={dateKey} />
          <input type="hidden" name="slots" value={JSON.stringify(selections.map((s) => ({ courtId: s.courtId, hour: s.hour })))} />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Your selection</p>
              <ul className="mt-2 space-y-1">
                {selections.map((s) => (
                  <li key={`${s.courtId}-${s.hour}`} className="flex items-center gap-2 text-sm text-zinc-700">
                    <span className="font-semibold">{s.courtName}</span>
                    <span className="text-zinc-400">·</span>
                    <Clock className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                    {formatSlotRange(s.hour)}
                    <button
                      type="button"
                      onClick={() => toggleSlot(s.courtId, s.courtName, s.hour, s.rate)}
                      className="ml-1 text-zinc-400 hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="text-right">
              <p className="text-xs font-medium text-zinc-500">Total ({selections.length} hour{selections.length === 1 ? '' : 's'})</p>
              <p className="text-2xl font-bold text-zinc-900">{formatMoney(total)}</p>
            </div>
          </div>

          <div className="mt-4">
            <label htmlFor="notes" className="mb-1.5 block text-xs font-medium text-zinc-600">
              Note for the owner (optional)
            </label>
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={280}
              placeholder="Bringing 3 guests, need paddle rental…"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SubmitButton size="lg" pendingLabel="Holding your slots…">
              Book {selections.length} hour{selections.length === 1 ? '' : 's'} — {formatMoney(total)}
            </SubmitButton>
            <button
              type="button"
              onClick={() => setSelections([])}
              className="text-sm font-medium text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline"
            >
              Clear all
            </button>
            {!isSignedIn && (
              <span className="text-xs text-zinc-500">You will be asked to sign in first.</span>
            )}
          </div>

          <p className="mt-3 flex items-start gap-1.5 text-xs text-zinc-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            Booking holds all selected slots for 30 minutes while you pay and upload your receipt.
          </p>
        </form>
      ) : (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-center text-sm text-zinc-500">
          Click open slots to select multiple hours across courts, then hit Book.
        </p>
      )}
    </div>
  );
}

function Legend() {
  const items = [
    { label: 'Open', className: 'bg-brand-100 ring-brand-300' },
    { label: 'Selected', className: 'bg-brand-500 ring-brand-600' },
    { label: 'Taken', className: 'bg-red-100 ring-red-300' },
    { label: 'Past', className: 'bg-zinc-100 ring-zinc-300' },
    { label: 'Closed', className: 'bg-zinc-200 ring-zinc-300' },
  ];

  return (
    <ul className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className={cn('h-3 w-3 rounded ring-1 ring-inset', item.className)} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
