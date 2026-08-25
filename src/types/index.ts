/**
 * Domain types shared by the UI, the storage layer, and the slot engine.
 *
 * Everything here is serialisable on purpose: the whole dataset round-trips
 * through `JSON.stringify` into localStorage, so no `Date` objects or class
 * instances are allowed to leak into these shapes. Dates travel as
 * `YYYY-MM-DD` strings and times as integer hours on the local clock.
 */

/** Mock auth has exactly two states. There is no real identity provider. */
export type Role = 'USER' | 'ADMIN';

export interface Session {
  role: Role;
  name: string;
  email: string;
  phone: string;
}

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'PRO';

export type CourtSurface = 'INDOOR' | 'OUTDOOR';

export interface Court {
  id: string;
  name: string;
  surface: CourtSurface;
  /** Price for a single one-hour slot, in whole dollars. */
  hourlyRate: number;
  hasLights: boolean;
  description: string;
}

/**
 * `CANCELLED` rows are kept rather than deleted so the admin list keeps an
 * audit trail. Only `CONFIRMED` rows occupy a slot, so cancelling frees it.
 */
export type BookingStatus = 'CONFIRMED' | 'CANCELLED';

export interface Booking {
  id: string;
  courtId: string;
  /** `YYYY-MM-DD`, always a local calendar date. */
  date: string;
  /** Integer hour, 24h clock. A slot is exactly one hour: [startHour, endHour). */
  startHour: number;
  endHour: number;
  name: string;
  email: string;
  phone: string;
  skillLevel: SkillLevel;
  status: BookingStatus;
  /** ISO timestamp. */
  createdAt: string;
}

/** What the reservation form produces before an id and status are assigned. */
export interface BookingDraft {
  courtId: string;
  date: string;
  startHour: number;
  name: string;
  email: string;
  phone: string;
  skillLevel: SkillLevel;
}

/**
 * `PAST` and `BOOKED` are separate states because they need different copy and
 * different styling: one means "too late", the other means "someone beat you
 * to it".
 */
export type SlotStatus = 'OPEN' | 'BOOKED' | 'PAST';

export interface Slot {
  hour: number;
  /** Human label for the whole range, e.g. "6:00 AM - 7:00 AM". */
  label: string;
  status: SlotStatus;
  /** The booking occupying the slot, when `status` is `BOOKED`. */
  booking: Booking | null;
}

/** Result of an attempted write. The slot re-check can always reject a save. */
export type SaveResult =
  | { ok: true; booking: Booking }
  | { ok: false; error: string };
