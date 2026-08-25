import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapPin, Phone, QrCode } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { getDayAvailability } from '@/lib/slots';
import { todayKey } from '@/lib/dates';
import { BookingGrid } from '@/components/booking/BookingGrid';
import { MapPanel } from '@/components/map/MapPanel';
import { Card, EmptyState } from '@/components/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const club = await prisma.club.findUnique({ where: { id: params.id }, select: { name: true, city: true } });
  return club ? { title: `${club.name} — ${club.city}` } : { title: 'Club not found' };
}

export default async function ClubPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { date?: string };
}) {
  const club = await prisma.club.findUnique({
    where: { id: params.id },
    include: {
      paymentMethods: {
        where: { isActive: true },
        select: { id: true, name: true, accountName: true },
        orderBy: { sortOrder: 'asc' },
        take: 1,
      },
    },
  });

  // A suspended club is indistinguishable from a missing one for players; only
  // the admin console reveals that it exists.
  if (!club || !club.isActive) notFound();

  const user = await getCurrentUser();
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date ?? '') ? searchParams.date! : todayKey();
  const courts = await getDayAvailability({ clubId: club.id, dateKey, viewerId: user?.id });
  const rates = courts.map((court) => court.hourlyRate);
  const primaryMethod = club.paymentMethods[0] ?? null;

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{club.name}</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-zinc-500">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {club.address}, {club.city}
          </p>
          {club.phone && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
              <Phone className="h-4 w-4 shrink-0" aria-hidden />
              {club.phone}
            </p>
          )}
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-600">{club.description}</p>

          {primaryMethod && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-600">
              <QrCode className="h-4 w-4 text-brand-600" aria-hidden />
              Pay by {primaryMethod.name} to <span className="font-semibold text-zinc-800">{primaryMethod.accountName}</span>{' '}
              after booking, then upload your receipt.
            </p>
          )}
        </div>

        <div className="h-56 overflow-hidden rounded-xl border border-zinc-200 shadow-card">
          <MapPanel
            clubs={[
              {
                id: club.id,
                name: club.name,
                slug: club.slug,
                city: club.city,
                address: club.address,
                description: club.description,
                imageUrl: club.imageUrl,
                latitude: club.latitude,
                longitude: club.longitude,
                minRate: rates.length ? Math.min(...rates) : null,
                maxRate: rates.length ? Math.max(...rates) : null,
                courtCount: courts.length,
                hasIndoor: courts.some((court) => court.courtType === 'INDOOR'),
                hasOutdoor: courts.some((court) => court.courtType === 'OUTDOOR'),
              },
            ]}
            center={null}
          />
        </div>
      </div>

      {courts.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title="No courts published yet"
            description="This club has not added any bookable courts. Check back soon."
          />
        </Card>
      ) : (
        <BookingGrid clubId={club.id} dateKey={dateKey} courts={courts} isSignedIn={Boolean(user)} />
      )}
    </div>
  );
}
