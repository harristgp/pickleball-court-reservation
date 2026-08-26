import { MapPin, User } from 'lucide-react';
import Link from 'next/link';

export function FacilityHero({
  name,
  ownerName,
  address,
  city,
  latitude,
  longitude,
}: {
  name: string;
  ownerName: string;
  address: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
}) {
  return (
    <div className="rounded-2xl bg-zinc-900 px-6 py-10 text-white sm:px-10">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{name}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-zinc-300">
        <span className="flex items-center gap-1.5">
          <User className="h-4 w-4" aria-hidden />
          <Link href={`/owners/${ownerName}`} className="hover:text-white transition-colors">
            {ownerName}
          </Link>
        </span>
        {(address || city) && (
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden />
            {[address, city].filter(Boolean).join(', ')}
          </span>
        )}
      </div>

      {latitude && longitude && (
        <div className="mt-4 h-40 overflow-hidden rounded-xl bg-zinc-800">
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Map — {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </div>
        </div>
      )}
    </div>
  );
}
