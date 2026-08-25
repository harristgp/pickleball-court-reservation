'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { storage } from '@/lib/storage';
import { assertOwnsBooking, requireOwnedClub, requireRole } from '@/lib/session';
import {
  clubRegistrationSchema,
  courtFormSchema,
  deletePaymentMethodSchema,
  paymentMethodSchema,
  verifyBookingSchema,
} from '@/lib/validators';
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
  const { bookingId, decision, rejectionReason } = parsed.data;

  const booking = await assertOwnsBooking(bookingId, user.id, user.role);

  if (booking.status !== 'PENDING_VERIFICATION') {
    return { ok: false, message: `This booking is already ${booking.status.toLowerCase().replace('_', ' ')}.` };
  }
  if (decision === 'REJECT' && !rejectionReason) {
    return { ok: false, fieldErrors: { rejectionReason: ['Tell the player why the payment was rejected.'] } };
  }

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      // REJECTED leaves the partial unique index, so the hour is immediately
      // bookable by someone else. No separate slot-release step exists.
      data: { status: decision === 'APPROVE' ? 'CONFIRMED' : 'REJECTED' },
    }),
    prisma.paymentReceipt.update({
      where: { bookingId },
      data: {
        verifiedAt: new Date(),
        verifiedById: user.id,
        rejectionReason: decision === 'REJECT' ? rejectionReason || null : null,
      },
    }),
  ]);

  revalidatePath('/owner/verify');
  revalidatePath('/owner');
  revalidatePath('/dashboard');
  revalidatePath(`/clubs/${booking.court.clubId}`);

  return {
    ok: true,
    message: decision === 'APPROVE' ? 'Booking confirmed.' : 'Payment rejected and the slot released.',
  };
}

/**
 * Owner self-onboarding.
 *
 * /register lets someone sign up as a club owner, so the app has to be able to
 * create the club too — otherwise that account lands on an empty dashboard it
 * can never fill. One club per owner in this build, matching requireOwnedClub.
 */
export async function registerClubAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user, club: existing } = await requireOwnedClub('/owner');
  if (existing) return { ok: false, message: 'Your account already has a club.' };

  const parsed = clubRegistrationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const { name, description, address, city, phone, latitude, longitude } = parsed.data;

  const club = await prisma.club.create({
    data: {
      ownerId: user.id,
      name,
      slug: await uniqueSlug(name),
      description,
      address,
      city,
      phone: phone || null,
      latitude,
      longitude,
    },
    select: { id: true },
  });

  revalidatePath('/owner');
  revalidatePath('/discover');
  revalidatePath('/admin/clubs');
  return { ok: true, message: `${name} is live. Add your courts and payment details next.` };
}

/**
 * Slugs are unique across the platform, so a name collision between two clubs
 * has to resolve to a different slug rather than failing the whole signup.
 */
async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'club';

  const siblings = await prisma.club.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const taken = new Set(siblings.map((row) => row.slug));
  if (!taken.has(base)) return base;

  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/**
 * Create or update a payment method for the owner's club.
 *
 * Owners can configure multiple methods (GCash, Maya, bank transfer, etc.),
 * each with its own QR code, account details, and instructions.
 */
export async function savePaymentMethodAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { club } = await requireOwnedClub('/owner/settings');
  if (!club) return { ok: false, message: 'You do not have a club yet.' };

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
      where: { id, clubId: club.id },
      select: { id: true, qrCodeUrl: true },
    });
    if (!existing) return { ok: false, message: 'Payment method not found.' };
    qrCodeUrl = existing.qrCodeUrl;
    previousUrl = qrCodeUrl;
  }

  if (qrCode) {
    qrCodeUrl = (await storage.put(qrCode, 'qr')).url;
  }

  const data = {
    name,
    accountName,
    accountNumber: accountNumber || null,
    instructions,
    qrCodeUrl,
  };

  if (id) {
    await prisma.paymentMethod.update({ where: { id }, data });
  } else {
    const maxSort = await prisma.paymentMethod.aggregate({
      where: { clubId: club.id },
      _max: { sortOrder: true },
    });
    await prisma.paymentMethod.create({
      data: { ...data, clubId: club.id, sortOrder: (maxSort._max.sortOrder ?? -1) + 1 },
    });
  }

  if (qrCode && previousUrl && previousUrl !== qrCodeUrl) {
    void storage.delete(previousUrl).catch(() => undefined);
  }

  revalidatePath('/owner/settings');
  return { ok: true, message: id ? 'Payment method updated.' : 'Payment method added.' };
}

