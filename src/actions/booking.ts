'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { storage } from '@/lib/storage';
import { requireUser } from '@/lib/session';
import { dateKeyToUtcMidnight, isSlotInPast, slotEnd, slotStart } from '@/lib/dates';
import { holdExpiryFrom, isSlotConflict, releaseExpiredHolds } from '@/lib/slots';
import { createBookingSchema, uploadReceiptSchema } from '@/lib/validators';
import { logger, sanitizeError } from '@/lib/logger';
import type { ActionState } from '@/lib/types';

/**
 * Step 1 of the payment workflow: hold the slot.
 *
 * The insert is the only authority on whether the slot is free. Everything
 * checked beforehand is there to produce a good error message; the partial
 * unique index is what actually prevents a double booking, including between
 * two requests that both passed the checks a millisecond apart.
 */
export async function createBookingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser('/discover');

  const parsed = createBookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'That booking request was malformed.', fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { courtId, date, hour, notes } = parsed.data;
  const paymentMethodId = String(formData.get('paymentMethodId') ?? '') || null;

  const court = await prisma.court.findUnique({
    where: { id: courtId },
    include: { owner: { select: { id: true, isActive: true, name: true } } },
  });

  if (!court || !court.isActive) return { ok: false, message: 'That court is no longer available.' };
  if (!court.owner.isActive) return { ok: false, message: 'That owner is not accepting bookings right now.' };
  if (hour < court.openHour || hour >= court.closeHour) {
    return { ok: false, message: 'That time is outside the court opening hours.' };
  }
  if (isSlotInPast(date, hour)) return { ok: false, message: 'That time has already passed.' };

  if (paymentMethodId) {
    const method = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, ownerId: court.owner.id, isActive: true },
      select: { id: true },
    });
    if (!method) return { ok: false, message: 'Invalid payment method.' };
  }

  await releaseExpiredHolds(prisma, [courtId]);

  let bookingId: string;
  try {
    const booking = await prisma.booking.create({
      data: {
        playerId: user.id,
        courtId,
        date: dateKeyToUtcMidnight(date),
        startTime: slotStart(date, hour),
        endTime: slotEnd(date, hour),
        totalPrice: court.hourlyRate,
        status: 'PENDING_PAYMENT',
        expiresAt: holdExpiryFrom(),
        notes: notes || null,
        paymentMethodId: paymentMethodId || null,
      },
      select: { id: true },
    });
    bookingId = booking.id;
  } catch (error) {
    if (isSlotConflict(error)) {
      return { ok: false, message: 'That slot was just taken. Pick another time.' };
    }
    logger.error('createBookingAction failed', { userId: user.id, courtId, error: sanitizeError(error) });
    throw error;
  }

  revalidatePath('/dashboard');
  redirect(`/checkout/${bookingId}`);
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
    bookingId: formData.get('bookingId'),
    referenceNumber: formData.get('referenceNumber'),
    amountClaimed: formData.get('amountClaimed') || undefined,
    screenshot: formData.get('screenshot'),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { bookingId, referenceNumber, amountClaimed, screenshot } = parsed.data;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { receipt: true },
  });

  if (!booking || booking.playerId !== user.id) return { ok: false, message: 'Booking not found.' };
  if (booking.status === 'CONFIRMED') return { ok: false, message: 'This booking is already confirmed.' };
  if (booking.status === 'REJECTED') {
    return { ok: false, message: 'This booking was rejected or expired. Please book the slot again.' };
  }

  const stored = await storage.put(screenshot, 'receipts');
  const previousUrl = booking.receipt?.screenshotUrl;

  try {
    await prisma.$transaction([
      prisma.paymentReceipt.upsert({
        where: { bookingId },
        create: {
          bookingId,
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
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: 'PENDING_VERIFICATION',
          expiresAt: new Date(booking.endTime),
        },
      }),
    ]);
  } catch (error) {
    logger.error('uploadReceiptAction transaction failed', { bookingId, userId: user.id, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to save receipt. Please try again.' };
  }

  // Best-effort cleanup of the replaced image; never block the workflow on it.
  if (previousUrl && previousUrl !== stored.url) {
    void storage.delete(previousUrl).catch(() => undefined);
  }

  revalidatePath(`/checkout/${bookingId}`);
  revalidatePath('/dashboard');
  revalidatePath('/owner/verify');
  return { ok: true, message: 'Receipt submitted. The owner will verify your payment shortly.' };
}

/** Player-side cancellation. Frees the slot by leaving the index predicate. */
export async function cancelBookingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const bookingId = String(formData.get('bookingId') ?? '');

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });
  if (!booking || booking.playerId !== user.id) return { ok: false, message: 'Booking not found.' };
  if (booking.status === 'REJECTED') return { ok: false, message: 'That booking is already closed.' };
  if (booking.status === 'CONFIRMED') {
    return { ok: false, message: 'Confirmed bookings must be cancelled by the owner.' };
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'REJECTED', notes: 'Cancelled by the player before payment was verified.' },
  });

  revalidatePath('/dashboard');
  return { ok: true, message: 'Booking cancelled.' };
}
