import type { BookingStatus, CourtType } from '@prisma/client';

/** Plain, serialisable shapes handed to client components (no Decimal, no Date). */

export type SlotState = 'available' | 'booked' | 'past' | 'closed';

export interface DaySlot {
  hour: number;
  state: SlotState;
  /** Populated only when the viewer owns the booking sitting in this slot. */
  bookingId?: string;
}

export interface CourtAvailability {
  courtId: string;
  courtName: string;
  courtType: CourtType;
  hourlyRate: number;
  openHour: number;
  closeHour: number;
  slots: DaySlot[];
}

/** A single slot selected by the player during multi-hour booking. */
export interface MultiSlotSelection {
  courtId: string;
  courtName: string;
  hour: number;
  rate: number;
  dateKey: string;
}

/** Summary of a facility for the discover/browse pages. */
export interface FacilitySummary {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  minRate: number | null;
  maxRate: number | null;
  courtCount: number;
  hasIndoor: boolean;
  hasOutdoor: boolean;
  photos: string[];
  distanceKm?: number;
}

/** Full facility detail for the public profile page. */
export interface FacilityDetail {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  ownerName: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  photos: string[];
  openHour: number;
  closeHour: number;
  courtCount: number;
  minRate: number | null;
  maxRate: number | null;
}

/** A payment method owned by an owner, serialised for the checkout panel. */
export interface PaymentMethodSummary {
  id: string;
  name: string;
  accountName: string;
  accountNumber: string | null;
  qrCodeUrl: string | null;
  instructions: string;
}

export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const IDLE_ACTION_STATE: ActionState = { ok: false };

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PENDING_VERIFICATION: 'Awaiting verification',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
};
