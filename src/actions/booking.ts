'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { storage } from '@/lib/storage';
import { requireUser } from '@/lib/session';
import { dateKeyToUtcMidnight, isSlotInPast, slotEnd, slotStart } from '@/lib/dates';
import { holdExpiryFrom, isSlotConflict, releaseExpiredHolds } from '@/lib/slots';
import { createMultiBookingSchema, uploadReceiptSchema } from '@/lib/validators';
import { logger, sanitizeError } from '@/lib/logger';
import type { ActionState } from '@/lib/types';

/**
 * Multi-hour booking action: creates a BookingGroup + individual Bookings
 * in a single transaction. The partial unique index on (courtId, startTime)
 * prevents double-booking at the database level.
 */
export async function createMultiBookingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser('/discover');

  const rawSlots = JSON.parse(String(formData.get('slots') ?? '[]')) as Array<{ courtId: string; hour: number }>;
  const parsed = createMultiBookingSchema.safeParse({
    facilityId: formData.get('facilityId'),
    date: formData.get('date'),
    slots: rawSlots,
    notes: formData.get('notes'),
  });
  if (!parsed.success) {
    return { ok: false, message: 'That booking request was malformed.', fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { facilityId, date, slots, notes } = parsed.data;
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '') || null;

  // Validate facility exists and is active
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: { courts: { where: { isActive: true }, select: { id: true, hourlyRate: true, openHour: true, closeHour: true } } },
  });
  if (!facility || !facility.isActive) return { ok: false, message: 'That facility is no longer available.' };

  // Build court lookup for validation
  const courtMap = new Map(facility.courts.map((c) => [c.id, c]));

  // Validate every slot
  for (const s of slots) {
    const court = courtMap.get(s.courtId);
    if (!court) return { ok: false, message: `Court ${s.courtId} is not available at this facility.` };
    if (s.hour < court.openHour || s.hour >= court.closeHour) {
      return { ok: false, message: `Hour ${s.hour} is outside court hours (${court.openHour}–${court.closeHour}).` };
    }
    if (isSlotInPast(date, s.hour)) return { ok: false, message: 'One or more selected times have already passed.' };
  }

  // Check for duplicate hours on the same court
  const seen = new Set<string>();
  for (const s of slots) {
    const key = `${s.courtId}@${s.hour}`;
    if (seen.has(key)) return { ok: false, message: 'Duplicate time slot selected.' };
    seen.add(key);
  }

  if (paymentMethodId) {
    const method = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, ownerId: facility.ownerId, isActive: true },
      select: { id: true },
    });
    if (!method) return { ok: false, message: 'Invalid payment method.' };
  }

  // Sweep expired holds for the relevant courts
  const courtIds = [...new Set(slots.map((s) => s.courtId))];
  await releaseExpiredHolds(prisma, courtIds);

  // Calculate total
  let total = new Prisma.Decimal(0);
  for (const s of slots) {
    const court = courtMap.get(s.courtId)!;
    total = total.add(court.hourlyRate);
  }

  // Create BookingGroup + Bookings in a transaction
  let groupId: string;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const group = await tx.bookingGroup.create({
        data: {
          playerId: user.id,
          facilityId,
          totalPrice: total,
          status: 'PENDING_PAYMENT',
          expiresAt: holdExpiryFrom(),
          notes: notes || null,
          paymentMethodId: paymentMethodId || null,
        },
        select: { id: true },
      });

      for (const s of slots) {
        const court = courtMap.get(s.courtId)!;
        await tx.booking.create({
          data: {
            groupId: group.id,
            playerId: user.id,
            courtId: s.courtId,
            date: dateKeyToUtcMidnight(date),
            startTime: slotStart(date, s.hour),
            endTime: slotEnd(date, s.hour),
            totalPrice: court.hourlyRate,
            status: 'PENDING_PAYMENT',
          },
        });
      }

      return group;
    });
    groupId = result.id;
  } catch (error) {
    if (isSlotConflict(error)) {
      return { ok: false, message: 'One or more of your selected slots were just taken. Please try again.' };
    }
    logger.error('createMultiBookingAction failed', { userId: user.id, facilityId, error: sanitizeError(error) });
    throw error;
  }

  revalidatePath('/dashboard');
  redirect(`/checkout/${groupId}`);
}

