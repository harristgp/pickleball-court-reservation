'use client';

import { Lightbulb, LightbulbOff } from 'lucide-react';
import { COURTS, SLOTS_PER_DAY } from '@/lib/courts';
import { openSlotCount } from '@/lib/slots';
import { cx, SurfaceBadge } from './ui';
import type { Booking } from '@/types';

interface CourtMapProps {
  bookings: Booking[];
  date: string;
  now: Date;
  selectedCourtId: string;
  onSelect: (courtId: string) => void;
}

/**
 * The four courts, laid out as a picker. Each card carries live availability
 * for the selected date so the choice is informed before the slot grid loads.
 */
export function CourtMap({ bookings, date, now, selectedCourtId, onSelect }: CourtMapProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {COURTS.map((court) => {
        const open = openSlotCount(bookings, court.id, date, now);
        const isSelected = court.id === selectedCourtId;
        const full = open === 0;

        return (
          <button
            key={court.id}
            type="button"
            onClick={() => onSelect(court.id)}
            aria-pressed={isSelected}
            className={cx(
              'group rounded-xl border p-4 text-left transition-all',
              isSelected
                ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-500/30'
                : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-semibold text-slate-900">
                  {court.name}
                </span>
                <SurfaceBadge surface={court.surface} />
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">
                ${court.hourlyRate}
                <span className="text-xs font-normal text-slate-500">/hr</span>
              </span>
            </div>

            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
              {court.description}
            </p>

            <div className="mt-3 flex items-center justify-between gap-2">
              <span
                className={cx(
                  'text-xs font-medium',
                  full ? 'text-slate-400' : 'text-brand-700',
                )}
              >
                {full ? 'Fully booked' : `${open} of ${SLOTS_PER_DAY} slots open`}
              </span>
              <span
                className="inline-flex items-center gap-1 text-[11px] text-slate-400"
                title={court.hasLights ? 'Lit until close' : 'Daylight play only'}
              >
                {court.hasLights ? (
                  <Lightbulb className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <LightbulbOff className="h-3.5 w-3.5" aria-hidden />
                )}
                {court.hasLights ? 'Lights' : 'No lights'}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
