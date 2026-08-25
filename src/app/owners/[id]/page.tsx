import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapPin, QrCode } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { getDayAvailability } from '@/lib/slots';
import { todayKey } from '@/lib/dates';
import { BookingGrid } from '@/components/booking/BookingGrid';
import { Card, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const owner = await prisma.user.findUnique({ where: { id: params.id }, select: { name: true } });
  return owner ? { title: `${owner.name}'s courts` } : { title: 'Owner not found' };
}

export default async function OwnerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { date?: string };
}) {
  const owner = await prisma.user.findUnique({
    where: { id: params.id, role: 'OWNER', isActive: true },
    include: {
      paymentMethods: {
        where: { isActive: true },
        select: { id: true, name: true, accountName: true },
        orderBy: { sortOrder: 'asc' },
        take: 1,
      },
    },
  });

  if (!owner) notFound();

  const user = await getCurrentUser();
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? '') ? searchParams.date! : todayKey();
  const courts = await getDayAvailability({ ownerId: owner.id, dateKey, viewerId: user?.id });
  const primaryMethod = owner.paymentMethods[0] ?? null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{owner.name}</h1>
        {owner.phone && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-zinc-500">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {owner.phone}
          </p>
        )}

        {primaryMethod && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
            <QrCode className="h-4 w-4 text-brand-600" aria-hidden />
            Pay by {primaryMethod.name} to <span className="font-semibold text-zinc-800">{primaryMethod.accountName}</span>{' '}
            after booking, then upload your receipt.
          </p>
        )}
      </div>

      {courts.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title="No courts published yet"
            description="This owner has not added any bookable courts. Check back soon."
          />
        </Card>
      ) : (
        <BookingGrid ownerId={owner.id} dateKey={dateKey} courts={courts} isSignedIn={Boolean(user)} />
      )}
    </div>
  );
}