/** Soft-delete a payment method by deactivating it. */
export async function deletePaymentMethodAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { club } = await requireOwnedClub('/owner/settings');
  if (!club) return { ok: false, message: 'You do not have a club yet.' };

  const parsed = deletePaymentMethodSchema.safeParse({
    paymentMethodId: formData.get('paymentMethodId'),
  });
  if (!parsed.success) return { ok: false, message: 'Malformed request.' };

  const method = await prisma.paymentMethod.findFirst({
    where: { id: parsed.data.paymentMethodId, clubId: club.id },
    select: { id: true, isActive: true },
  });
  if (!method) return { ok: false, message: 'Payment method not found.' };

  await prisma.paymentMethod.update({
    where: { id: method.id },
    data: { isActive: false },
  });

  revalidatePath('/owner/settings');
  return { ok: true, message: 'Payment method removed.' };
}

export async function saveCourtAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { club } = await requireOwnedClub('/owner/courts');
  if (!club) return { ok: false, message: 'You do not have a club yet.' };

  const parsed = courtFormSchema.safeParse({
    id: formData.get('id') ?? '',
    name: formData.get('name'),
    type: formData.get('type'),
    hourlyRate: formData.get('hourlyRate'),
    openHour: formData.get('openHour'),
    closeHour: formData.get('closeHour'),
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
  });
  if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

  const { id, name, type, hourlyRate, openHour, closeHour, isActive } = parsed.data;

  const duplicate = await prisma.court.findFirst({
    where: { clubId: club.id, name, ...(id ? { NOT: { id } } : {}) },
    select: { id: true },
  });
  if (duplicate) return { ok: false, fieldErrors: { name: ['You already have a court with that name.'] } };

  const data = {
    name,
    type,
    hourlyRate: new Prisma.Decimal(hourlyRate),
    openHour,
    closeHour,
    isActive,
  };

  if (id) {
    const owned = await prisma.court.findFirst({ where: { id, clubId: club.id }, select: { id: true } });
    if (!owned) return { ok: false, message: 'That court belongs to another club.' };
    await prisma.court.update({ where: { id }, data });
  } else {
    await prisma.court.create({ data: { ...data, clubId: club.id } });
  }

  revalidatePath('/owner/courts');
  revalidatePath(`/clubs/${club.id}`);
  return { ok: true, message: id ? 'Court updated.' : 'Court added.' };
}

/**
 * Courts with booking history are deactivated rather than deleted: removing the
 * row would cascade away the bookings that reference it and destroy the payment
 * record along with them.
 */
export async function deleteCourtAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { club } = await requireOwnedClub('/owner/courts');
  if (!club) return { ok: false, message: 'You do not have a club yet.' };

  const courtId = String(formData.get('courtId') ?? '');
  const court = await prisma.court.findFirst({
    where: { id: courtId, clubId: club.id },
    include: { _count: { select: { bookings: true } } },
  });
  if (!court) return { ok: false, message: 'Court not found.' };

  if (court._count.bookings > 0) {
    await prisma.court.update({ where: { id: courtId }, data: { isActive: false } });
    revalidatePath('/owner/courts');
    return { ok: true, message: 'Court has bookings, so it was deactivated instead of deleted.' };
  }

  await prisma.court.delete({ where: { id: courtId } });
  revalidatePath('/owner/courts');
  revalidatePath(`/clubs/${club.id}`);
  return { ok: true, message: 'Court deleted.' };
}
