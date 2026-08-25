import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarCheck, CalendarSearch, Clock, MapPin, Receipt, Trophy } from 'lucide-react';
import type { Booking, BookingStatus, Court, Club, PaymentReceipt } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { releaseExpiredHolds } from '@/lib/slots';
import { formatMoney } from '@/lib/money';
import { formatDateKey, formatSlotRange, toDateKey } from '@/lib/dates';
import { Button, Card, CardHeader, EmptyState } from '@/components/ui';
import { StatusBadge } from '@/components/layout/StatusBadge';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My bookings' };

type Row = Booking & { receipt: PaymentReceipt | null; court: Court & { club: Club } };

const GROUPS: { key: BookingStatus; title: string; description: string }[] = [
  {
    key: 'PENDING_PAYMENT',
    title: 'Action needed',
    description: 'Pay the club and upload your receipt before the hold expires.',
  },
  {
    key: 'PENDING_VERIFICATION',
    title: 'Waiting on the club',
    description: 'Your receipt is in the club’s verification queue.',
  },
  { key: 'CONFIRMED', title: 'Confirmed', description: 'Paid, verified, and on the schedule.' },
  { key: 'REJECTED', title: 'Rejected or expired', description: 'These slots were released back to the club.' },
];

export default async function DashboardPage() {
  const user = await requireUser('/dashboard');
  await releaseExpiredHolds(prisma);

  const bookings = (await prisma.booking.findMany({
    where: { playerId: user.id },
    include: { receipt: true, court: { include: { club: true } } },
    orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    take: 100,
  })) as Row[];

  const upcoming = bookings.filter((b) => b.status === 'CONFIRMED' && b.endTime >= new Date()).length;
  const awaiting = bookings.filter((b) => b.status === 'PENDING_VERIFICATION').length;
  const unpaid = bookings.filter((b) => b.status === 'PENDING_PAYMENT').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">My bookings</h1>
          <p className="mt-1 text-sm text-zinc-500">Hi {user.name || user.email} — here is everything you booked.</p>
        </div>
        <Link href="/discover">
          <Button variant="secondary">
            <CalendarSearch className="h-4 w-4" aria-hidden />
            Find a court
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={<CalendarCheck className="h-4 w-4" aria-hidden />} label="Upcoming confirmed" value={upcoming} />
        <Stat icon={<Receipt className="h-4 w-4" aria-hidden />} label="Awaiting verification" value={awaiting} />
        <Stat icon={<Clock className="h-4 w-4" aria-hidden />} label="Awaiting payment" value={unpaid} />
      </div>

      {bookings.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            icon={<CalendarSearch className="h-6 w-6" aria-hidden />}
            title="No bookings yet"
            description="Find a club near you and grab a court."
            action={
              <Link href="/discover">
                <Button>Browse clubs</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="space-y-8">
          {GROUPS.map((group) => {
            const rows = bookings.filter((booking) => booking.status === group.key);
            if (rows.length === 0) return null;
            return (
              <section key={group.key}>
                <CardHeader title={group.title} description={group.description} />
                <div className="mt-3 space-y-3">
                  {rows.map((booking) => (
                    <BookingRow key={booking.id} booking={booking} />
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

function BookingRow({ booking }: { booking: Row }) {
  const dateKey = toDateKey(booking.date);
  const actionable = booking.status === 'PENDING_PAYMENT' || booking.status === 'PENDING_VERIFICATION';

  return (
    <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-zinc-900">{booking.court.club.name}</h3>
          <StatusBadge status={booking.status} />
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-600">
          <span className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
            {booking.court.name}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
            {formatDateKey(dateKey)} · {formatSlotRange(booking.startTime.getUTCHours())}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
            {booking.court.club.city}
          </span>
        </p>
        {booking.status === 'REJECTED' && booking.receipt?.rejectionReason && (
          <p className="mt-2 rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
            Reason: {booking.receipt.rejectionReason}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span className="text-lg font-bold tabular-nums text-zinc-900">{formatMoney(booking.totalPrice)}</span>
        {actionable ? (
          <Link href={`/checkout/${booking.id}`}>
            <Button size="sm" variant={booking.status === 'PENDING_PAYMENT' ? 'primary' : 'secondary'}>
              {booking.status === 'PENDING_PAYMENT' ? 'Complete payment' : 'View receipt'}
            </Button>
          </Link>
        ) : (
          <Link href={`/clubs/${booking.court.clubId}?date=${dateKey}`}>
            <Button size="sm" variant="ghost">
              Book again
            </Button>
          </Link>
        )}
      </div>
    </Card>
  );
}
