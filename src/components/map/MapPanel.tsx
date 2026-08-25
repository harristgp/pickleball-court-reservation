'use client';

import dynamic from 'next/dynamic';
import { MapPinned } from 'lucide-react';
import type { ClubMapProps } from '@/components/map/ClubMap';

/**
 * Leaflet reaches for `window` at module scope, so the map must never be part
 * of the server render. Loading it through next/dynamic with ssr:false keeps it
 * out of the server bundle and shows a skeleton until the chunk lands.
 */
const ClubMap = dynamic(() => import('@/components/map/ClubMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-xl bg-zinc-100">
      <span className="flex items-center gap-2 text-sm text-zinc-400">
        <MapPinned className="h-4 w-4 animate-pulse" aria-hidden />
        Loading map…
      </span>
    </div>
  ),
});

export function MapPanel(props: ClubMapProps) {
  return <ClubMap {...props} />;
}
