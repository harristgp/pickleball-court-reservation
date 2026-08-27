import type { Metadata } from 'next';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireOwner } from '@/lib/session';
import { formatHour } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { Card, CardHeader, EmptyState, Badge } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Courts' };

export default async function OwnerCourtsPage() {
  const { userId } = await requireOwner('/owner/courts');

  const facilities = await prisma.facility.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      courts: {
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          type: true,
          hourlyRate: true,
          openHour: true,
          closeHour: true,
          isActive: true,
          _count: { select: { bookings: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <CardHeader
        title="Courts"
        description="Courts are organized under facilities. Edit a facility to manage its courts."
      />

      {facilities.length === 0 ? (
        <Card className="p-6">
          <EmptyState
            title="No facilities yet"
            description="Create a facility first, then add courts to it."
            action={
              <Link href="/owner/facilities/add" className="text-sm font-semibold text-brand-600 hover:underline">
                Create facility
              </Link>
            }
          />
        </Card>
      ) : (
        facilities.map((facility) => (
          <div key={facility.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-900">{facility.name}</h2>
              <Link
                href={`/owner/facilities/${facility.id}/edit`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                <Pencil className="h-3 w-3" aria-hidden />
                Edit facility
              </Link>
            </div>

            {facility.courts.length === 0 ? (
              <Card className="p-4">
                <p className="text-sm text-zinc-500">No courts yet.</p>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2">Court</th>
                      <th className="px-4 py-2">Type</th>
                      <th className="px-4 py-2">Rate</th>
                      <th className="px-4 py-2">Hours</th>
                      <th className="px-4 py-2">#</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {facility.courts.map((court) => (
                      <tr key={court.id} className={court.isActive ? '' : 'bg-zinc-50/60 text-zinc-400'}>
                        <td className="px-4 py-2 font-medium text-zinc-900">
                          {court.name}
                          {!court.isActive && <Badge tone="neutral" className="ml-1">off</Badge>}
                        </td>
                        <td className="px-4 py-2">
                          <Badge tone={court.type === 'INDOOR' ? 'blue' : 'emerald'}>
                            {court.type === 'INDOOR' ? 'Indoor' : 'Outdoor'}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 tabular-nums">{formatMoney(court.hourlyRate)}</td>
                        <td className="px-4 py-2 tabular-nums">
                          {formatHour(court.openHour)} – {formatHour(court.closeHour)}
                        </td>
                        <td className="px-4 py-2 tabular-nums">{court._count.bookings}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        ))
      )}
    </div>
  );
}
