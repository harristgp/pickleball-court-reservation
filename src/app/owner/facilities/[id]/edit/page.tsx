import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireOwner } from '@/lib/session';
import { FacilityForm } from '@/components/owner/FacilityForm';
import { FacilityCourtManager } from '@/components/owner/FacilityCourtManager';

export const metadata: Metadata = { title: 'Edit Facility' };

export default async function EditFacilityPage({ params }: { params: { id: string } }) {
  const { userId } = await requireOwner('/owner/facilities');

  const facility = await prisma.facility.findUnique({
    where: { id: params.id },
    include: {
      courts: {
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          type: true,
          hourlyRate: true,
          openHour: true,
          closeHour: true,
          isActive: true,
        },
      },
    },
  });

  if (!facility || facility.ownerId !== userId) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Edit Facility</h1>

      <FacilityForm facility={facility} />

      <FacilityCourtManager
        facilityId={facility.id}
        courts={facility.courts.map((c) => ({
          ...c,
          hourlyRate: c.hourlyRate.toNumber(),
        }))}
      />
    </div>
  );
}
