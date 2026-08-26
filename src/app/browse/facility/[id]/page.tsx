import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/session';
import { getFacilityAvailability } from '@/lib/slots';
import { todayKey } from '@/lib/dates';
import { FacilityHero } from '@/components/facility/FacilityHero';
import { FacilityGallery } from '@/components/facility/FacilityGallery';
import { FacilityDetails } from '@/components/facility/FacilityDetails';
import { MultiCourtGrid } from '@/components/booking/MultiCourtGrid';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const facility = await prisma.facility.findUnique({
    where: { id },
    select: { name: true, city: true },
  });
  return facility ? { title: `${facility.name} — ${facility.city}` } : { title: 'Facility not found' };
}

export default async function FacilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date } = await searchParams;

  const facility = await prisma.facility.findUnique({
    where: { id, isActive: true },
    include: {
      owner: { select: { id: true, name: true } },
      courts: {
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          hourlyRate: true,
          openHour: true,
          closeHour: true,
        },
      },
    },
  });

  if (!facility) notFound();

  const user = await getCurrentUser();
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ? date! : todayKey();

  const courts = await getFacilityAvailability({ facilityId: facility.id, dateKey, viewerId: user?.id });
  const rates = facility.courts.map((c) => c.hourlyRate.toNumber());

  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: { ownerId: facility.ownerId, isActive: true },
    select: { id: true, name: true, accountName: true, accountNumber: true, qrCodeUrl: true, instructions: true },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <div className="space-y-8">
      <FacilityHero
        name={facility.name}
        ownerName={facility.owner.name}
        address={facility.address}
        city={facility.city}
        latitude={facility.latitude}
        longitude={facility.longitude}
      />

      {facility.photos.length > 0 && <FacilityGallery photos={facility.photos} />}

      <FacilityDetails
        description={facility.description}
        openHour={facility.openHour}
        closeHour={facility.closeHour}
        courtCount={facility.courts.length}
        minRate={rates.length ? Math.min(...rates) : null}
        maxRate={rates.length ? Math.max(...rates) : null}
        paymentMethod={paymentMethod}
      />

      <MultiCourtGrid
        facilityId={facility.id}
        ownerId={facility.ownerId}
        dateKey={dateKey}
        courts={courts}
        isSignedIn={Boolean(user)}
        paymentMethods={
          paymentMethod ? [paymentMethod] : []
        }
      />
    </div>
  );
}