/**
 * Step 3 of the payment workflow: attach proof of payment.
 *
 * PENDING_PAYMENT is the only status that may receive a receipt. Re-uploading
 * replaces the stored image and clears any previous rejection, which is what
 * lets a player fix a bad screenshot without rebooking.
 */
export async function uploadReceiptAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = uploadReceiptSchema.safeParse({
    groupId: formData.get('groupId'),
    referenceNumber: formData.get('referenceNumber'),
    amountClaimed: formData.get('amountClaimed') || undefined,
    screenshot: formData.get('screenshot'),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { groupId, referenceNumber, amountClaimed, screenshot } = parsed.data;

  const group = await prisma.bookingGroup.findUnique({
    where: { id: groupId },
    include: { receipt: true, bookings: true },
  });

  if (!group || group.playerId !== user.id) return { ok: false, message: 'Booking not found.' };
  if (group.status === 'CONFIRMED') return { ok: false, message: 'This booking is already confirmed.' };
  if (group.status === 'REJECTED') {
    return { ok: false, message: 'This booking was rejected or expired. Please book the slots again.' };
  }

  const stored = await storage.put(screenshot, 'receipts');
  const previousUrl = group.receipt?.screenshotUrl;

  // Find the latest endTime across all bookings in the group
  const latestEnd = group.bookings.reduce(
    (latest, b) => (b.endTime > latest ? b.endTime : latest),
    group.bookings[0]?.endTime ?? new Date(),
  );

  try {
    await prisma.$transaction([
      prisma.paymentReceipt.upsert({
        where: { groupId },
        create: {
          groupId,
          screenshotUrl: stored.url,
          referenceNumber: referenceNumber || null,
          amountClaimed: amountClaimed !== undefined ? new Prisma.Decimal(amountClaimed) : null,
        },
        update: {
          screenshotUrl: stored.url,
          referenceNumber: referenceNumber || null,
          amountClaimed: amountClaimed !== undefined ? new Prisma.Decimal(amountClaimed) : null,
          uploadedAt: new Date(),
          verifiedAt: null,
          verifiedById: null,
          rejectionReason: null,
        },
      }),
      prisma.bookingGroup.update({
        where: { id: groupId },
        data: {
          status: 'PENDING_VERIFICATION',
          expiresAt: latestEnd,
        },
      }),
      // Also update individual bookings to PENDING_VERIFICATION
      prisma.booking.updateMany({
        where: { groupId },
        data: { status: 'PENDING_VERIFICATION' },
      }),
    ]);
  } catch (error) {
    logger.error('uploadReceiptAction transaction failed', { groupId, userId: user.id, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to save receipt. Please try again.' };
  }

  if (previousUrl && previousUrl !== stored.url) {
    void storage.delete(previousUrl).catch(() => undefined);
  }

  revalidatePath(`/checkout/${groupId}`);
  revalidatePath('/dashboard');
  revalidatePath('/owner/verify');
  return { ok: true, message: 'Receipt submitted. The owner will verify your payment shortly.' };
}

/** Player-side cancellation. Frees all slots in the group. */
export async function cancelBookingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const groupId = String(formData.get('groupId') ?? '');

  const group = await prisma.bookingGroup.findUnique({
    where: { id: groupId },
  });
  if (!group || group.playerId !== user.id) return { ok: false, message: 'Booking not found.' };
  if (group.status === 'REJECTED') return { ok: false, message: 'That booking is already closed.' };
  if (group.status === 'CONFIRMED') {
    return { ok: false, message: 'Confirmed bookings must be cancelled by the owner.' };
  }

  await prisma.$transaction([
    prisma.bookingGroup.update({
      where: { id: groupId },
      data: { status: 'REJECTED', notes: 'Cancelled by the player before payment was verified.' },
    }),
    prisma.booking.updateMany({
      where: { groupId },
      data: { status: 'REJECTED' },
    }),
  ]);

  revalidatePath('/dashboard');
  return { ok: true, message: 'Booking cancelled.' };
}
