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

export default async function CheckoutPage({ params }: { params: { bookingId: string } }) {
  const user = await requireUser(`/checkout/${params.bookingId}`);

  // Sweep first: a booking whose hold lapsed must read as REJECTED here rather
  // than inviting the player to pay for a slot someone else can now take.
  await releaseExpiredHolds(prisma);

  const booking = await prisma.booking.findUnique({
    where: { id: params.bookingId },
    include: {
      receipt: true,
      court: {
        include: {
          owner: {
            include: {
              paymentMethods: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
        },
      },
    },
  });

  if (!booking) notFound();
  if (booking.playerId !== user.id && user.role !== 'SUPER_ADMIN') notFound();

  const { court } = booking;
  const owner = court.owner;
  const amount = decimalToNumber(booking.totalPrice);
  const dateKey = toDateKey(booking.date);

  const paymentMethods: PaymentMethodSummary[] = owner.paymentMethods.map((m) => ({
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
        href={`/discover`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to courts
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Submit payment</h1>
        <div className="flex items-center gap-2">
          <StatusBadge status={booking.status} />
          {booking.status === 'PENDING_PAYMENT' && (
            <ExpiryCountdown expiresAt={booking.expiresAt.toISOString()} />
          )}
        </div>
      </div>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={<MapPin className="h-4 w-4" aria-hidden />} label="Owner" value={owner.name} />
          <Fact
            icon={<Trophy className="h-4 w-4" aria-hidden />}
            label="Court"
            value={court.name}
            sub={court.type === 'INDOOR' ? 'Indoor' : 'Outdoor'}
          />
          <Fact
            icon={<CalendarDays className="h-4 w-4" aria-hidden />}
            label="Date"
            value={formatDateKey(dateKey)}
          />
          <Fact
            icon={<Clock className="h-4 w-4" aria-hidden />}
            label="Time"
            value={formatSlotRange(booking.startTime.getUTCHours())}
            sub={`${formatMoney(amount)} total`}
          />
        </div>
      </Card>

      {booking.status === 'REJECTED' && (
        <Alert tone="error">
          {booking.receipt?.rejectionReason
            ? `The owner rejected this booking: ${booking.receipt.rejectionReason}`
            : 'This booking was rejected or its payment hold expired. The slot is open again — book another time.'}
        </Alert>
      )}
      {booking.status === 'CONFIRMED' && (
        <Alert tone="success">Payment verified. Your court is booked — see you on the court.</Alert>
      )}
      {booking.status === 'PENDING_VERIFICATION' && (
        <Alert tone="neutral">
          Receipt received. {owner.name} is reviewing it; you will see the result on your dashboard.
        </Alert>
      )}

      {booking.status === 'PENDING_PAYMENT' || booking.status === 'PENDING_VERIFICATION' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5">
            <CardHeader title="1. Pay the owner" description="Scan the QR or send to the account below." />
            <div className="mt-4">
              <QrPanel
                clubName={owner.name}
                amount={amount}
                paymentMethods={paymentMethods}
                selectedMethodId={booking.paymentMethodId}
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
                bookingId={booking.id}
                amount={amount}
                existingUrl={booking.receipt?.screenshotUrl ?? null}
              />
            </div>
            {booking.status === 'PENDING_PAYMENT' && (
              <div className="mt-5 border-t border-zinc-100 pt-4">
                <CancelBookingButton bookingId={booking.id} />
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
