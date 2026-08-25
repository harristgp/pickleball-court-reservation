import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { requireOwnedClub } from '@/lib/session';
import { decimalToNumber } from '@/lib/money';
import { Card, CardHeader, EmptyState } from '@/components/ui';
import { CourtManager, type CourtRow } from '@/components/owner/CourtManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Courts' };

export default async function OwnerCourtsPage() {
  const { club } = await requireOwnedClub('/owner/courts');

  if (!club) {
    return (
      <Card className="p-6">
        <EmptyState title="No club assigned" description="Court management unlocks once your club is provisioned." />
      </Card>
    );
  }

  const courts = await prisma.court.findMany({
    where: { clubId: club.id },
    include: { _count: { select: { bookings: true } } },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  const rows: CourtRow[] = courts.map((court) => ({
    id: court.id,
    name: court.name,
    type: court.type,
    hourlyRate: decimalToNumber(court.hourlyRate),
    openHour: court.openHour,
    closeHour: court.closeHour,
    isActive: court.isActive,
    bookingCount: court._count.bookings,
  }));

  return (
    <div className="space-y-5">
      <CardHeader
        title="Courts"
        description="Each court has its own rate and opening hours. The booking grid is built from these."
      />
      <CourtManager courts={rows} />
    </div>
  );
}
