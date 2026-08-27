'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { storage } from '@/lib/storage';
import { requireOwner, requireRole } from '@/lib/session';
import {
  courtFormSchema,
  deletePaymentMethodSchema,
  paymentMethodSchema,
  verifyBookingSchema,
} from '@/lib/validators';
import { logger, sanitizeError } from '@/lib/logger';
import type { ActionState } from '@/lib/types';

/**
 * Step 4 of the payment workflow: the owner's decision.
 *
 * Only PENDING_VERIFICATION can be decided. Guarding the source status here
 * makes the transition idempotent under a double-click and stops a stale queue
 * page from re-approving something that was already rejected.
 */
export async function verifyBookingAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireRole(['OWNER', 'SUPER_ADMIN']);

  const parsed = verifyBookingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  const { groupId, decision, rejectionReason } = parsed.data;

  const group = await prisma.bookingGroup.findUnique({
    where: { id: groupId },
    include: { facility: { select: { ownerId: true } } },
  });
  if (!group?.facility) return { ok: false, message: 'Booking not found.' };
  if (group.facility.ownerId !== user.id && user.role !== 'SUPER_ADMIN') return { ok: false, message: 'Not your facility.' };

  if (group.status !== 'PENDING_VERIFICATION') {
    return { ok: false, message: `This booking is already ${group.status.toLowerCase().replace('_', ' ')}.` };
  }
  if (decision === 'REJECT' && !rejectionReason) {
    return { ok: false, fieldErrors: { rejectionReason: ['Tell the player why the payment was rejected.'] } };
  }

  try {
    await prisma.$transaction([
      prisma.bookingGroup.update({
        where: { id: groupId },
        data: { status: decision === 'APPROVE' ? 'CONFIRMED' : 'REJECTED' },
      }),
      prisma.booking.updateMany({
        where: { groupId },
        data: { status: decision === 'APPROVE' ? 'CONFIRMED' : 'REJECTED' },
      }),
      prisma.paymentReceipt.update({
        where: { groupId },
        data: {
          verifiedAt: new Date(),
          verifiedById: user.id,
          rejectionReason: decision === 'REJECT' ? rejectionReason || null : null,
        },
      }),
    ]);
  } catch (error) {
    logger.error('verifyBookingAction transaction failed', { groupId, userId: user.id, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to update booking. Please try again.' };
  }

  revalidatePath('/owner/verify');
  revalidatePath('/owner');
  revalidatePath('/dashboard');

  return {
    ok: true,
    message: decision === 'APPROVE' ? 'Booking confirmed.' : 'Payment rejected and the slots released.',
  };
}

/**
 * Create or update a payment method for the owner.
 *
 * Owners can configure multiple methods (GCash, Maya, bank transfer, etc.),
 * each with its own QR code, account details, and instructions.
 */
export async function savePaymentMethodAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireOwner('/owner/settings');

  const rawQr = formData.get('qrCode');
  const hasNewQr = rawQr instanceof File && rawQr.size > 0;

  const parsed = paymentMethodSchema.safeParse({
    id: formData.get('id') ?? '',
    name: formData.get('name'),
    accountName: formData.get('accountName'),
    accountNumber: formData.get('accountNumber'),
    instructions: formData.get('instructions'),
    ...(hasNewQr ? { qrCode: rawQr } : {}),
  });
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const { id, name, accountName, accountNumber, instructions, qrCode } = parsed.data;

  let qrCodeUrl: string | null = null;
  let previousUrl: string | null = null;

  if (id) {
    const existing = await prisma.paymentMethod.findFirst({
      where: { id, ownerId: userId },
      select: { id: true, qrCodeUrl: true },
    });
    if (!existing) return { ok: false, message: 'Payment method not found.' };
    qrCodeUrl = existing.qrCodeUrl;
    previousUrl = qrCodeUrl;
  }

  if (qrCode) {
    try {
      qrCodeUrl = (await storage.put(qrCode, 'qr')).url;
    } catch (error) {
      logger.error('QR upload failed', { userId, error: sanitizeError(error) });
      return { ok: false, message: 'Failed to upload QR code. Please try again.' };
    }
  }

  const data = {
    name,
    accountName,
    accountNumber: accountNumber || null,
    instructions,
    qrCodeUrl,
  };

  try {
    if (id) {
      await prisma.paymentMethod.update({ where: { id }, data });
    } else {
      const maxSort = await prisma.paymentMethod.aggregate({
        where: { ownerId: userId },
        _max: { sortOrder: true },
      });
      await prisma.paymentMethod.create({
        data: { ...data, ownerId: userId, sortOrder: (maxSort._max.sortOrder ?? -1) + 1 },
      });
    }
  } catch (error) {
    logger.error('savePaymentMethodAction db failed', { userId, paymentMethodId: id, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to save payment method. Please try again.' };
  }

  if (qrCode && previousUrl && previousUrl !== qrCodeUrl) {
    void storage.delete(previousUrl).catch(() => undefined);
  }

  revalidatePath('/owner/settings');
  return { ok: true, message: id ? 'Payment method updated.' : 'Payment method added.' };
}

/** Soft-delete a payment method by deactivating it. */
export async function deletePaymentMethodAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireOwner('/owner/settings');

  const parsed = deletePaymentMethodSchema.safeParse({
    paymentMethodId: formData.get('paymentMethodId'),
  });
  if (!parsed.success) return { ok: false, message: 'Malformed request.' };

  const method = await prisma.paymentMethod.findFirst({
    where: { id: parsed.data.paymentMethodId, ownerId: userId },
    select: { id: true, isActive: true },
  });
  if (!method) return { ok: false, message: 'Payment method not found.' };

  try {
    await prisma.paymentMethod.update({
      where: { id: method.id },
      data: { isActive: false },
    });
  } catch (error) {
    logger.error('deletePaymentMethodAction db failed', { userId, paymentMethodId: method.id, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to delete payment method. Please try again.' };
  }

  revalidatePath('/owner/settings');
  return { ok: true, message: 'Payment method removed.' };
}

export async function saveCourtAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireOwner('/owner/courts');

  const facilityId = String(formData.get('facilityId') ?? '');
  if (!facilityId) return { ok: false, message: 'Facility ID is required.' };

  const facility = await prisma.facility.findUnique({
    where: { id: facilityId, ownerId: userId },
    select: { id: true },
  });
  if (!facility) return { ok: false, message: 'Facility not found.' };

  const parsed = courtFormSchema.safeParse({
    id: formData.get('id') ?? '',
    name: formData.get('name'),
    type: formData.get('type'),
    hourlyRate: formData.get('hourlyRate'),
    openHour: formData.get('openHour'),
    closeHour: formData.get('closeHour'),
    isActive: formData.get('isActive'),
  });
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const { id, name, type, hourlyRate, openHour, closeHour, isActive } = parsed.data;

  const duplicate = await prisma.court.findFirst({
    where: { facilityId, name, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (duplicate) return { ok: false, fieldErrors: { name: ['You already have a court with that name in this facility.'] } };

  const data = {
    name,
    type,
    hourlyRate: new Prisma.Decimal(hourlyRate),
    openHour,
    closeHour,
    isActive,
  };

  try {
    if (id) {
      const owned = await prisma.court.findFirst({
        where: { id, facility: { ownerId: userId } },
        select: { id: true },
      });
      if (!owned) return { ok: false, message: 'That court belongs to another owner.' };
      await prisma.court.update({ where: { id }, data });
    } else {
      await prisma.court.create({ data: { ...data, facilityId } });
    }
  } catch (error) {
    logger.error('saveCourtAction db failed', { userId, courtId: id, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to save court. Please try again.' };
  }

  revalidatePath('/owner/courts');
  return { ok: true, message: id ? 'Court updated.' : 'Court added.' };
}

/**
 * Courts with booking history are deactivated rather than deleted: removing the
 * row would cascade away the bookings that reference it and destroy the payment
 * record along with them.
 */
export async function deleteCourtAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await requireOwner('/owner/courts');

  const courtId = String(formData.get('courtId') ?? '');
  const court = await prisma.court.findFirst({
    where: { id: courtId, facility: { ownerId: userId } },
    include: { _count: { select: { bookings: true } } },
  });
  if (!court) return { ok: false, message: 'Court not found.' };

  try {
    if (court._count.bookings > 0) {
      await prisma.court.update({ where: { id: courtId }, data: { isActive: false } });
      revalidatePath('/owner/courts');
      updateTag('home-stats');
      return { ok: true, message: 'Court has bookings, so it was deactivated instead of deleted.' };
    }

    await prisma.court.delete({ where: { id: courtId } });
  } catch (error) {
    logger.error('deleteCourtAction db failed', { userId, courtId, error: sanitizeError(error) });
    return { ok: false, message: 'Failed to delete court. Please try again.' };
  }
  revalidatePath('/owner/courts');
  updateTag('home-stats');
  return { ok: true, message: 'Court deleted.' };
}
