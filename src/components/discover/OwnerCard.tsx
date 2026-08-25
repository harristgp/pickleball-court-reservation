import Link from 'next/link';
import { MapPin, Building2, Trees, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import type { NearbyCourt } from '@/lib/types';

export function OwnerCard({ court }: { court: NearbyCourt }) {
  return (
    <Link
      href={`/owners/${court.ownerId}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-4 shadow-card transition-all hover:border-brand-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-zinc-900 group-hover:text-brand-700">
            {court.name}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500">{court.ownerName}</p>
        </div>
        {court.distanceKm !== undefined && (
          <Badge tone="brand">
            <MapPin className="h-3 w-3" aria-hidden />
            {court.distanceKm.toFixed(1)} km
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {court.hasIndoor && (
          <Badge tone="blue">
            <Building2 className="h-3 w-3" aria-hidden />
            Indoor
          </Badge>
        )}
        {court.hasOutdoor && (
          <Badge tone="emerald">
            <Trees className="h-3 w-3" aria-hidden />
            Outdoor
          </Badge>
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-zinc-600">
        <DollarSign className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
        {court.minRate !== null && court.maxRate !== null ? (
          court.minRate === court.maxRate ? (
            <span>{formatMoney(court.minRate)}/hr</span>
          ) : (
            <span>
              {formatMoney(court.minRate)} – {formatMoney(court.maxRate)}/hr
            </span>
          )
        ) : (
          <span>Contact for rates</span>
        )}
      </div>

      <p className="mt-2 text-xs text-zinc-500">
        {court.courtCount} {court.courtCount === 1 ? 'court' : 'courts'}
      </p>
    </Link>
  );
}
