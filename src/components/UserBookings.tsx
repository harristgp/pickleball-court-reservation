'use client';

import { CalendarX2, Clock, MapPin } from 'lucide-react';
import { courtById } from '@/lib/courts';
import { formatDateLong, formatSlotRange } from '@/lib/dates';
import { bookingsForEmail, isPastBooking, sortByStart } from '@/lib/slots';
import { EmptyState, SkillBadge, StatusBadge, cx } from './ui';
import type { Booking } from '@/types';

interface UserBookingsProps {
  bookings: Booking[];
  email: string;
  now: Date;
  onCancel: (id: string) => void;
}

/**
 * The player view of their own reservations, matched on email because mock
 * auth has no user ids. Upcoming first, then a collapsed history.
 */
export function UserBookings({ bookings, email, now, onCancel }: UserBookingsProps) {
  const mine = sortByStart(bookingsForEmail(bookings, email));
  const upcoming = mine.filter(
    (booking) => booking.status === 'CONFIRMED' && !isPastBooking(booking, now),
  );
  const history = mine.filter(
    (booking) => booking.status === 'CANCELLED' || isPastBooking(booking, now),
  );

  if (mine.length === 0) {
    return (
      <EmptyState
        icon={<CalendarX2 className="h-5 w-5" aria-hidden />}
        title="No reservations yet"
        description="Pick a date, a court, and an open hour to book your first session."
      />
    );
  }

  return (
    <div className="space-y-5">
      {upcoming.length > 0 ? (
        <ul className="space-y-3">
          {upcoming.map((booking) => (
            <BookingRow key={booking.id} booking={booking} onCancel={onCancel} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<CalendarX2 className="h-5 w-5" aria-hidden />}
          title="Nothing coming up"
          description="Your past sessions are listed below. Book another slot to get back on court."
        />
      )}

      {history.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            History
          </p>
          <ul className="space-y-2">
            {history.slice(0, 6).map((booking) => (
              <BookingRow key={booking.id} booking={booking} muted />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function BookingRow({
  booking,
  muted = false,
  onCancel,
}: {
  booking: Booking;
  muted?: boolean;
  onCancel?: (id: string) => void;
}) {
  const court = courtById(booking.courtId);

  return (
    <li
      className={cx(
        'rounded-xl border p-4 transition-colors',
        muted ? 'border-slate-200 bg-slate-50/70' : 'border-slate-200 bg-white hover:border-brand-300',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cx(
                'font-display text-sm font-semibold',
                muted ? 'text-slate-600' : 'text-slate-900',
              )}
            >
              {formatDateLong(booking.date)}
            </span>
            <StatusBadge status={booking.status} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {formatSlotRange(booking.startHour)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {court.name}
            </span>
            <SkillBadge level={booking.skillLevel} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm font-semibold tabular-nums text-slate-900">
            ${court.hourlyRate}
          </span>
          {onCancel ? (
            <button
              type="button"
              onClick={() => onCancel(booking.id)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
