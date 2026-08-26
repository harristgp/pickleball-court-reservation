import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { dateKeyToUtcMidnight, isSlotInPast, slotEnd, slotStart } from '@/lib/dates';
import type { CourtAvailability, DaySlot, SlotState } from '@/lib/types';

/** How long a PENDING_PAYMENT booking may hold a slot before it is swept. */
export const PAYMENT_HOLD_MINUTES = 30;

/** Statuses that occupy a slot. Mirrors the partial unique index predicate. */
export const ACTIVE_BOOKING_STATUSES = [
  'PENDING_PAYMENT',
  'PENDING_VERIFICATION',
  'CONFIRMED',
] as const;

/** The full bookable hour range shown in the grid, independent of any court. */
export const GRID_START_HOUR = 5;
export const GRID_END_HOUR = 23;

type Db = PrismaClient | Prisma.TransactionClient;

export function holdExpiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + PAYMENT_HOLD_MINUTES * 60_000);
}

/**
 * Sweep abandoned payment holds.
 *
 * A PENDING_PAYMENT booking occupies its slot (it is inside the unique index
 * predicate), so an abandoned checkout would otherwise block that hour forever.
 * Flipping expired holds to REJECTED drops them out of the index and frees the
 * slot in the same write. Called at the top of every availability read and
 * before every booking insert, which removes the need for a cron job.
 */
export async function releaseExpiredHolds(db: Db = prisma, courtIds?: string[]): Promise<number> {
  // Release expired holds on individual bookings
  const bookingResult = await db.booking.updateMany({
    where: {
      status: 'PENDING_PAYMENT',
      court: courtIds?.length ? { id: { in: courtIds } } : undefined,
      group: { expiresAt: { lt: new Date() } },
    },
    data: { status: 'REJECTED' },
  });

  // Also release expired BookingGroups and cascade to their bookings
  const groupResult = await db.bookingGroup.updateMany({
    where: {
      status: 'PENDING_PAYMENT',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'REJECTED', notes: 'Automatically released: payment window expired.' },
  });

  return bookingResult.count + groupResult.count;
}

export interface DayAvailabilityOptions {
  facilityId: string;
  dateKey: string;
  /** When set, slots held by this player are tagged with their booking id. */
  viewerId?: string;
}

/**
 * The court-by-hour grid for one facility on one day.
 *
 * Availability is derived from the same statuses the database index enforces,
 * so what the grid shows and what an insert will accept cannot disagree.
 */
export async function getFacilityAvailability({
  facilityId,
  dateKey,
  viewerId,
}: DayAvailabilityOptions): Promise<CourtAvailability[]> {
  const courts = await prisma.court.findMany({
    where: { facilityId, isActive: true },
    orderBy: { name: 'asc' },
  });
  if (courts.length === 0) return [];

  const courtIds = courts.map((court) => court.id);
  await releaseExpiredHolds(prisma, courtIds);

  const bookings = await prisma.booking.findMany({
    where: {
      courtId: { in: courtIds },
      date: dateKeyToUtcMidnight(dateKey),
      status: { in: [...ACTIVE_BOOKING_STATUSES] },
    },
    select: { id: true, courtId: true, startTime: true, playerId: true },
  });

  const taken = new Map<string, { id: string; playerId: string }>();
  for (const booking of bookings) {
    taken.set(`${booking.courtId}@${booking.startTime.getUTCHours()}`, {
      id: booking.id,
      playerId: booking.playerId,
    });
  }

  const now = new Date();

  return courts.map((court) => {
    const slots: DaySlot[] = [];

    for (let hour = GRID_START_HOUR; hour < GRID_END_HOUR; hour += 1) {
      const occupant = taken.get(`${court.id}@${hour}`);
      let state: SlotState = 'available';

      if (hour < court.openHour || hour >= court.closeHour) state = 'closed';
      else if (occupant) state = 'booked';
      else if (isSlotInPast(dateKey, hour, now)) state = 'past';

      slots.push({
        hour,
        state,
        ...(occupant && viewerId && occupant.playerId === viewerId ? { bookingId: occupant.id } : {}),
      });
    }

    return {
      courtId: court.id,
      courtName: court.name,
      courtType: court.type,
      hourlyRate: court.hourlyRate.toNumber(),
      openHour: court.openHour,
      closeHour: court.closeHour,
      slots,
    };
  });
}

export function isSlotConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const meta = JSON.stringify(error.meta ?? {});
  return meta.includes('booking_active_slot') || (meta.includes('courtId') && meta.includes('startTime'));
}

export { slotEnd, slotStart };
