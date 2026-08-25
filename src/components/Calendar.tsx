'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  buildMonthGrid,
  isBefore,
  monthLabel,
  monthOf,
  sameMonth,
  shiftMonth,
  WEEKDAY_INITIALS,
} from '@/lib/dates';
import { cx } from './ui';

interface CalendarProps {
  /** Currently selected date key. */
  selected: string;
  /** Today, as computed on the client. Earlier days are not selectable. */
  today: string;
  /** Confirmed bookings per date key, drives the density dot. */
  counts: Record<string, number>;
  onSelect: (date: string) => void;
}

/**
 * Month grid with keyboard-reachable day buttons.
 *
 * Past days are disabled rather than hidden so the month keeps its shape and
 * the visitor can still see where today sits in the week.
 */
export function Calendar({ selected, today, counts, onSelect }: CalendarProps) {
  const [cursor, setCursor] = useState(() => monthOf(selected));

  // Follow the selection when it lands outside the visible month, e.g. after
  // a jump from one of the quick-pick chips.
  useEffect(() => {
    const target = monthOf(selected);
    setCursor((current) => (sameMonth(current, target) ? current : target));
  }, [selected]);

  const weeks = useMemo(() => buildMonthGrid(cursor.year, cursor.monthIndex), [cursor]);
  const atStart = sameMonth(cursor, monthOf(today));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor((current) => shiftMonth(current, -1))}
          disabled={atStart}
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>

        <p className="font-display text-sm font-semibold text-slate-900" aria-live="polite">
          {monthLabel(cursor.year, cursor.monthIndex)}
        </p>

        <button
          type="button"
          onClick={() => setCursor((current) => shiftMonth(current, 1))}
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_INITIALS.map((initial, index) => (
          <span
            key={`${initial}-${index}`}
            className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
          >
            {initial}
          </span>
        ))}

        {weeks.map((week, weekIndex) =>
          week.map((day, dayIndex) => {
            if (day === null) {
              return <span key={`blank-${weekIndex}-${dayIndex}`} aria-hidden />;
            }

            const isSelected = day === selected;
            const isToday = day === today;
            const isPast = isBefore(day, today);
            const count = counts[day] ?? 0;

            return (
              <button
                key={day}
                type="button"
                onClick={() => onSelect(day)}
                disabled={isPast}
                aria-pressed={isSelected}
                aria-label={`${day}${count > 0 ? `, ${count} booked` : ''}`}
                className={cx(
                  'relative aspect-square rounded-lg text-sm font-medium transition-colors',
                  isPast && 'cursor-not-allowed text-slate-300',
                  !isPast && !isSelected && 'text-slate-700 hover:bg-brand-50 hover:text-brand-800',
                  isSelected && 'bg-brand-600 text-white shadow-sm',
                  !isSelected && isToday && 'ring-1 ring-inset ring-brand-400',
                )}
              >
                {Number(day.slice(8))}
                {count > 0 ? (
                  <span
                    aria-hidden
                    className={cx(
                      'absolute inset-x-0 bottom-1 mx-auto h-1 w-1 rounded-full',
                      isSelected ? 'bg-white/80' : 'bg-brand-500',
                    )}
                  />
                ) : null}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
