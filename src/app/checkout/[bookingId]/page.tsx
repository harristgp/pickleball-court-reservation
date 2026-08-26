import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, Clock, MapPin, Trophy } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/session';
import { releaseExpiredHolds } from '@/lib/slots';
import { decimalToNumber, formatMoney } from '@/lib/money';
import { formatDateKey, formatSlotRange, toDateKey } from '@/lib/dates';
import type { PaymentMethodSummary } from '@/lib/types';
import { Card, CardHeader, Alert } from '@/components/ui';
import { StatusBadge } from '@/components/layout/StatusBadge';
import { QrPanel } from '@/components/checkout/QrPanel';
import { ExpiryCountdown } from '@/components/checkout/ExpiryCountdown';
import { ReceiptUploader } from '@/components/checkout/ReceiptUploader';
import { CancelBookingButton } from '@/components/checkout/CancelBookingButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Submit payment' };

export default async function CheckoutPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const user = await requireUser(`/checkout/${bookingId}`);

  await releaseExpiredHolds(prisma);

  const group = await prisma.bookingGroup.findUnique({
    where: { id: bookingId },
    include: {
      receipt: true,
      facility: {
        include: {
          owner: {
            select: {
              name: true,
              paymentMethods: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      },
      bookings: {
        include: {
          court: true,
        },
        orderBy: { startTime: 'asc' },
      },
    },
  });

  if (!group) notFound();
  if (group.playerId !== user.id && user.role !== 'SUPER_ADMIN') notFound();

  const { facility, bookings } = group;
  if (!facility) notFound();
  const amount = decimalToNumber(group.totalPrice);
  const firstBooking = bookings[0];

  if (!firstBooking) notFound();

  const dateKey = toDateKey(firstBooking.date);
  const startHour = firstBooking.startTime.getUTCHours();

  const paymentMethods: PaymentMethodSummary[] = facility.owner.paymentMethods.map((m) => ({
    id: m.id,
    name: m.name,
    accountName: m.accountName,
    accountNumber: m.accountNumber,
    qrCodeUrl: m.qrCodeUrl,
    instructions: m.instructions,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/browse"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to facilities
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Submit payment</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={group.status} />
          {group.status === 'PENDING_PAYMENT' && group.expiresAt && (
            <ExpiryCountdown expiresAt={group.expiresAt.toISOString()} />
          )}
        </div>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={<MapPin className="h-4 w-4" aria-hidden />} label="Facility" value={facility.name} />
          <Fact
            icon={<Trophy className="h-4 w-4" aria-hidden />}
            label="Bookings"
            value={`${bookings.length} hour${bookings.length === 1 ? '' : 's'}`}
            sub={bookings.map((b) => `${b.court.name} ${formatSlotRange(b.startTime.getUTCHours())}`).join(', ')}
          />
          <Fact
            icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            label="Date"
            value={formatDateKey(dateKey)}
          />
          <Fact
            icon={<Clock className="h-4 w-4" aria-hidden />}
            label="Time"
            value={formatSlotRange(startHour)}
            sub={`${formatMoney(amount)} total`}
          />
        </div>
      </Card>

      {group.status === 'REJECTED' && (
        <Alert tone="error">
          {group.receipt?.rejectionReason
            ? `The owner rejected this booking: ${group.receipt.rejectionReason}`
            : 'This booking was rejected or its payment hold expired. The slots are open again — book another time.'}
        </Alert>
      )}
      {group.status === 'CONFIRMED' && (
        <Alert tone="success">Payment verified. Your courts are booked — see you on the court.</Alert>
      )}
      {group.status === 'PENDING_VERIFICATION' && (
        <Alert tone="neutral">
          Receipt received. The owner is reviewing it; you will see the result on your dashboard.
        </Alert>
      )}

      {group.status === 'PENDING_PAYMENT' || group.status === 'PENDING_VERIFICATION' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <CardHeader title="1. Pay the owner" description="Scan the QR or send to the account below." />
            <div className="mt-4">
              <QrPanel
                clubName={facility.owner.name}
                amount={amount}
                paymentMethods={paymentMethods}
                selectedMethodId={group.paymentMethodId}
              />
            </div>
          </Card>

          <Card className="p-5">
            <CardHeader
              title="2. Upload your receipt"
              description="A screenshot of the successful transfer is what the owner verifies."
            />
            <div className="mt-4">
              <ReceiptUploader
                groupId={group.id}
                amount={amount}
                existingUrl={group.receipt?.screenshotUrl ?? null}
              />
            </div>
            {group.status === 'PENDING_PAYMENT' && (
              <div className="mt-5 border-t border-zinc-100 pt-4">
                <CancelBookingButton groupId={group.id} />
              </div>
            )}
          </Card>
        </div>
      ) : (
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Go to my bookings
        </Link>
      )}
    </div>
  );
}

function Fact({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-semibold text-zinc-900">{value}</p>
      {sub && <p className="text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
