import type { Metadata } from 'next';
import { listActiveFacilities } from '@/lib/geo';
import { DiscoverClient } from '@/components/discover/DiscoverClient';

export const metadata: Metadata = {
  title: 'Discover facilities',
  description: 'Browse pickleball facilities, filter by type, and find the closest courts to you.',
};

export const dynamic = 'force-dynamic';

export default async function DiscoverPage() {
  const facilities = await listActiveFacilities();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Find a facility</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Browse every active facility, or share your location to sort by real distance.
        </p>
      </div>

      <DiscoverClient initialFacilities={facilities} />
    </div>
  );
}
