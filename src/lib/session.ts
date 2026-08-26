import { redirect } from 'next/navigation';
import type { Role } from '@prisma/client';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * The signed-in user, re-read from the database on every call.
 *
 * The JWT is self-contained, so a token minted for a user who has since been
 * deleted would otherwise still authenticate and then fail at the first foreign
 * key. Reading the row back also means a role change takes effect immediately
 * instead of waiting for the token to be reissued. Middleware still decides on
 * the token alone (Prisma cannot run on the Edge), so this is the check that
 * actually gates every page and server action.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!user) return null;

  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function requireUser(callbackUrl?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login');
  }
  return user;
}

export async function requireRole(roles: Role[], callbackUrl?: string): Promise<SessionUser> {
  const user = await requireUser(callbackUrl);
  if (!roles.includes(user.role)) redirect('/');
  return user;
}

/**
 * The signed-in owner. Owners are scoped by their userId; everything an owner
 * can read or mutate is reached through this id rather than through an id
 * supplied by the request, which is what keeps one tenant out of another
 * tenant's data.
 */
export async function requireOwner(callbackUrl?: string) {
  const user = await requireRole(['OWNER', 'SUPER_ADMIN'], callbackUrl);
  return { userId: user.id, user };
}

/** Assert the signed-in owner owns the facility. Returns the facility with courts. */
export async function assertOwnsFacility(facilityId: string, userId: string, role: Role) {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    include: { courts: { orderBy: { name: 'asc' } } },
  });
  if (!facility) throw new Error('Facility not found.');
  if (role !== 'SUPER_ADMIN' && facility.ownerId !== userId) {
    throw new Error('That facility belongs to another owner.');
  }
  return facility;
}

/** Assert the signed-in owner owns the court this booking belongs to. */
export async function assertOwnsBooking(bookingId: string, userId: string, role: Role) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { court: true },
  });
  if (!booking) throw new Error('Booking not found.');
  const court = await prisma.court.findUnique({
    where: { id: booking.courtId },
    select: { facilityId: true },
  });
  if (!court) throw new Error('Court not found.');
  const facility = await prisma.facility.findUnique({
    where: { id: court.facilityId },
    select: { ownerId: true },
  });
  if (!facility) throw new Error('Facility not found.');
  if (role !== 'SUPER_ADMIN' && facility.ownerId !== userId) {
    throw new Error('That booking belongs to another owner.');
  }
  return booking;
}
