'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { toggleOwnerSchema } from '@/lib/validators';
import type { ActionState } from '@/lib/types';

/**
 * SUPER_ADMIN tenant kill switch.
 *
 * Deactivating hides the owner's courts from discovery and blocks new bookings
 * (createBookingAction rejects inactive owners) but leaves existing bookings and
 * their payment records intact, so suspending an account never destroys a
 * player's confirmed reservation.
 */
export async function toggleOwnerActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(['SUPER_ADMIN']);

  const parsed = toggleOwnerSchema.safeParse({
    ownerId: formData.get('ownerId'),
    isActive: formData.get('isActive') === 'true',
  });
  if (!parsed.success) return { ok: false, message: 'Malformed request.' };

  const owner = await prisma.user.update({
    where: { id: parsed.data.ownerId },
    data: { isActive: parsed.data.isActive },
    select: { name: true, isActive: true },
  });

  revalidatePath('/admin/owners');
  revalidatePath('/discover');

  return {
    ok: true,
    message: `${owner.name} is now ${owner.isActive ? 'active' : 'suspended'}.`,
  };
}
