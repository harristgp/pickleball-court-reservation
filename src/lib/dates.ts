/**
 * Single source of truth for slot time construction.
 *
 * Every slot is a whole hour anchored to UTC: a slot is identified by
 * Date.UTC(year, month, day, hour). Anchoring to UTC (rather than the server's
 * local zone) means the slot key for "2026-08-22 09:00" is byte-identical no
 * matter which machine computes it, so the database unique index never sees two
 * spellings of the same slot and DST never shifts a court's opening hour.
 *
 * Consequence: hours are displayed as the club's wall-clock hour directly, with
 * no timezone conversion anywhere in the UI. Formatting therefore also reads the
 * UTC components.
 */

export const SLOT_DURATION_HOURS = 1;

/** "2026-08-22" -> { year, month (1-12), day } */
export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error(`Invalid date key: ${dateKey}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Date -> "2026-08-22" using UTC components. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Midnight UTC for a date key — the value stored in Booking.date (@db.Date). */
export function dateKeyToUtcMidnight(dateKey: string): Date {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/** The canonical slot start instant for a date key + hour. */
export function slotStart(dateKey: string, hour: number): Date {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0));
}

export function slotEnd(dateKey: string, hour: number): Date {
  return new Date(slotStart(dateKey, hour).getTime() + SLOT_DURATION_HOURS * 3_600_000);
}

/** Today's date key, in UTC, so it lines up with slot keys. */
export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDaysToKey(dateKey: string, days: number): string {
  const base = dateKeyToUtcMidnight(dateKey);
  base.setUTCDate(base.getUTCDate() + days);
  return toDateKey(base);
}

/** 14 -> "2:00 PM" */
export function formatHour(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:00 ${suffix}`;
}

/** 14 -> "2:00 PM – 3:00 PM" */
export function formatSlotRange(hour: number): string {
  return `${formatHour(hour)} – ${formatHour((hour + SLOT_DURATION_HOURS) % 24)}`;
}

/** "2026-08-22" -> "Sat, Aug 22, 2026" */
export function formatDateKey(dateKey: string): string {
  return dateKeyToUtcMidnight(dateKey).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "2026-08-22" -> "Sat 22" (compact date-strip label) */
export function formatDateKeyShort(dateKey: string): { weekday: string; day: string } {
  const date = dateKeyToUtcMidnight(dateKey);
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
    day: String(date.getUTCDate()),
  };
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

/** A slot is bookable only while its start instant is still in the future. */
export function isSlotInPast(dateKey: string, hour: number, now: Date = new Date()): boolean {
  return slotStart(dateKey, hour).getTime() <= now.getTime();
}
