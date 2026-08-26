export function FacilitySkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-card">
      <div className="aspect-[16/10] w-full animate-pulse bg-zinc-200" />

      <div className="space-y-3 p-5">
        <div className="space-y-2">
          <div className="h-5 w-3/4 animate-pulse rounded bg-zinc-200" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-zinc-100" />
        </div>

        <div className="flex gap-1.5">
          <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-100" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-zinc-100" />
        </div>

        <div className="border-t border-zinc-100 pt-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
            <div className="h-8 w-20 animate-pulse rounded-lg bg-zinc-200" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BrowseSkeleton({ count = 6 }: { count?: number }) {
  return (
    <>
      <div className="space-y-4">
        <div className="flex items-end gap-3">
          <div className="h-11 flex-1 animate-pulse rounded-lg bg-zinc-100" />
          <div className="h-11 w-40 animate-pulse rounded-lg bg-zinc-100" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <FacilitySkeleton key={i} />
        ))}
      </div>
    </>
  );
}
