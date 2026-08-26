import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, Banknote, CalendarDays, CircleAlert, QrCode, Trophy } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireOwner } from '@/lib/session';
import { releaseExpiredHolds } from '@/lib/slots';
import { decimalToNumber, formatMoney } from '@/lib/money';
import { dateKeyToUtcMidnight, formatSlotRange, todayKey } from '@/lib/dates';
import { Alert, Badge, Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { StatusBadge } from '@/components/layout/StatusBadge';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Owner overview' };

export default async function OwnerHome() {
  const { userId, user } = await requireOwner('/owner');

  await releaseExpiredHolds(prisma);

  const today = dateKeyToUtcMidnight(todayKey());
  const [courtCount, pendingCount, todays, confirmedMonth, paymentMethodCount] = await Promise.all([
    prisma.court.count({ where: { facility: { ownerId: userId }, isActive: true } }),
    prisma.booking.count({
      where: { status: 'PENDING_VERIFICATION', court: { facility: { ownerId: userId } } },
    }),
    prisma.booking.findMany({
      where: { date: today, status: { not: 'REJECTED' }, court: { facility: { ownerId: userId } } },
      include: { court: { include: { facility: true } }, player: { select: { name: true, email: true } } },
      orderBy: { startTime: 'asc' },
    }),
    prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        court: { facility: { ownerId: userId } },
        date: { gte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) },
      },
      select: { totalPrice: true },
    }),
    prisma.paymentMethod.count({ where: { ownerId: userId, isActive: true } }),
  ]);

  const revenue = confirmedMonth.reduce((sum, row) => sum + decimalToNumber(row.totalPrice), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{user.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
        </div>
        <Badge tone={user.role === 'SUPER_ADMIN' ? 'blue' : 'emerald'}>{user.role}</Badge>
      </div>

      {user.role === 'OWNER' && !paymentMethodCount && (
        <Alert tone="error">
          <span className="flex flex-wrap items-center gap-2">
            <CircleAlert className="h-4 w-4 shrink-0" aria-hidden />
            No payment methods published — players cannot pay you yet.
            <Link href="/owner/settings" className="font-semibold underline">
              Add your first payment method
            </Link>
          </span>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<BadgeCheck className="h-4 w-4" aria-hidden />} label="Awaiting approval" value={String(pendingCount)} />
        <Stat icon={<CalendarDays className="h-4 w-4" aria-hidden />} label="Bookings today" value={String(todays.length)} />
        <Stat icon={<Trophy className="h-4 w-4" aria-hidden />} label="Active courts" value={String(courtCount)} />
        <Stat icon={<Banknote className="h-4 w-4" aria-hidden />} label="Confirmed this month" value={formatMoney(revenue)} />
      </div>

      <Card className="p-5">
        <CardHeader
          title="Today's schedule"
          description="Everything booked for today that has not been rejected."
          action={
            pendingCount > 0 ? (
              <Link href="/owner/verify">
                <Button size="sm">
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                  Review {pendingCount} receipt{pendingCount === 1 ? '' : 's'}
                </Button>
              </Link>
            ) : (
              <Link href="/owner/settings">
                <Button size="sm" variant="secondary">
                  <QrCode className="h-4 w-4" aria-hidden />
                  Payment settings
                </Button>
              </Link>
            )
          }
        />
        <div className="mt-4">
          {todays.length === 0 ? (
            <EmptyState title="Nothing booked today" description="Bookings appear here as players pay." />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {todays.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-zinc-900">
                      {formatSlotRange(booking.startTime.getUTCHours())} · {booking.court.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {booking.player.name || booking.player.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums text-zinc-900">
                      {formatMoney(booking.totalPrice)}
                    </span>
                    <StatusBadge status={booking.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
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
