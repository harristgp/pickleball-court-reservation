import { CLOSE_HOUR, OPEN_HOUR } from './courts';
import { formatSlotRange, fromDateKey } from './dates';
import type { Booking, Slot } from '@/types';

/**
 * The slot engine. Every availability question in the app resolves here, so
 * the calendar, the court cards, the picker, and the save path can never
 * disagree about whether an hour is free.
 */

/** Only confirmed rows hold a slot. Cancelling is what releases one. */
export function isActive(booking: Booking): boolean {
  return booking.status === 'CONFIRMED';
}

export function activeBookings(bookings: Booking[]): Booking[] {
  return bookings.filter(isActive);
}

/**
 * The single source of truth for "is this hour taken". Slots are fixed
 * one-hour blocks aligned to the clock, so an exact match on
 * (court, date, startHour) is a complete overlap test - no interval maths.
 */
export function findConflict(
  bookings: Booking[],
  courtId: string,
  date: string,
  startHour: number,
): Booking | null {
  return (
    bookings.find(
      (booking) =>
        isActive(booking) &&
        booking.courtId === courtId &&
        booking.date === date &&
        booking.startHour === startHour,
    ) ?? null
  );
}

export function buildSlots(
  bookings: Booking[],
  courtId: string,
  date: string,
  now: Date,
): Slot[] {
  const slots: Slot[] = [];

  for (let hour = OPEN_HOUR; hour < CLOSE_HOUR; hour += 1) {
    const booking = findConflict(bookings, courtId, date, hour);

    const start = fromDateKey(date);
    start.setHours(hour, 0, 0, 0);
    const hasStarted = start.getTime() <= now.getTime();

    // A taken slot reads as BOOKED even once it is in the past, because the
    // admin list still needs to point at the reservation behind it.
    const status = booking ? 'BOOKED' : hasStarted ? 'PAST' : 'OPEN';

    slots.push({ hour, label: formatSlotRange(hour), status, booking });
  }

  return slots;
}

export function openSlotCount(
  bookings: Booking[],
  courtId: string,
  date: string,
  now: Date,
): number {
  return buildSlots(bookings, courtId, date, now).filter((slot) => slot.status === 'OPEN').length;
}

export function bookingsOnDate(bookings: Booking[], date: string): Booking[] {
  return bookings.filter((booking) => booking.date === date);
}

/** Confirmed bookings per date key, used for the dots on the month grid. */
export function countByDate(bookings: Booking[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const booking of bookings) {
    if (!isActive(booking)) continue;
    counts[booking.date] = (counts[booking.date] ?? 0) + 1;
  }
  return counts;
}

/** Chronological: date, then start hour, then court, so ties are stable. */
export function sortByStart(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (a.startHour !== b.startHour) return a.startHour - b.startHour;
    return a.courtId < b.courtId ? -1 : 1;
  });
}

export function isPastBooking(booking: Booking, now: Date): boolean {
  const end = fromDateKey(booking.date);
  end.setHours(booking.endHour, 0, 0, 0);
  return end.getTime() <= now.getTime();
}

export function bookingsForEmail(bookings: Booking[], email: string): Booking[] {
  const needle = email.trim().toLowerCase();
  return bookings.filter((booking) => booking.email.trim().toLowerCase() === needle);
}
