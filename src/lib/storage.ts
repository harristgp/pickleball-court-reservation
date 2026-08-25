import type { Booking, BookingStatus, Session, SkillLevel } from '@/types';

/**
 * localStorage access, isolated behind runtime-validated readers.
 *
 * Two things make this more than a `JSON.parse` wrapper:
 *
 * 1. Anything in localStorage is user-editable and survives deploys, so a
 *    stored row from an older shape can be malformed. Every record is checked
 *    against `isBooking` and bad rows are dropped rather than crashing render.
 * 2. Writes fire a custom event so other components in the *same* tab refresh.
 *    The native `storage` event only fires in *other* tabs.
 */

const BOOKINGS_KEY = 'dinkclub.bookings.v1';
const SESSION_KEY = 'dinkclub.session.v1';
const SEEDED_KEY = 'dinkclub.seeded.v1';

export const BOOKINGS_CHANGED = 'dinkclub:bookings-changed';

export const DEMO_USER: Session = {
  role: 'USER',
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  phone: '(555) 0142',
};

export const DEMO_ADMIN: Session = {
  role: 'ADMIN',
  name: 'Jordan Vale',
  email: 'ops@dinkclub.example',
  phone: '(555) 0100',
};

const SKILL_LEVELS: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PRO'];
const STATUSES: BookingStatus[] = ['CONFIRMED', 'CANCELLED'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBooking(value: unknown): value is Booking {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.courtId === 'string' &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    typeof value.startHour === 'number' &&
    Number.isInteger(value.startHour) &&
    typeof value.endHour === 'number' &&
    Number.isInteger(value.endHour) &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    typeof value.phone === 'string' &&
    SKILL_LEVELS.includes(value.skillLevel as SkillLevel) &&
    STATUSES.includes(value.status as BookingStatus) &&
    typeof value.createdAt === 'string'
  );
}

function isSession(value: unknown): value is Session {
  if (!isRecord(value)) return false;
  return (
    (value.role === 'USER' || value.role === 'ADMIN') &&
    typeof value.name === 'string' &&
    typeof value.email === 'string' &&
    typeof value.phone === 'string'
  );
}

/** Returns `[]` on the server so this module is safe to import anywhere. */
export function readBookings(): Booking[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BOOKINGS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBooking);
  } catch {
    // Corrupt JSON or storage blocked entirely (Safari private mode).
    return [];
  }
}

export function writeBookings(bookings: Booking[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  } catch {
    // Quota exceeded or storage disabled. The in-memory state still updates,
    // so the current session keeps working; it just will not survive a reload.
  }
  window.dispatchEvent(new Event(BOOKINGS_CHANGED));
}

export function readSession(): Session {
  if (typeof window === 'undefined') return DEMO_USER;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return DEMO_USER;
    const parsed: unknown = JSON.parse(raw);
    return isSession(parsed) ? parsed : DEMO_USER;
  } catch {
    return DEMO_USER;
  }
}

export function writeSession(session: Session): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Same tolerance as writeBookings.
  }
}

/**
 * Tracks whether demo data was already planted, so a visitor who deletes every
 * booking does not get them silently resurrected on the next reload.
 */
export function hasSeeded(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SEEDED_KEY) === 'yes';
  } catch {
    return true;
  }
}

export function markSeeded(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEDED_KEY, 'yes');
  } catch {
    // Non-fatal: worst case the demo rows are planted again next visit.
  }
}

export function clearSeeded(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SEEDED_KEY);
  } catch {
    // Non-fatal.
  }
}
