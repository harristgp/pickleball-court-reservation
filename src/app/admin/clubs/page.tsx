import type { Metadata } from 'next';
import { Building2, CircleCheck, CirclePause, Users } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/session';
import { decimalToNumber, formatMoney } from '@/lib/money';
import { Card, CardHeader } from '@/components/ui';
import { ClubTable, type AdminClubRow } from '@/components/admin/ClubTable';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'All clubs' };

export default async function AdminClubsPage() {
  await requireRole(['SUPER_ADMIN'], '/admin/clubs');

  const clubs = await prisma.club.findMany({
    include: {
      owner: { select: { name: true, email: true } },
      paymentMethods: { select: { id: true }, where: { isActive: true } },
      _count: { select: { courts: true } },
      courts: {
        select: {
          bookings: { select: { status: true, totalPrice: true } },
        },
      },
    },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });

  const rows: AdminClubRow[] = clubs.map((club) => {
    const bookings = club.courts.flatMap((court) => court.bookings);
    return {
      id: club.id,
      name: club.name,
      city: club.city,
      ownerName: club.owner.name || club.owner.email,
      ownerEmail: club.owner.email,
      courtCount: club._count.courts,
      bookingCount: bookings.length,
      confirmedRevenue: bookings
        .filter((booking) => booking.status === 'CONFIRMED')
        .reduce((sum, booking) => sum + decimalToNumber(booking.totalPrice), 0),
      hasPaymentConfig: club.paymentMethods.length > 0,
      isActive: club.isActive,
    };
  });

  const active = rows.filter((row) => row.isActive).length;
  const totalRevenue = rows.reduce((sum, row) => sum + row.confirmedRevenue, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Building2 className="h-4 w-4" aria-hidden />} label="Clubs" value={String(rows.length)} />
        <Stat icon={<CircleCheck className="h-4 w-4" aria-hidden />} label="Active" value={String(active)} />
        <Stat
          icon={<CirclePause className="h-4 w-4" aria-hidden />}
          label="Suspended"
          value={String(rows.length - active)}
        />
        <Stat icon={<Users className="h-4 w-4" aria-hidden />} label="Confirmed GMV" value={formatMoney(totalRevenue)} />
      </div>

      <CardHeader
        title="Clubs"
        description="Suspending a club removes it from discovery and blocks new bookings. Existing bookings are untouched."
      />
      <ClubTable clubs={rows} />
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
    </Card>
  );
}
