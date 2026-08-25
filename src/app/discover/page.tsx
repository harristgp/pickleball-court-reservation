import type { Metadata } from 'next';
import { listActiveCourts } from '@/lib/geo';
import { DiscoverClient } from '@/components/discover/DiscoverClient';

export const metadata: Metadata = {
  title: 'Discover courts',
  description: 'Browse pickleball courts, filter by type, and find the closest courts to you.',
};

// Court availability and activation change often enough that a cached list would
// show suspended courts; render per request.
export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  // The first paint is the complete active-court list, so the page is useful
  // before (and without) any geolocation prompt.
  const courts = await listActiveCourts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Find a court</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Browse every active court, or share your location to sort by real distance.
        </p>
      </div>

      <DiscoverClient initialCourts={courts} />
    </div>
  );
}
