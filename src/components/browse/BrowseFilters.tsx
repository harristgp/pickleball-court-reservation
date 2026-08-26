'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input, Select } from '@/components/ui';

type CourtFilter = 'ALL' | 'INDOOR' | 'OUTDOOR';

export function BrowseFilters({
  total,
  pageSize,
}: {
  total: number;
  pageSize: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const q = searchParams.get('q') ?? '';
  const type = (searchParams.get('type') ?? 'ALL') as CourtFilter;

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'ALL') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      startTransition(() => {
        router.push(`/browse?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, startTransition],
  );

  const totalPages = Math.ceil(total / pageSize);
  const showing = Math.min(total, pageSize);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <Input
              id="facility-search"
              value={q}
              onChange={(e) => updateParam('q', e.target.value)}
              placeholder="Search facilities, owners, or cities…"
              className="pl-10"
            />
          </div>
        </div>
        <div className="w-44">
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden />
            <Select
              id="court-type"
              value={type}
              onChange={(e) => updateParam('type', e.target.value)}
              className="pl-9"
            >
              <option value="ALL">All court types</option>
              <option value="INDOOR">Indoor only</option>
              <option value="OUTDOOR">Outdoor only</option>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-600">
          <span className="font-semibold text-zinc-900">{total}</span> facilit{total === 1 ? 'y' : 'ies'} found
          {totalPages > 1 && (
            <span className="ml-1 text-zinc-400">
              &middot; showing page 1 of {totalPages}
            </span>
          )}
        </p>
        {(q || type !== 'ALL') && (
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams();
              startTransition(() => {
                router.push('/browse', { scroll: false });
              });
            }}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
