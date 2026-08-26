import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireOwner } from '@/lib/session';
import { OwnerFacilityCard } from '@/components/owner/OwnerFacilityCard';

export const metadata: Metadata = { title: 'My Facilities' };

export default async function OwnerFacilitiesPage() {
  const { userId } = await requireOwner('/owner/dashboard');

  const facilities = await prisma.facility.findMany({
    where: { ownerId: userId },
    include: {
      courts: {
        orderBy: { name: 'asc' },
        select: { id: true, name: true, type: true, hourlyRate: true, isActive: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">My Facilities</h1>
        <Link
          href="/owner/facilities/add"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add facility
        </Link>
      </div>

      {facilities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-zinc-500">You haven't created any facilities yet.</p>
          <Link
            href="/owner/facilities/add"
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create your first facility
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {facilities.map((facility) => (
            <OwnerFacilityCard
              key={facility.id}
              facility={{
                id: facility.id,
                name: facility.name,
                city: facility.city,
                openHour: facility.openHour,
                closeHour: facility.closeHour,
                isActive: facility.isActive,
                courtCount: facility.courts.length,
                courts: facility.courts,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
