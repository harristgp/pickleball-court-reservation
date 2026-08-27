'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';

export function LoadMoreButton({ currentPage }: { currentPage: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const loadMore = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(currentPage + 1));
    startTransition(() => {
      router.push(`/browse?${params.toString()}`, { scroll: false });
    });
  }, [router, searchParams, currentPage, startTransition]);

  return (
    <div className="flex justify-center pt-2">
      <Button
        variant="secondary"
        size="lg"
        onClick={loadMore}
        disabled={pending}
        className="min-w-[180px]"
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Loading…
          </>
        ) : (
          'Load more facilities'
        )}
      </Button>
    </div>
  );
}
