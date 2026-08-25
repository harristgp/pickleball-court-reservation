import type { Metadata } from 'next';
import { listActiveClubs } from '@/lib/geo';
import { DiscoverClient } from '@/components/discover/DiscoverClient';

export const metadata: Metadata = {
  title: 'Discover courts',
  description: 'Browse pickleball clubs, filter by city and court type, and find the closest courts to you.',
};

// Club availability and activation change often enough that a cached list would
// show suspended clubs; render per request.
export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  // The first paint is the complete active-club list, so the page is useful
  // before (and without) any geolocation prompt.
  const clubs = await listActiveClubs();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Find a court</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Browse every active club, or share your location to sort by real distance.
        </p>
      </div>

      <DiscoverClient initialClubs={clubs} />
    </div>
  );
}
