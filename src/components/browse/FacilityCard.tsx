import Link from 'next/link';
import { MapPin, Building2, Trees, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui';
import { formatMoney } from '@/lib/money';
import type { FacilitySummary } from '@/lib/types';

export function FacilityCard({ facility }: { facility: FacilitySummary }) {
  const coverUrl = facility.photos[0] ?? null;

  return (
    <Link
      href={`/browse/facility/${facility.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-card transition-all hover:border-brand-300 hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={facility.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand-100 via-brand-50 to-emerald-50">
            <div className="text-center">
              <span className="block text-4xl font-bold text-brand-200">
                {facility.name.charAt(0)}
              </span>
              <span className="mt-1 block text-xs font-medium text-brand-300">No photo yet</span>
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="space-y-1.5">
          <h3 className="truncate text-base font-semibold text-zinc-900 group-hover:text-brand-700">
            {facility.name}
          </h3>
          <p className="flex items-center gap-1.5 text-sm text-zinc-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
            <span className="truncate">
              {facility.address || facility.city}
              {facility.address && facility.city ? `, ${facility.city}` : ''}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {facility.hasIndoor && (
            <Badge tone="blue">
              <Building2 className="h-3 w-3" aria-hidden />
              Indoor
            </Badge>
          )}
          {facility.hasOutdoor && (
            <Badge tone="emerald">
              <Trees className="h-3 w-3" aria-hidden />
              Outdoor
            </Badge>
          )}
          <Badge tone="neutral">
            {facility.courtCount} {facility.courtCount === 1 ? 'court' : 'courts'}
          </Badge>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4">
          <div className="text-sm font-semibold text-zinc-900">
            {facility.minRate !== null && facility.maxRate !== null ? (
              facility.minRate === facility.maxRate ? (
                <span>{formatMoney(facility.minRate)}/hr</span>
              ) : (
                <span>{formatMoney(facility.minRate)} &ndash; {formatMoney(facility.maxRate)}/hr</span>
              )
            ) : (
              <span className="font-normal text-zinc-500">Contact for rates</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors group-hover:bg-brand-600">
            Book now
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
