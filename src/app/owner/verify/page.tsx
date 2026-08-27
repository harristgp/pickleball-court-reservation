import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireOwner } from '@/lib/session';
import { decimalToNumber } from '@/lib/money';
import { formatDateKey, formatDateTime, formatSlotRange, toDateKey } from '@/lib/dates';
import { Card, CardHeader } from '@/components/ui';
import { VerifyQueue, type QueueItem } from '@/components/owner/VerifyQueue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Approvals queue' };

export default async function OwnerVerifyPage() {
  const { userId } = await requireOwner('/owner/verify');

  const groups = await prisma.bookingGroup.findMany({
    where: {
      facility: { ownerId: userId },
      status: 'PENDING_VERIFICATION',
    },
    select: {
      id: true,
      totalPrice: true,
      createdAt: true,
      receipt: {
        select: {
          screenshotUrl: true,
          referenceNumber: true,
          amountClaimed: true,
          uploadedAt: true,
        },
      },
      bookings: {
        select: {
          id: true,
          date: true,
          startTime: true,
          court: { select: { name: true, type: true } },
        },
        orderBy: { startTime: 'asc' },
      },
      facility: { select: { name: true } },
      player: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const items: QueueItem[] = groups
    .filter((group) => group.receipt !== null && group.facility !== null)
    .map((group) => {
      const facility = group.facility!;
      const firstBooking = group.bookings[0]!;
      const lastBooking = group.bookings[group.bookings.length - 1];
      const hours = group.bookings.map((b) => b.court.name).join(', ');

      return {
        bookingId: group.id,
        courtName: facility.name,
        courtType: firstBooking.court.type as 'INDOOR' | 'OUTDOOR',
        playerName: group.player.name || group.player.email,
        playerEmail: group.player.email,
        dateLabel: formatDateKey(toDateKey(firstBooking.date)),
        timeLabel: `${formatSlotRange(firstBooking.startTime.getUTCHours())} × ${group.bookings.length}hr (${hours})`,
        amount: decimalToNumber(group.totalPrice),
        screenshotUrl: group.receipt!.screenshotUrl,
        referenceNumber: group.receipt!.referenceNumber,
        amountClaimed:
          group.receipt!.amountClaimed === null ? null : decimalToNumber(group.receipt!.amountClaimed),
        uploadedLabel: formatDateTime(group.receipt!.uploadedAt),
      };
    });

  return (
    <div className="space-y-5">
      <CardHeader
        title="Approvals queue"
        description="Compare each receipt against the booking, then approve or reject. Rejecting frees the time slots immediately."
      />
      <VerifyQueue items={items} />
    </div>
  );
}
