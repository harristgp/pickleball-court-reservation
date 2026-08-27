import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, CalendarDays, CalendarSearch, Clock, Receipt, Trophy } from 'lucide-react';
import type { BookingStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { releaseExpiredHolds } from '@/lib/slots';
import { formatMoney } from '@/lib/money';
import { formatDateKey, toDateKey } from '@/lib/dates';
import { Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { StatusBadge } from '@/components/layout/StatusBadge';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My bookings' };

const GROUPS: { key: BookingStatus; title: string; description: string }[] = [
  {
    key: 'PENDING_PAYMENT',
    title: 'Action needed',
    description: 'Pay the owner and upload your receipt before the hold expires.',
  },
  {
    key: 'PENDING_VERIFICATION',
    title: 'Waiting on the owner',
    description: 'Your receipt is in the owner\'s verification queue.',
  },
  { key: 'CONFIRMED', title: 'Confirmed', description: 'Paid, verified, and on the schedule.' },
  { key: 'REJECTED', title: 'Rejected or expired', description: 'These bookings were released back to the owner.' },
];

export default async function DashboardPage() {
  const user = await requireUser('/dashboard');
  await releaseExpiredHolds(prisma);

  const groups = await prisma.bookingGroup.findMany({
    where: { playerId: user.id },
    select: {
      id: true,
      totalPrice: true,
      createdAt: true,
      status: true,
      facility: { select: { name: true } },
      bookings: {
        select: {
          id: true,
          date: true,
          startTime: true,
          endTime: true,
          totalPrice: true,
          status: true,
          court: { select: { name: true, type: true } },
        },
        orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const allBookings = groups.flatMap((g) => g.bookings);
  const upcoming = allBookings.filter((b) => b.status === 'CONFIRMED' && b.endTime >= new Date()).length;
  const awaiting = allBookings.filter((b) => b.status === 'PENDING_VERIFICATION').length;
  const unpaid = groups.filter((g) => g.status === 'PENDING_PAYMENT').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">My bookings</h1>
          <p className="mt-1 text-sm text-zinc-500">Hi {user.name || user.email} — here is everything you booked.</p>
        </div>
        <Link href="/browse">
          <Button variant="secondary">
            <CalendarSearch className="h-4 w-4" aria-hidden />
            Find a facility
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<CalendarCheck className="h-4 w-4" aria-hidden />} label="Upcoming confirmed" value={upcoming} />
        <Stat icon={<Receipt className="h-4 w-4" aria-hidden />} label="Awaiting verification" value={awaiting} />
        <Stat icon={<Clock className="h-4 w-4" aria-hidden />} label="Awaiting payment" value={unpaid} />
      </div>

      {groups.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<CalendarSearch className="h-6 w-6" aria-hidden />}
            title="No bookings yet"
            description="Find a facility near you and grab a slot."
            action={
              <Link href="/browse">
                <Button>Browse facilities</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {GROUPS.map((groupDef) => {
            const matching = groups.filter((g) => g.status === groupDef.key);
            if (matching.length === 0) return null;
            return (
              <section key={groupDef.key}>
                <CardHeader title={groupDef.title} description={groupDef.description} />
                <div className="mt-3 space-y-3">
                  {matching.map((group) => (
                    <GroupCard key={group.id} group={group} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
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

function GroupCard({
  group,
}: {
  group: {
    id: string;
    status: BookingStatus;
    totalPrice: import('@prisma/client').Prisma.Decimal;
    createdAt: Date;
    facility: { name: string } | null;
    bookings: Array<{
      id: string;
      date: Date;
      startTime: Date;
      endTime: Date;
      totalPrice: import('@prisma/client').Prisma.Decimal;
      court: { name: string; type: string };
    }>;
  };
}) {
  const actionable = group.status === 'PENDING_PAYMENT' || group.status === 'PENDING_VERIFICATION';
  const firstBooking = group.bookings[0];
  const firstDate = firstBooking ? toDateKey(firstBooking.date) : '';
  const hours = group.bookings.map((b) => b.court.name).join(', ');

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-zinc-900">{group.facility?.name ?? 'Unknown'}</h3>
          <StatusBadge status={group.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
          <span className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
            {group.bookings.length} hour{group.bookings.length === 1 ? '' : 's'} — {hours}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
            {formatDateKey(firstDate)}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="text-lg font-bold tabular-nums text-zinc-900">{formatMoney(group.totalPrice)}</span>
        {actionable ? (
          <Link href={`/checkout/${group.id}`}>
            <Button size="sm" variant={group.status === 'PENDING_PAYMENT' ? 'primary' : 'secondary'}>
              {group.status === 'PENDING_PAYMENT' ? 'Complete payment' : 'View receipt'}
            </Button>
          </Link>
        ) : (
          <Link href="/browse">
            <Button size="sm" variant="ghost">
              Book again
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
