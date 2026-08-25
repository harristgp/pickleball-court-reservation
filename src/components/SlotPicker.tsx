'use client';

import { formatHour } from '@/lib/dates';
import { cx } from './ui';
import type { Slot } from '@/types';

interface SlotPickerProps {
  slots: Slot[];
  selectedHour: number | null;
  onSelect: (hour: number) => void;
}

const LEGEND: Array<{ dot: string; label: string }> = [
  { dot: 'bg-white ring-1 ring-inset ring-slate-300', label: 'Open' },
  { dot: 'bg-brand-600', label: 'Selected' },
  { dot: 'bg-rose-100 ring-1 ring-inset ring-rose-200', label: 'Booked' },
  { dot: 'bg-slate-100 ring-1 ring-inset ring-slate-200', label: 'Past' },
];

/**
 * Hour grid for one court on one date.
 *
 * Booked and past hours render as disabled buttons rather than being removed,
 * which keeps the grid geometry stable across dates and makes it obvious
 * *why* an hour cannot be picked.
 */
export function SlotPicker({ slots, selectedHour, onSelect }: SlotPickerProps) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {slots.map((slot) => {
          const isSelected = slot.hour === selectedHour;
          const disabled = slot.status !== 'OPEN';

          return (
            <button
              key={slot.hour}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(slot.hour)}
              aria-pressed={isSelected}
              title={slot.label}
              className={cx(
                'rounded-lg border px-3 py-2.5 text-left transition-colors',
                slot.status === 'OPEN' &&
                  !isSelected &&
                  'border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50',
                isSelected && 'border-brand-600 bg-brand-600 text-white shadow-sm',
                slot.status === 'BOOKED' &&
                  'cursor-not-allowed border-rose-200 bg-rose-50 text-rose-400',
                slot.status === 'PAST' &&
                  'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-300',
              )}
            >
              <span
                className={cx(
                  'block text-sm font-semibold tabular-nums',
                  slot.status === 'OPEN' && !isSelected && 'text-slate-900',
                )}
              >
                {formatHour(slot.hour)}
              </span>
              <span
                className={cx(
                  'mt-0.5 block text-[11px]',
                  isSelected ? 'text-white/80' : 'text-current opacity-80',
                )}
              >
                {slot.status === 'BOOKED' ? 'Booked' : slot.status === 'PAST' ? 'Passed' : '1 hour'}
              </span>
            </button>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {LEGEND.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className={cx('h-2.5 w-2.5 rounded-sm', item.dot)} aria-hidden />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
