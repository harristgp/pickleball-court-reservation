import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchX } from 'lucide-react';
import { listActiveFacilities } from '@/lib/geo';
import { FacilityCard } from '@/components/browse/FacilityCard';
import { BrowseFilters } from '@/components/browse/BrowseFilters';
import { LoadMoreButton } from '@/components/browse/LoadMoreButton';
import { BrowseSkeleton } from '@/components/browse/FacilitySkeleton';
import { EmptyState } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Browse facilities',
  description: 'Find pickleball facilities, check availability, and book your next game.',
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 12;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const { q, type, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1);

  const { facilities, total } = await listActiveFacilities({
    page,
    pageSize: PAGE_SIZE,
    search: q,
    courtType: type === 'INDOOR' || type === 'OUTDOOR' ? type : undefined,
  });

  const hasMore = page * PAGE_SIZE < total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Browse facilities</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Find pickleball courts near you, check availability, and book your next game.
        </p>
      </div>

      <Suspense fallback={<BrowseSkeleton count={PAGE_SIZE} />}>
        <BrowseFilters total={total} pageSize={PAGE_SIZE} />
      </Suspense>

      {facilities.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-8 w-8" />}
          title="No facilities found"
          description={
            q
              ? `No results for "${q}". Try a different search term or clear your filters.`
              : 'There are no active facilities yet. Check back soon!'
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map((facility) => (
            <FacilityCard key={facility.id} facility={facility} />
          ))}
        </div>
      )}

      {hasMore && <LoadMoreButton currentPage={page} />}
    </div>
  );
}
