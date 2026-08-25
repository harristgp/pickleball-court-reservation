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

export interface NearbyClub {
  id: string;
  name: string;
  slug: string;
  city: string;
  address: string;
  description: string;
  imageUrl: string | null;
  latitude: number;
  longitude: number;
  minRate: number | null;
  maxRate: number | null;
  courtCount: number;
  hasIndoor: boolean;
  hasOutdoor: boolean;
  /** Absent until the player shares their location. */
  distanceKm?: number;
}

/** A payment method owned by a club, serialised for the checkout panel. */
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
