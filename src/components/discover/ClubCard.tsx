import Link from 'next/link';
import { Building2, MapPin, Navigation, Trees } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import type { NearbyClub } from '@/lib/types';

export function ClubCard({ club }: { club: NearbyClub }) {
  return (
    <Link
      href={`/clubs/${club.id}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-zinc-900 group-hover:text-brand-700">{club.name}</h3>
          <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{club.address}</span>
          </p>
        </div>

        {club.distanceKm !== undefined && (
          <Badge tone="brand" className="shrink-0">
            <Navigation className="h-3 w-3" aria-hidden />
            {club.distanceKm.toFixed(1)} km
          </Badge>
        )}
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-600">{club.description}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge>{club.courtCount} court{club.courtCount === 1 ? '' : 's'}</Badge>
        {club.hasIndoor && (
          <Badge tone="blue">
            <Building2 className="h-3 w-3" aria-hidden />
            Indoor
          </Badge>
        )}
        {club.hasOutdoor && (
          <Badge tone="emerald">
            <Trees className="h-3 w-3" aria-hidden />
            Outdoor
          </Badge>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
        <span className="text-sm font-semibold text-zinc-900">
          {club.minRate === null ? 'No courts yet' : `${formatMoney(club.minRate)}`}
          {club.minRate !== null && <span className="text-xs font-normal text-zinc-500"> /hour</span>}
        </span>
        <span className="text-xs font-semibold text-brand-700 group-hover:underline">View availability →</span>
      </div>
    </Link>
  );
}
