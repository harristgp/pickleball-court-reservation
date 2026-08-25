'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { toggleClubSchema } from '@/lib/validators';
import type { ActionState } from '@/lib/types';

/**
 * SUPER_ADMIN tenant kill switch.
 *
 * Deactivating hides the club from discovery and blocks new bookings
 * (createBookingAction rejects inactive clubs) but leaves existing bookings and
 * their payment records intact, so suspending an account never destroys a
 * player's confirmed reservation.
 */
export async function toggleClubActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(['SUPER_ADMIN']);

  const parsed = toggleClubSchema.safeParse({
    clubId: formData.get('clubId'),
    isActive: formData.get('isActive') === 'true',
  });
  if (!parsed.success) return { ok: false, message: 'Malformed request.' };

  const club = await prisma.club.update({
    where: { id: parsed.data.clubId },
    data: { isActive: parsed.data.isActive },
    select: { name: true, isActive: true },
  });

  revalidatePath('/admin/clubs');
  revalidatePath('/discover');

  return {
    ok: true,
    message: `${club.name} is now ${club.isActive ? 'active' : 'suspended'}.`,
  };
}
