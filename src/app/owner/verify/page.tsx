import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireOwnedClub } from '@/lib/session';
import { decimalToNumber } from '@/lib/money';
import { formatDateKey, formatDateTime, formatSlotRange, toDateKey } from '@/lib/dates';
import { Card, CardHeader, EmptyState } from '@/components/ui';
import { VerifyQueue, type QueueItem } from '@/components/owner/VerifyQueue';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Approvals queue' };

export default async function OwnerVerifyPage() {
  const { club } = await requireOwnedClub('/owner/verify');

  if (!club) {
    return (
      <Card className="p-6">
        <EmptyState title="No club assigned" description="The approvals queue unlocks once your club is provisioned." />
      </Card>
    );
  }

  const bookings = await prisma.booking.findMany({
    where: { court: { clubId: club.id }, status: 'PENDING_VERIFICATION' },
    include: { receipt: true, court: true, player: { select: { name: true, email: true } } },
    orderBy: [{ createdAt: 'asc' }],
  });

  // A PENDING_VERIFICATION row always has a receipt; the filter is a type guard
  // rather than a real branch.
  const items: QueueItem[] = bookings
    .filter((booking) => booking.receipt !== null)
    .map((booking) => ({
      bookingId: booking.id,
      courtName: booking.court.name,
      courtType: booking.court.type,
      playerName: booking.player.name || booking.player.email,
      playerEmail: booking.player.email,
      dateLabel: formatDateKey(toDateKey(booking.date)),
      timeLabel: formatSlotRange(booking.startTime.getUTCHours()),
      amount: decimalToNumber(booking.totalPrice),
      screenshotUrl: booking.receipt!.screenshotUrl,
      referenceNumber: booking.receipt!.referenceNumber,
      amountClaimed:
        booking.receipt!.amountClaimed === null ? null : decimalToNumber(booking.receipt!.amountClaimed),
      uploadedLabel: formatDateTime(booking.receipt!.uploadedAt),
    }));

  return (
    <div className="space-y-5">
      <CardHeader
        title="Approvals queue"
        description="Compare each receipt against the booking, then approve or reject. Rejecting frees the time slot immediately."
      />
      <VerifyQueue items={items} />
    </div>
  );
}
