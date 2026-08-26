import Link from 'next/link';
import { Clock, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatHour } from '@/lib/dates';
import { formatMoney } from '@/lib/money';

export function OwnerFacilityCard({
  facility,
}: {
  facility: {
    id: string;
    name: string;
    city: string;
    openHour: number;
    closeHour: number;
    isActive: boolean;
    courtCount: number;
    courts: Array<{ id: string; name: string; type: string; hourlyRate: { toNumber: () => number }; isActive: boolean }>;
  };
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-card transition-shadow hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">{facility.name}</h2>
            <Badge tone={facility.isActive ? 'emerald' : 'neutral'}>
              {facility.isActive ? 'Active' : 'Disabled'}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-zinc-500">{facility.city}</p>
        </div>

        <Link
          href={`/owner/facilities/${facility.id}/edit`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Edit
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
          {formatHour(facility.openHour)} – {formatHour(facility.closeHour)}
        </span>
        <span>·</span>
        <span>{facility.courtCount} court{facility.courtCount === 1 ? '' : 's'}</span>
      </div>

      {facility.courts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {facility.courts.map((court) => (
            <span
              key={court.id}
              className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700"
            >
              {court.name}
              <span className="text-zinc-400">·</span>
              {formatMoney(court.hourlyRate.toNumber())}/hr
              {!court.isActive && <span className="text-red-400">(off)</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
