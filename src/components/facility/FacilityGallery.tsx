'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export function FacilityGallery({ photos }: { photos: string[] }) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setActive(i)}
            className="group relative aspect-video overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
          >
            <img
              src={url}
              alt={`Facility photo ${i + 1}`}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {active !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button
            type="button"
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setActive((active - 1 + photos.length) % photos.length)}
            className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <img
            src={photos[active]}
            alt={`Facility photo ${active + 1}`}
            className="max-h-[80vh] max-w-[90vw] rounded-xl object-contain"
          />

          <button
            type="button"
            onClick={() => setActive((active + 1) % photos.length)}
            className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <p className="absolute bottom-4 text-sm text-white/70">
            {active + 1} / {photos.length}
          </p>
        </div>
      )}
    </>
  );
}
